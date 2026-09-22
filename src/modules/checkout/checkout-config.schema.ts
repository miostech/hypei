import { z } from "zod";
import { PaymentMethodType } from "@/generated/prisma/enums";

/**
 * Presentation-only checkout configuration (MongoDB). Never contains the price:
 * the official amount always comes from the Offer in PostgreSQL.
 */
export const checkoutConfigSchema = z.object({
  theme: z.object({
    mode: z.enum(["light", "dark"]).default("light"),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#5B3DF5"),
  }),
  logoUrl: z.string().url().nullable().default(null),
  headline: z.string().min(1).max(120),
  description: z.string().max(600).default(""),
  fields: z.object({
    phone: z.boolean().default(false),
    country: z.boolean().default(true),
  }),
  enabledPaymentMethods: z.array(z.enum(PaymentMethodType)).default([]),
  orderBump: z
    .object({ enabled: z.boolean(), offerId: z.string().nullable(), headline: z.string().max(120).nullable() })
    .default({ enabled: false, offerId: null, headline: null }),
  tracking: z
    .object({ metaPixelId: z.string().nullable(), googleTagId: z.string().nullable() })
    .default({ metaPixelId: null, googleTagId: null }),
  styles: z.record(z.string(), z.string()).default({}),
  guaranteeDays: z.number().int().min(0).max(365).default(7),
});

export type CheckoutConfig = z.infer<typeof checkoutConfigSchema>;

export function defaultCheckoutConfig(headline: string): CheckoutConfig {
  return checkoutConfigSchema.parse({ theme: {}, headline, fields: {} });
}
