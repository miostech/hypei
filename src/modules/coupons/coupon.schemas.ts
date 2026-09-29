import { z } from "zod";
import { CouponType } from "@/generated/prisma/enums";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";

/** Codes are stored upper-cased so "bemvindo" and "BEMVINDO" are the same coupon. */
export const normalizeCouponCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Use ao menos 3 caracteres")
      .max(32, "Use no máximo 32 caracteres")
      .regex(/^[A-Za-z0-9-]+$/, "Use apenas letras, números e hífen")
      .transform(normalizeCouponCode),
    type: z.enum(CouponType),
    /** Percentage as typed by a human: "10" or "10,5". */
    percentage: z
      .string()
      .trim()
      .regex(/^\d{1,3}([.,]\d{1,2})?$/, "Percentual inválido (ex.: 10)")
      .optional(),
    amount: z
      .string()
      .trim()
      .regex(/^\d{1,9}([.,]\d{1,2})?$/, "Valor inválido (ex.: 50,00)")
      .optional(),
    currency: z.enum(SUPPORTED_CURRENCIES as [string, ...string[]]),
    minAmount: z
      .string()
      .trim()
      .regex(/^\d{1,9}([.,]\d{1,2})?$/, "Valor inválido (ex.: 100,00)")
      .optional(),
    productId: z.string().optional(),
    maxRedemptions: z.coerce.number().int().min(1).max(1_000_000).optional(),
    oncePerCustomer: z.boolean(),
    expiresAt: z.string().optional(),
    active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "PERCENTAGE" && !value.percentage) {
      ctx.addIssue({ code: "custom", path: ["percentage"], message: "Informe o percentual" });
    }
    if (value.type === "FIXED_AMOUNT" && !value.amount) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Informe o valor do desconto" });
    }
  });

export type CouponInput = z.infer<typeof couponInputSchema>;

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  PERCENTAGE: "Percentual",
  FIXED_AMOUNT: "Valor fixo",
};
