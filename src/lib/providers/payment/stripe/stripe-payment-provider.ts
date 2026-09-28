import Stripe from "stripe";
import { ProviderError, WebhookSignatureError } from "@/lib/errors";
import type {
  CreateCustomerInput,
  CreateMerchantAccountInput,
  CreatePaymentInput,
  CreatePayoutInput,
  CreateSubscriptionInput,
  MerchantOnboardingLinkInput,
  NormalizedProviderEvent,
  PaymentProvider,
  ProviderPaymentResult,
  ProviderPayoutResult,
  ProviderRefundResult,
  RefundPaymentInput,
  VerifiedWebhook,
} from "../types";
import { StripeConnectService } from "./stripe-connect.service";
import {
  fromStripePaymentMethodType,
  toDisputeState,
  toMerchantSnapshot,
  toProviderPaymentStatus,
  toProviderPayoutState,
  toStripePaymentMethodTypes,
  toSubscriptionState,
} from "./stripe-mappers";

const fromUnix = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null);
const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

/**
 * Stripe implementation of Ripay's PaymentProvider.
 *
 * Money model ("separate charges and transfers"): buyers pay the Ripay platform account,
 * Ripay's own ledger tracks what each producer is owed, and funds are transferred to the
 * producer's connected account + paid out only when the Ripay settlement rules allow it.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly type = "STRIPE" as const;
  private readonly connect: StripeConnectService;

  constructor(
    private readonly stripe: Stripe,
    private readonly webhookSecret: string,
  ) {
    this.connect = new StripeConnectService(stripe);
  }

  async createCustomer(input: CreateCustomerInput) {
    const customer = await this.stripe.customers.create(
      { email: input.email, name: input.name, metadata: input.metadata },
      { idempotencyKey: input.idempotencyKey },
    );
    return { providerCustomerId: customer.id };
  }

  async createPayment(input: CreatePaymentInput): Promise<ProviderPaymentResult> {
    const methodTypes = toStripePaymentMethodTypes(input.paymentMethods);
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: Number(input.amount), // Stripe expects an integer in minor units.
        currency: input.currency.toLowerCase(),
        customer: input.providerCustomerId,
        description: input.description,
        metadata: input.metadata,
        transfer_group: input.metadata.orderId ? `order_${input.metadata.orderId}` : undefined,
        ...(methodTypes.length > 0
          ? { payment_method_types: methodTypes }
          : { automatic_payment_methods: { enabled: true } }),
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return {
      providerPaymentId: intent.id,
      clientSecret: intent.client_secret,
      status: toProviderPaymentStatus(intent.status),
    };
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentResult> {
    const intent = await this.stripe.paymentIntents.retrieve(providerPaymentId);
    return { providerPaymentId: intent.id, clientSecret: intent.client_secret, status: toProviderPaymentStatus(intent.status) };
  }

  async cancelPayment(providerPaymentId: string, idempotencyKey: string): Promise<void> {
    await this.stripe.paymentIntents.cancel(providerPaymentId, {}, { idempotencyKey });
  }

  async refundPayment(input: RefundPaymentInput): Promise<ProviderRefundResult> {
    const refund = await this.stripe.refunds.create(
      {
        payment_intent: input.providerPaymentId,
        amount: Number(input.amount),
        metadata: { ...input.metadata, reason: input.reason ?? "" },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    const status = refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "pending";
    return { providerRefundId: refund.id, status };
  }

  async createSubscription(input: CreateSubscriptionInput) {
    const subscription = await this.stripe.subscriptions.create(
      {
        customer: input.providerCustomerId,
        items: [{ price: input.providerPriceId }],
        trial_period_days: input.trialDays ?? undefined,
        payment_behavior: "default_incomplete",
        metadata: input.metadata,
        expand: ["latest_invoice.confirmation_secret"],
      },
      { idempotencyKey: input.idempotencyKey },
    );
    const invoice = subscription.latest_invoice as (Stripe.Invoice & { confirmation_secret?: { client_secret?: string } }) | null;
    return { providerSubscriptionId: subscription.id, clientSecret: invoice?.confirmation_secret?.client_secret ?? null };
  }

  async cancelSubscription(providerSubscriptionId: string, idempotencyKey: string): Promise<void> {
    await this.stripe.subscriptions.cancel(providerSubscriptionId, {}, { idempotencyKey });
  }

  createMerchantAccount(input: CreateMerchantAccountInput) {
    return this.connect.createConnectedAccount(input);
  }

  createMerchantOnboardingLink(input: MerchantOnboardingLinkInput) {
    return this.connect.createAccountOnboardingLink(input);
  }

  getMerchantAccount(providerAccountId: string) {
    return this.connect.getConnectedAccount(providerAccountId);
  }

  /**
   * Transfer the producer's settled funds from the platform to the connected account,
   * then create a payout on that account. The Ripay payout id travels in metadata so the
   * `payout.*` Connect webhook can be reconciled back to the Ripay Payout.
   */
  async createPayout(input: CreatePayoutInput): Promise<ProviderPayoutResult> {
    await this.stripe.transfers.create(
      {
        amount: Number(input.amount),
        currency: input.currency.toLowerCase(),
        destination: input.providerAccountId,
        transfer_group: input.metadata.payoutId ? `payout_${input.metadata.payoutId}` : undefined,
        metadata: input.metadata,
      },
      { idempotencyKey: `${input.idempotencyKey}:transfer` },
    );
    const payout = await this.stripe.payouts.create(
      { amount: Number(input.amount), currency: input.currency.toLowerCase(), metadata: input.metadata },
      { idempotencyKey: `${input.idempotencyKey}:payout`, stripeAccount: input.providerAccountId },
    );
    return { providerPayoutId: payout.id, status: toProviderPayoutState(payout.status), failureReason: payout.failure_message };
  }

  async getPayout(providerPayoutId: string, providerAccountId: string): Promise<ProviderPayoutResult> {
    const payout = await this.stripe.payouts.retrieve(providerPayoutId, {}, { stripeAccount: providerAccountId });
    return { providerPayoutId: payout.id, status: toProviderPayoutState(payout.status), failureReason: payout.failure_message };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhook> {
    const signature = headers.get("stripe-signature");
    if (!signature) throw new WebhookSignatureError("STRIPE");
    let event: Stripe.Event;
    try {
      event = await this.stripe.webhooks.constructEventAsync(rawBody, signature, this.webhookSecret);
    } catch {
      throw new WebhookSignatureError("STRIPE");
    }
    return {
      provider: "STRIPE",
      eventId: event.id,
      eventType: event.type,
      createdAt: new Date(event.created * 1000),
      payload: event,
    };
  }

  async processWebhook(webhook: VerifiedWebhook): Promise<NormalizedProviderEvent[]> {
    const event = webhook.payload as Stripe.Event;
    const occurredAt = webhook.createdAt;

    switch (event.type) {
      case "payment_intent.created":
        return [{ kind: "ignored", reason: "payment intent creation is initiated by Ripay" }];
      case "payment_intent.processing":
        return [{ kind: "payment.processing", providerPaymentId: event.data.object.id, occurredAt }];
      case "payment_intent.succeeded":
        return [await this.normalizeSucceededPayment(event.data.object.id, occurredAt)];
      case "payment_intent.payment_failed":
        return [
          {
            kind: "payment.failed",
            providerPaymentId: event.data.object.id,
            reason: event.data.object.last_payment_error?.code ?? event.data.object.last_payment_error?.message ?? null,
            occurredAt,
          },
        ];
      case "payment_intent.canceled":
        return [{ kind: "payment.canceled", providerPaymentId: event.data.object.id, occurredAt }];
      case "charge.refunded": {
        const charge = event.data.object;
        const providerPaymentId = idOf(charge.payment_intent);
        if (!providerPaymentId) return [{ kind: "ignored", reason: "refunded charge without payment intent" }];
        const refunds = await this.stripe.refunds.list({ charge: charge.id, limit: 100 });
        return refunds.data
          .filter((r) => r.status === "succeeded")
          .map((r) => ({
            kind: "refund.succeeded" as const,
            providerRefundId: r.id,
            providerPaymentId,
            amount: BigInt(r.amount),
            currency: r.currency.toUpperCase(),
            occurredAt,
          }));
      }
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        const dispute = event.data.object;
        const providerPaymentId = idOf(dispute.payment_intent);
        if (!providerPaymentId) return [{ kind: "ignored", reason: "dispute without payment intent" }];
        return [
          {
            kind: "dispute.updated",
            providerDisputeId: dispute.id,
            providerPaymentId,
            amount: BigInt(dispute.amount),
            currency: dispute.currency.toUpperCase(),
            reason: dispute.reason ?? null,
            status: toDisputeState(dispute.status),
            evidenceDueAt: fromUnix(dispute.evidence_details?.due_by),
            occurredAt,
          },
        ];
      }
      case "account.updated":
        return [{ kind: "merchant_account.updated", snapshot: toMerchantSnapshot(event.data.object), occurredAt }];
      case "payout.created":
      case "payout.updated":
      case "payout.paid":
      case "payout.failed":
      case "payout.canceled": {
        const payout = event.data.object;
        return [
          {
            kind: "payout.updated",
            providerPayoutId: payout.id,
            payoutId: payout.metadata?.payoutId ?? null,
            status: toProviderPayoutState(payout.status),
            failureReason: payout.failure_message ?? payout.failure_code ?? null,
            occurredAt,
          },
        ];
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number }) | undefined;
        return [
          {
            kind: "subscription.updated",
            providerSubscriptionId: sub.id,
            status: toSubscriptionState(sub.status),
            currentPeriodStart: fromUnix(item?.current_period_start),
            currentPeriodEnd: fromUnix(item?.current_period_end),
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
            occurredAt,
          },
        ];
      }
      case "invoice.paid":
      case "invoice.payment_failed":
        // Subscription renewals are ledgered from the underlying PaymentIntent events (Phase 2).
        return [{ kind: "ignored", reason: `${event.type} handled via subscription/payment events` }];
      default:
        return [{ kind: "ignored", reason: `unhandled stripe event ${event.type}` }];
    }
  }

  /** Fetches the charge's balance transaction to get the REAL processor fee charged by Stripe. */
  private async normalizeSucceededPayment(providerPaymentId: string, occurredAt: Date): Promise<NormalizedProviderEvent> {
    const intent = await this.stripe.paymentIntents.retrieve(providerPaymentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = intent.latest_charge as Stripe.Charge | null;
    if (!charge) throw new ProviderError("STRIPE", `PaymentIntent ${providerPaymentId} succeeded without a charge`);
    const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
    // Fee is expressed in the settlement currency; Ripay only supports same-currency settlement in Phase 1.
    if (balanceTx && balanceTx.currency !== intent.currency) {
      throw new ProviderError("STRIPE", "Cross-currency settlement is not supported yet", {
        chargeCurrency: intent.currency,
        settlementCurrency: balanceTx.currency,
      });
    }
    return {
      kind: "payment.succeeded",
      providerPaymentId: intent.id,
      providerChargeId: charge.id,
      amount: BigInt(intent.amount_received),
      currency: intent.currency.toUpperCase(),
      processorFeeAmount: BigInt(balanceTx?.fee ?? 0),
      paymentMethod: fromStripePaymentMethodType(
        charge.payment_method_details?.type,
        charge.payment_method_details?.card?.wallet?.type,
      ),
      occurredAt,
    };
  }
}
