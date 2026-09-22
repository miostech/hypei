import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { WebhookSignatureError, ProviderError } from "@/lib/errors";
import { calculatePercentage, money } from "@/lib/money";
import type {
  CreateCustomerInput,
  CreateMerchantAccountInput,
  CreatePaymentInput,
  CreatePayoutInput,
  CreateSubscriptionInput,
  MerchantAccountSnapshot,
  MerchantOnboardingLinkInput,
  NormalizedProviderEvent,
  PaymentProvider,
  ProviderPaymentResult,
  ProviderPayoutResult,
  ProviderRefundResult,
  RefundPaymentInput,
  VerifiedWebhook,
} from "../types";
import type { PaymentMethodType } from "@/generated/prisma/enums";

export const MOCK_SIGNATURE_HEADER = "x-hypei-mock-signature";

/** Shape of events emitted by the mock provider (mirrors how a real PSP would notify us). */
export type MockEvent =
  | { type: "payment.succeeded"; providerPaymentId: string; amount: string; currency: string; paymentMethod?: PaymentMethodType }
  | { type: "payment.failed"; providerPaymentId: string; reason?: string }
  | { type: "refund.succeeded"; providerRefundId: string; providerPaymentId: string; amount: string; currency: string }
  | { type: "dispute.updated"; providerDisputeId: string; providerPaymentId: string; amount: string; currency: string; status: "open" | "under_review" | "won" | "lost"; reason?: string }
  | { type: "payout.updated"; providerPayoutId: string; payoutId: string | null; status: "paid" | "failed" | "in_transit"; failureReason?: string }
  | { type: "merchant_account.updated"; providerAccountId: string };

export interface MockEventEnvelope {
  id: string;
  created: string;
  event: MockEvent;
}

interface MockPayment {
  id: string;
  amount: bigint;
  currency: string;
  clientSecret: string;
  status: ProviderPaymentResult["status"];
}

interface MockPayout {
  id: string;
  payoutId: string | null;
  status: ProviderPayoutResult["status"];
}

export interface MockPaymentProviderOptions {
  webhookSecret: string;
  processorFeeBps: number;
  /** Merchant accounts are immediately ACTIVE in the mock (no real KYC). */
  autoActivateMerchants?: boolean;
  /** Hook used by the app to deliver emitted events through the real webhook pipeline. */
  deliver?: (rawBody: string, headers: Headers) => Promise<void>;
}

