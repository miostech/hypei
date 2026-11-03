import { z } from "zod";

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

