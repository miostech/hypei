import { z } from "zod";
import { BusinessType, TaxIdType } from "@/generated/prisma/enums";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";
import { SUPPORTED_COUNTRIES } from "./countries";

export const slugSchema = z
  .string()
  .trim()
  .min(3, "Mínimo de 3 caracteres")
  .max(48, "Máximo de 48 caracteres")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens");

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(80),
  slug: slugSchema,
  country: z.enum(SUPPORTED_COUNTRIES),
  businessType: z.enum(BusinessType),
  currency: z.enum(SUPPORTED_CURRENCIES as [string, ...string[]]),
  taxIdType: z.enum(TaxIdType),
  taxId: z.string().trim().min(4, "Informe o documento").max(32),
  legalName: z.string().trim().max(120).optional().or(z.literal("")),
  website: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  supportEmail: z.string().trim().email("E-mail inválido"),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
