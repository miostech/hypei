import type { PaymentStatus } from "@/generated/prisma/enums";

/** Statuses after which the capture has already been ledgered. */
export const CAPTURED_STATUSES: readonly PaymentStatus[] = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "CHARGEBACK"];

export function isCaptured(status: PaymentStatus): boolean {
  return CAPTURED_STATUSES.includes(status);
}

/**
 * Webhooks can arrive out of order: a late `processing` or `failed` must never
 * move a captured payment backwards.
 */
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return false;
  if (isCaptured(from)) return isCaptured(to);
  if (from === "FAILED" || from === "CANCELED") return to === "PAID"; // late success after retry wins
  return true;
}
