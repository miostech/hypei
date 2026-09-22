import type { PayoutStatus } from "@/generated/prisma/enums";

export const PAYOUT_STATUS_BADGE: Record<PayoutStatus, { label: string; variant: "outline" | "secondary" | "success" | "warning" | "destructive" }> = {
  REQUESTED: { label: "Solicitado", variant: "outline" },
  PENDING: { label: "Em processamento", variant: "warning" },
  PROCESSING: { label: "A caminho do banco", variant: "warning" },
  PAID: { label: "Pago", variant: "success" },
  FAILED: { label: "Falhou", variant: "destructive" },
  CANCELED: { label: "Cancelado", variant: "secondary" },
};
