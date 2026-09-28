import type {
  MerchantAccountStatus,
  PaymentMethodType,
  PaymentProviderType,
} from "@/generated/prisma/enums";
import type { CurrencyCode } from "@/lib/money";

/** Metadata attached to provider objects for reconciliation. Never put sensitive data here. */
export type ProviderMetadata = Partial<
  Record<"organizationId" | "orderId" | "paymentId" | "customerId" | "offerId" | "payoutId" | "refundId", string>
>;

export interface CreateCustomerInput {
  email: string;
  name: string;
  country?: string | null;
  metadata: ProviderMetadata;
  idempotencyKey: string;
}

export interface CreatePaymentInput {
  amount: bigint;
  currency: CurrencyCode;
  providerCustomerId?: string;
  paymentMethods: PaymentMethodType[];
  merchantAccountId?: string;
  description: string;
  metadata: ProviderMetadata;
  idempotencyKey: string;
}

export interface ProviderPaymentResult {
  providerPaymentId: string;
  /** Only ever returned to the buyer's browser for the payment it belongs to. Never logged. */
  clientSecret: string | null;
  status: "requires_payment_method" | "processing" | "succeeded" | "canceled";
}

export interface RefundPaymentInput {
  providerPaymentId: string;
  amount: bigint;
  currency: CurrencyCode;
  reason?: string;
  metadata: ProviderMetadata;
  idempotencyKey: string;
}

export interface ProviderRefundResult {
  providerRefundId: string;
  status: "pending" | "succeeded" | "failed";
}

export interface CreateMerchantAccountInput {
  organizationId: string;
  country: string;
  defaultCurrency: CurrencyCode;
  businessType: "INDIVIDUAL" | "COMPANY";
  email?: string;
  idempotencyKey: string;
}

export interface MerchantAccountSnapshot {
  providerAccountId: string;
  country: string;
  defaultCurrency: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: {
    currentlyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
    disabledReason: string | null;
  };
}

export interface MerchantOnboardingLinkInput {
  providerAccountId: string;
  refreshUrl: string;
  returnUrl: string;
  mode: "onboarding" | "update";
}

export interface CreatePayoutInput {
  providerAccountId: string;
  amount: bigint;
  currency: CurrencyCode;
  metadata: ProviderMetadata;
  idempotencyKey: string;
}

export type ProviderPayoutState = "pending" | "in_transit" | "paid" | "failed" | "canceled";

export interface ProviderPayoutResult {
  providerPayoutId: string;
  status: ProviderPayoutState;
  failureReason?: string | null;
}

export interface CreateSubscriptionInput {
  providerCustomerId: string;
  providerPriceId: string;
  trialDays?: number | null;
  metadata: ProviderMetadata;
  idempotencyKey: string;
}

/** Verified, raw webhook envelope. Only produced after signature verification. */
export interface VerifiedWebhook {
  provider: PaymentProviderType;
  eventId: string;
  eventType: string;
  createdAt: Date;
  payload: unknown;
}

/**
 * Provider-agnostic events consumed by Ripay domain services.
 * Providers translate their webhooks into these; the domain never sees provider payloads.
 */
export type NormalizedProviderEvent =
  | { kind: "payment.processing"; providerPaymentId: string; occurredAt: Date }
  | {
      kind: "payment.succeeded";
      providerPaymentId: string;
      providerChargeId: string | null;
      amount: bigint;
      currency: string;
      processorFeeAmount: bigint;
      paymentMethod: PaymentMethodType | null;
      occurredAt: Date;
    }
  | { kind: "payment.failed"; providerPaymentId: string; reason: string | null; occurredAt: Date }
  | { kind: "payment.canceled"; providerPaymentId: string; occurredAt: Date }
  | {
      kind: "refund.succeeded";
      providerRefundId: string;
      providerPaymentId: string;
      amount: bigint;
      currency: string;
      occurredAt: Date;
    }
  | { kind: "refund.failed"; providerRefundId: string; reason: string | null; occurredAt: Date }
  | {
      kind: "dispute.updated";
      providerDisputeId: string;
      providerPaymentId: string;
      amount: bigint;
      currency: string;
      reason: string | null;
      status: "open" | "under_review" | "won" | "lost";
      evidenceDueAt: Date | null;
      occurredAt: Date;
    }
  | { kind: "merchant_account.updated"; snapshot: MerchantAccountSnapshot; occurredAt: Date }
  | {
      kind: "payout.updated";
      providerPayoutId: string;
      payoutId: string | null;
      status: ProviderPayoutState;
      failureReason: string | null;
      occurredAt: Date;
    }
  | {
      kind: "subscription.updated";
      providerSubscriptionId: string;
      status: "trialing" | "active" | "past_due" | "paused" | "canceled" | "unpaid";
      currentPeriodStart: Date | null;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      occurredAt: Date;
    }
  | { kind: "ignored"; reason: string };

export interface PaymentProvider {
  readonly type: PaymentProviderType;

  createCustomer(input: CreateCustomerInput): Promise<{ providerCustomerId: string }>;

  createPayment(input: CreatePaymentInput): Promise<ProviderPaymentResult>;
  getPayment(providerPaymentId: string): Promise<ProviderPaymentResult>;
  cancelPayment(providerPaymentId: string, idempotencyKey: string): Promise<void>;
  refundPayment(input: RefundPaymentInput): Promise<ProviderRefundResult>;

  createSubscription(input: CreateSubscriptionInput): Promise<{ providerSubscriptionId: string; clientSecret: string | null }>;
  cancelSubscription(providerSubscriptionId: string, idempotencyKey: string): Promise<void>;

  createMerchantAccount(input: CreateMerchantAccountInput): Promise<MerchantAccountSnapshot>;
  createMerchantOnboardingLink(input: MerchantOnboardingLinkInput): Promise<{ url: string; expiresAt: Date | null }>;
  getMerchantAccount(providerAccountId: string): Promise<MerchantAccountSnapshot>;

  createPayout(input: CreatePayoutInput): Promise<ProviderPayoutResult>;
  getPayout(providerPayoutId: string, providerAccountId: string): Promise<ProviderPayoutResult>;

  /** Validates signature using the RAW body. Throws WebhookSignatureError when invalid. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhook>;
  /** Translates a verified webhook into normalized domain events. */
  processWebhook(webhook: VerifiedWebhook): Promise<NormalizedProviderEvent[]>;
}

export type { MerchantAccountStatus };
