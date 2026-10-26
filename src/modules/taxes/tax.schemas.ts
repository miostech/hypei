import { z } from "zod";
import { TaxRegime } from "@/generated/prisma/enums";

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  NONE: "Não calcular imposto",
  BR_SIMPLES_NACIONAL: "Simples Nacional",
  BR_ISS: "ISS — nota fiscal de serviço municipal",
};

export const TAX_REGIME_HINTS: Record<TaxRegime, string> = {
  NONE: "Nenhum imposto é destacado nas suas vendas. Você declara por fora.",
  BR_SIMPLES_NACIONAL: "Informe a alíquota efetiva da sua faixa de faturamento, não a nominal da tabela.",
  BR_ISS: "Alíquota do seu município, normalmente entre 2% e 5%.",
};

export const taxSettingsSchema = z
  .object({
    regime: z.enum(TaxRegime),
    /** Alíquota como a pessoa digita: "6" ou "6,5". */
    rate: z
      .string()
      .trim()
      .regex(/^\d{1,3}([.,]\d{1,2})?$/, "Alíquota inválida (ex.: 6 ou 6,5)")
      .optional(),
    jurisdiction: z.string().trim().max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.regime === "NONE") return;
    if (!value.rate) {
      ctx.addIssue({ code: "custom", path: ["rate"], message: "Informe a alíquota" });
    }
    if (value.regime === "BR_ISS" && !value.jurisdiction) {
      ctx.addIssue({ code: "custom", path: ["jurisdiction"], message: "Informe o município da nota" });
    }
  });

export type TaxSettingsInput = z.infer<typeof taxSettingsSchema>;