/**
 * Deterministic, in-memory payment provider for local development and tests.
 * It never moves money. Confirmation still flows through signed webhooks, exactly like a real PSP.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly type = "MOCK" as const;

  private readonly payments = new Map<string, MockPayment>();
  private readonly payouts = new Map<string, MockPayout>();
  private readonly accounts = new Map<string, MerchantAccountSnapshot>();
  private readonly idempotency = new Map<string, unknown>();

  constructor(private readonly options: MockPaymentProviderOptions) {}

  private once<T>(key: string, create: () => T): T {
    if (this.idempotency.has(key)) return this.idempotency.get(key) as T;
    const value = create();
    this.idempotency.set(key, value);
    return value;
  }

  async createCustomer(input: CreateCustomerInput) {
    return this.once(input.idempotencyKey, () => ({ providerCustomerId: `mock_cus_${randomUUID()}` }));
  }

  async createPayment(input: CreatePaymentInput): Promise<ProviderPaymentResult> {
    return this.once(input.idempotencyKey, () => {
      const id = `mock_pi_${randomUUID()}`;
      const clientSecret = `${id}_secret_${randomUUID()}`;
      this.payments.set(id, { id, amount: input.amount, currency: input.currency, clientSecret, status: "requires_payment_method" });
      return { providerPaymentId: id, clientSecret, status: "requires_payment_method" as const };
    });
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentResult> {
    const p = this.payments.get(providerPaymentId);
    if (!p) throw new ProviderError("MOCK", `Unknown payment ${providerPaymentId}`);
    return { providerPaymentId: p.id, clientSecret: p.clientSecret, status: p.status };
  }

  async cancelPayment(providerPaymentId: string): Promise<void> {
    const p = this.payments.get(providerPaymentId);
    if (p && p.status !== "succeeded") p.status = "canceled";
  }

  async refundPayment(input: RefundPaymentInput): Promise<ProviderRefundResult> {
    const result = this.once(input.idempotencyKey, () => {
      const id = `mock_re_${randomUUID()}`;
      return { providerRefundId: id, status: "pending" as const, fresh: true };
    });
    if (result.fresh) {
      result.fresh = false;
      this.emitLater({
        type: "refund.succeeded",
        providerRefundId: result.providerRefundId,
        providerPaymentId: input.providerPaymentId,
        amount: input.amount.toString(),
        currency: input.currency,
      });
    }
    return { providerRefundId: result.providerRefundId, status: result.status };
  }

  async createSubscription(input: CreateSubscriptionInput) {
    return this.once(input.idempotencyKey, () => ({ providerSubscriptionId: `mock_sub_${randomUUID()}`, clientSecret: null }));
  }

  async cancelSubscription(): Promise<void> {}

  async createMerchantAccount(input: CreateMerchantAccountInput): Promise<MerchantAccountSnapshot> {
    return this.once(input.idempotencyKey, () => {
      const active = this.options.autoActivateMerchants ?? true;
      const snapshot: MerchantAccountSnapshot = {
        providerAccountId: `mock_acct_${randomUUID()}`,
        country: input.country,
        defaultCurrency: input.defaultCurrency,
        chargesEnabled: active,
        payoutsEnabled: active,
        detailsSubmitted: active,
        requirements: { currentlyDue: active ? [] : ["external_account"], pastDue: [], pendingVerification: [], disabledReason: null },
      };
      this.accounts.set(snapshot.providerAccountId, snapshot);
      return snapshot;
    });
  }

  async createMerchantOnboardingLink(input: MerchantOnboardingLinkInput) {
    return { url: `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}mock_onboarding=complete`, expiresAt: null };
  }

  async getMerchantAccount(providerAccountId: string): Promise<MerchantAccountSnapshot> {
    const account = this.accounts.get(providerAccountId);
    if (!account) throw new ProviderError("MOCK", `Unknown merchant account ${providerAccountId}`);
    return account;
  }

  /** Test helper: flip the KYC state of a mock connected account. */
  setMerchantAccount(snapshot: MerchantAccountSnapshot): void {
    this.accounts.set(snapshot.providerAccountId, snapshot);
  }

  async createPayout(input: CreatePayoutInput): Promise<ProviderPayoutResult> {
    const result = this.once(input.idempotencyKey, () => {
      const id = `mock_po_${randomUUID()}`;
      this.payouts.set(id, { id, payoutId: input.metadata.payoutId ?? null, status: "pending" });
      return { providerPayoutId: id, status: "pending" as const, fresh: true };
    });
    if (result.fresh) {
      result.fresh = false;
      this.emitLater({
        type: "payout.updated",
        providerPayoutId: result.providerPayoutId,
        payoutId: input.metadata.payoutId ?? null,
        status: "paid",
      });
    }
    return { providerPayoutId: result.providerPayoutId, status: result.status };
  }

  async getPayout(providerPayoutId: string): Promise<ProviderPayoutResult> {
    const p = this.payouts.get(providerPayoutId);
    if (!p) throw new ProviderError("MOCK", `Unknown payout ${providerPayoutId}`);
    return { providerPayoutId: p.id, status: p.status };
  }

  // ── Webhooks ────────────────────────────────────────────────────────────

  sign(rawBody: string): string {
    return createHmac("sha256", this.options.webhookSecret).update(rawBody).digest("hex");
  }

  /** Builds a signed webhook exactly as it would arrive over HTTP. */
  buildWebhook(event: MockEvent, eventId: string = `mock_evt_${randomUUID()}`): { rawBody: string; headers: Headers } {
    const envelope: MockEventEnvelope = { id: eventId, created: new Date().toISOString(), event };
    const rawBody = JSON.stringify(envelope);
    return { rawBody, headers: new Headers({ [MOCK_SIGNATURE_HEADER]: this.sign(rawBody) }) };
  }

  /** Emits an event through the configured delivery hook (async, like a real PSP callback). */
  async emit(event: MockEvent): Promise<void> {
    if (!this.options.deliver) return;
    const { rawBody, headers } = this.buildWebhook(event);
    await this.options.deliver(rawBody, headers);
  }

  private emitLater(event: MockEvent): void {
    if (!this.options.deliver) return;
    setTimeout(() => void this.emit(event).catch(() => undefined), 50);
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhook> {
    const signature = headers.get(MOCK_SIGNATURE_HEADER) ?? "";
    const expected = this.sign(rawBody);
    const valid =
      signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) throw new WebhookSignatureError("MOCK");
    const envelope = JSON.parse(rawBody) as MockEventEnvelope;
    return {
      provider: "MOCK",
      eventId: envelope.id,
      eventType: envelope.event.type,
      createdAt: new Date(envelope.created),
      payload: envelope,
    };
  }

  async processWebhook(webhook: VerifiedWebhook): Promise<NormalizedProviderEvent[]> {
    const { event } = webhook.payload as MockEventEnvelope;
    const occurredAt = webhook.createdAt;
    switch (event.type) {
      case "payment.succeeded": {
        const amount = BigInt(event.amount);
        const p = this.payments.get(event.providerPaymentId);
        if (p) p.status = "succeeded";
        const fee = calculatePercentage(money(amount, event.currency), this.options.processorFeeBps);
        return [
          {
            kind: "payment.succeeded",
            providerPaymentId: event.providerPaymentId,
            providerChargeId: `mock_ch_${event.providerPaymentId.replace(/^mock_pi_/, "")}`,
            amount,
            currency: event.currency,
            processorFeeAmount: fee.amount,
            paymentMethod: event.paymentMethod ?? "CREDIT_CARD",
            occurredAt,
          },
        ];
      }
      case "payment.failed":
        return [{ kind: "payment.failed", providerPaymentId: event.providerPaymentId, reason: event.reason ?? "card_declined", occurredAt }];
      case "refund.succeeded":
        return [
          {
            kind: "refund.succeeded",
            providerRefundId: event.providerRefundId,
            providerPaymentId: event.providerPaymentId,
            amount: BigInt(event.amount),
            currency: event.currency,
            occurredAt,
          },
        ];
      case "dispute.updated":
        return [
          {
            kind: "dispute.updated",
            providerDisputeId: event.providerDisputeId,
            providerPaymentId: event.providerPaymentId,
            amount: BigInt(event.amount),
            currency: event.currency,
            reason: event.reason ?? "fraudulent",
            status: event.status,
            evidenceDueAt: null,
            occurredAt,
          },
        ];
      case "payout.updated": {
        const p = this.payouts.get(event.providerPayoutId);
        if (p) p.status = event.status;
        return [
          {
            kind: "payout.updated",
            providerPayoutId: event.providerPayoutId,
            payoutId: event.payoutId ?? p?.payoutId ?? null,
            status: event.status,
            failureReason: event.failureReason ?? null,
            occurredAt,
          },
        ];
      }
      case "merchant_account.updated": {
        const snapshot = this.accounts.get(event.providerAccountId);
        if (!snapshot) return [{ kind: "ignored", reason: "unknown mock account" }];
        return [{ kind: "merchant_account.updated", snapshot, occurredAt }];
      }
    }
  }
}
