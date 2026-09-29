import { z } from "zod";
import { PaymentMethodType } from "@/generated/prisma/enums";
import { slugSchema } from "@/modules/organizations/organization.schemas";

export const checkoutBuilderSchema = z.object({
  offerId: z.string().min(1, "Selecione uma oferta"),
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
  headline: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  collectPhone: z.boolean(),
  guaranteeDays: z.coerce.number().int().min(0).max(365),
  enabledPaymentMethods: z.array(z.enum(PaymentMethodType)),
});

export type CheckoutBuilderInput = z.infer<typeof checkoutBuilderSchema>;

export const trackingSchema = z.object({
  utm_source: z.string().max(200).nullish(),
  utm_medium: z.string().max(200).nullish(),
  utm_campaign: z.string().max(200).nullish(),
  utm_content: z.string().max(200).nullish(),
  utm_term: z.string().max(200).nullish(),
  referrer: z.string().max(500).nullish(),
  affiliateId: z.string().max(100).nullish(),
});

export type TrackingInput = z.infer<typeof trackingSchema>;

export const startCheckoutSchema = z.object({
  slug: z.string().min(1).max(64),
  attemptId: z.string().uuid(),
  sessionId: z.string().min(8).max(64),
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido"),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  country: z.string().length(2).optional(),
  couponCode: z.string().trim().max(32).optional().or(z.literal("")),
  tracking: trackingSchema,
});

export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>;
