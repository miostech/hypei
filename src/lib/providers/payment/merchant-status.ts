import type { MerchantAccountStatus } from "@/generated/prisma/enums";
import type { MerchantAccountSnapshot } from "./types";

/**
 * Derives the internal MerchantAccount status from provider capabilities AND requirements,
 * instead of trusting a single boolean.
 */
export function deriveMerchantAccountStatus(snapshot: MerchantAccountSnapshot): MerchantAccountStatus {
  const { chargesEnabled, payoutsEnabled, detailsSubmitted, requirements } = snapshot;
  const disabledReason = requirements.disabledReason ?? "";

  if (disabledReason.startsWith("rejected")) return "DISABLED";
  if (requirements.pastDue.length > 0) return chargesEnabled ? "RESTRICTED" : "REQUIRES_ACTION";
  if (chargesEnabled && payoutsEnabled && requirements.currentlyDue.length === 0) return "ACTIVE";
  if (requirements.pendingVerification.length > 0 || disabledReason === "requirements.pending_verification") {
    return "UNDER_REVIEW";
  }
  if (!detailsSubmitted || requirements.currentlyDue.length > 0) {
    return chargesEnabled || payoutsEnabled ? "RESTRICTED" : detailsSubmitted ? "REQUIRES_ACTION" : "PENDING";
  }
  return "RESTRICTED";
}

/** A merchant account may receive payouts only when fully active with payouts enabled. */
export function isMerchantAccountReadyForPayouts(account: {
  status: MerchantAccountStatus;
  payoutsEnabled: boolean;
}): boolean {
  return account.status === "ACTIVE" && account.payoutsEnabled;
}
