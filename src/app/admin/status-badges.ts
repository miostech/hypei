type Variant = "success" | "warning" | "destructive" | "outline";

/** Shared labels so every admin table names a state the same way. */
export const VERIFICATION_BADGE: Record<string, { label: string; variant: Variant }> = {
  NOT_STARTED: { label: "Não iniciada", variant: "outline" },
  PENDING: { label: "Em análise", variant: "warning" },
  REQUIRES_ACTION: { label: "Falta informação", variant: "warning" },
  VERIFIED: { label: "Verificada", variant: "success" },
  REJECTED: { label: "Recusada", variant: "destructive" },
  SUSPENDED: { label: "Suspensa", variant: "destructive" },
};

export const PAYOUT_BADGE: Record<string, { label: string; variant: Variant }> = {
  REQUESTED: { label: "Solicitado", variant: "warning" },
  PROCESSING: { label: "Processando", variant: "warning" },
  PAID: { label: "Pago", variant: "success" },
  FAILED: { label: "Falhou", variant: "destructive" },
  CANCELED: { label: "Cancelado", variant: "outline" },
};

export const DISPUTE_BADGE: Record<string, { label: string; variant: Variant }> = {
  OPEN: { label: "Aberta", variant: "warning" },
  UNDER_REVIEW: { label: "Em análise", variant: "warning" },
  WON: { label: "Ganha", variant: "success" },
  LOST: { label: "Perdida", variant: "destructive" },
  CLOSED: { label: "Encerrada", variant: "outline" },
};

export const PAYMENT_BADGE: Record<string, { label: string; variant: Variant }> = {
  CREATED: { label: "Criado", variant: "outline" },
  PENDING: { label: "Pendente", variant: "outline" },
  PROCESSING: { label: "Processando", variant: "warning" },
  PAID: { label: "Pago", variant: "success" },
  PARTIALLY_REFUNDED: { label: "Reembolso parcial", variant: "warning" },
  REFUNDED: { label: "Reembolsado", variant: "outline" },
  CHARGEBACK: { label: "Chargeback", variant: "destructive" },
  FAILED: { label: "Falhou", variant: "destructive" },
  CANCELED: { label: "Cancelado", variant: "outline" },
  EXPIRED: { label: "Expirado", variant: "outline" },
};
