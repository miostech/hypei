import { z } from "zod";

export const affiliateInputSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(180),
  /** Typed as a percentage ("30" or "30,5") and stored in basis points. */
  commissionBps: z
    .string()
    .trim()
    .regex(/^\d{1,2}([.,]\d{1,2})?$/, "Percentual inválido (ex.: 30)")
    .transform((value) => Math.round(Number(value.replace(",", ".")) * 100))
    .refine((bps) => bps > 0 && bps <= 9000, "A comissão deve ficar entre 0,01% e 90%"),
  checkoutId: z.string().optional(),
  active: z.boolean(),
});

export type AffiliateInput = z.infer<typeof affiliateInputSchema>;

export const AFFILIATE_COMMISSION_STATUS_LABELS = {
  PENDING: "Aguardando liberação",
  APPROVED: "Aprovada",
  AVAILABLE: "A pagar",
  PAID: "Paga",
  CANCELED: "Cancelada",
} as const;
