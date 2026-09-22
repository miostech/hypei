import { z } from "zod";
import { BillingInterval, BillingType } from "@/generated/prisma/enums";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";

/**
 * Price is typed by humans as a decimal string ("97,00") and converted to minor units
 * server-side with integer math (parseDecimalToMinorUnits) — never with parseFloat.
 */
export const offerInputSchema = z
  .object({
    productId: z.string().min(1, "Selecione um produto"),
    name: z.string().trim().min(2, "Informe o nome").max(120),
    price: z.string().trim().regex(/^\d{1,9}([.,]\d{1,2})?$/, "Valor inválido (ex.: 97,00)"),
    currency: z.enum(SUPPORTED_CURRENCIES as [string, ...string[]]),
    billingType: z.enum(BillingType),
    installments: z.coerce.number().int().min(2).max(12).optional(),
    billingInterval: z.enum(BillingInterval).optional(),
    trialDays: z.coerce.number().int().min(0).max(90).optional(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.billingType === "SUBSCRIPTION" && !v.billingInterval) {
      ctx.addIssue({ code: "custom", path: ["billingInterval"], message: "Informe a recorrência" });
    }
    if (v.billingType === "INSTALLMENTS" && !v.installments) {
      ctx.addIssue({ code: "custom", path: ["installments"], message: "Informe o número de parcelas" });
    }
  });

export type OfferInput = z.infer<typeof offerInputSchema>;

export const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  ONE_TIME: "Pagamento único",
  SUBSCRIPTION: "Assinatura",
  INSTALLMENTS: "Parcelado",
};

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  DAY: "Diária",
  WEEK: "Semanal",
  MONTH: "Mensal",
  YEAR: "Anual",
};
