import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive" | "success" | "warning";

export const ORDER_STATUS_BADGE: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  CREATED: { label: "Criado", variant: "outline" },
  PENDING_PAYMENT: { label: "Aguardando", variant: "warning" },
  PAID: { label: "Pago", variant: "success" },
  CANCELED: { label: "Cancelado", variant: "secondary" },
  REFUNDED: { label: "Reembolsado", variant: "destructive" },
  PARTIALLY_REFUNDED: { label: "Reembolso parcial", variant: "warning" },
};

export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  CREATED: { label: "Criado", variant: "outline" },
  PENDING: { label: "Pendente", variant: "warning" },
  PROCESSING: { label: "Processando", variant: "warning" },
  AUTHORIZED: { label: "Autorizado", variant: "secondary" },
  PAID: { label: "Pago", variant: "success" },
  FAILED: { label: "Falhou", variant: "destructive" },
  CANCELED: { label: "Cancelado", variant: "secondary" },
  REFUNDED: { label: "Reembolsado", variant: "destructive" },
  PARTIALLY_REFUNDED: { label: "Reembolso parcial", variant: "warning" },
  CHARGEBACK: { label: "Chargeback", variant: "destructive" },
};
