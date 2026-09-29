import { z } from "zod";
import type { DisputeStatus, RefundStatus } from "@/generated/prisma/enums";

/**
 * The producer types a decimal ("97,00"); it becomes minor units server-side with
 * integer math, never parseFloat.
 */
export const refundInputSchema = z.object({
  paymentId: z.string().min(1),
  scope: z.enum(["full", "partial"]),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,9}([.,]\d{1,2})?$/, "Valor inválido (ex.: 97,00)")
    .optional(),
  reason: z.string().trim().max(200).optional(),
});

export type RefundInput = z.infer<typeof refundInputSchema>;

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  REQUESTED: "Solicitado",
  PROCESSING: "Processando",
  PAID: "Devolvido",
  FAILED: "Falhou",
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: "Aberta",
  UNDER_REVIEW: "Em análise",
  WON: "Ganha",
  LOST: "Perdida",
  CLOSED: "Encerrada",
};
