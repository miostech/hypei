import type Stripe from "stripe";
import type { PaymentMethodType } from "@/generated/prisma/enums";
import type { MerchantAccountSnapshot, ProviderPaymentResult, ProviderPayoutState } from "../types";

/** Hypei payment method → Stripe payment_method_types. */
export const STRIPE_METHOD_BY_HYPEI: Partial<Record<PaymentMethodType, string>> = {
  CREDIT_CARD: "card",
  DEBIT_CARD: "card",
  APPLE_PAY: "card", // wallets ride on the card method in Payment Element
  GOOGLE_PAY: "card",
  PIX: "pix",
  BOLETO: "boleto",
  SEPA_DEBIT: "sepa_debit",
  BANK_TRANSFER: "customer_balance",
  PAYPAL: "paypal",
};

export function toStripePaymentMethodTypes(methods: PaymentMethodType[]): string[] {
  return [...new Set(methods.map((m) => STRIPE_METHOD_BY_HYPEI[m]).filter((m): m is string => Boolean(m)))];
}

export function fromStripePaymentMethodType(type: string | undefined | null, wallet?: string | null): PaymentMethodType | null {
  if (wallet === "apple_pay") return "APPLE_PAY";
  if (wallet === "google_pay") return "GOOGLE_PAY";
  switch (type) {
    case "card":
      return "CREDIT_CARD";
    case "pix":
      return "PIX";
    case "boleto":
      return "BOLETO";
    case "sepa_debit":
      return "SEPA_DEBIT";
    case "customer_balance":
      return "BANK_TRANSFER";
    case "paypal":
      return "PAYPAL";
    default:
      return null;
  }
}

export function toProviderPaymentStatus(status: Stripe.PaymentIntent.Status): ProviderPaymentResult["status"] {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "processing":
      return "processing";
    case "canceled":
      return "canceled";
    default:
      return "requires_payment_method";
  }
}

export function toMerchantSnapshot(account: Stripe.Account): MerchantAccountSnapshot {
  return {
    providerAccountId: account.id,
    country: (account.country ?? "").toUpperCase(),
    defaultCurrency: (account.default_currency ?? "").toUpperCase(),
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirements: {
      currentlyDue: account.requirements?.currently_due ?? [],
      pastDue: account.requirements?.past_due ?? [],
      pendingVerification: account.requirements?.pending_verification ?? [],
      disabledReason: account.requirements?.disabled_reason ?? null,
    },
  };
}

export function toProviderPayoutState(status: string): ProviderPayoutState {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "in_transit":
      return "in_transit";
    default:
      return "pending";
  }
}

export function toDisputeState(status: Stripe.Dispute.Status): "open" | "under_review" | "won" | "lost" {
  switch (status) {
    case "won":
      return "won";
    case "lost":
      return "lost";
    case "under_review":
    case "warning_under_review":
      return "under_review";
    default:
      return "open";
  }
}

export function toSubscriptionState(
  status: Stripe.Subscription.Status,
): "trialing" | "active" | "past_due" | "paused" | "canceled" | "unpaid" {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "unpaid":
      return "unpaid";
    default:
      return "canceled";
  }
}
