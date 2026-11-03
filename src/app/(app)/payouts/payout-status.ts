import type { PayoutStatus } from "@/generated/prisma/enums";

/** A cor do selo de cada status. O texto fica em `dict.payouts.statuses`. */
export const PAYOUT_STATUS_VARIANT: Record<PayoutStatus, "outline" | "secondary" | "success" | "warning" | "destructive"> = {
  REQUESTED: "outline",
  PENDING: "warning",
  PROCESSING: "warning",
  PAID: "success",
  FAILED: "destructive",
  CANCELED: "secondary",
};
