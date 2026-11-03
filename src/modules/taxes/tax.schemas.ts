import { z } from "zod";
import { TaxRegime } from "@/generated/prisma/enums";

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
