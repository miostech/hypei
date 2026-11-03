import type { DisputeStatus, OrderStatus, PaymentStatus, RefundStatus } from "@/generated/prisma/enums";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive" | "success" | "warning";

/**
 * A cor do selo de cada status. O texto mora no dicionário (`dict.status`) — aqui fica só o
 * que não depende de idioma, para que traduzir uma tela não encoste na aparência dela.
 */
export const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  CREATED: "outline",
  PENDING_PAYMENT: "warning",
  PAID: "success",
  CANCELED: "secondary",
  REFUNDED: "destructive",
  PARTIALLY_REFUNDED: "warning",
};

export const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, BadgeVariant> = {
  CREATED: "outline",
  PENDING: "warning",
  PROCESSING: "warning",
  AUTHORIZED: "secondary",
  PAID: "success",
  FAILED: "destructive",
  CANCELED: "secondary",
  REFUNDED: "destructive",
  PARTIALLY_REFUNDED: "warning",
  CHARGEBACK: "destructive",
};

export const REFUND_STATUS_VARIANT: Record<RefundStatus, BadgeVariant> = {
  REQUESTED: "outline",
  PROCESSING: "outline",
  PAID: "success",
  FAILED: "destructive",
};

export const DISPUTE_STATUS_VARIANT: Record<DisputeStatus, BadgeVariant> = {
  OPEN: "warning",
  UNDER_REVIEW: "warning",
  WON: "success",
  LOST: "destructive",
  CLOSED: "outline",
};

/** Uma contestação nestes dois estados ainda retém dinheiro; nos outros três, já não. */
export const OPEN_DISPUTE_STATUS: readonly DisputeStatus[] = ["OPEN", "UNDER_REVIEW"];
