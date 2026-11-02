import { z } from "zod";
import { PaymentMethodType } from "@/generated/prisma/enums";
import { GUARANTEE_MIN_DAYS } from "./checkout.schemas";

/**
 * Presentation-only checkout configuration (MongoDB). Never contains the price:
 * the official amount always comes from the Offer in PostgreSQL.
 */
export const checkoutConfigSchema = z.object({
  theme: z.object({
    mode: z.enum(["light", "dark"]).default("light"),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#5B3DF5"),
  }),
  /** Chave do objeto no storage, igual ao banner: o logo também é enviado pelo produtor. */
  logoKey: z.string().nullable().default(null),
  /**
   * Chave do objeto no storage, não URL: o banner é enviado pelo produtor e continua privado
   * no bucket. A página assina uma URL curta a cada renderização, como o resto da mídia.
   */
  bannerKey: z.string().nullable().default(null),
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
  // O piso de GUARANTEE_MIN_DAYS vale para quem salva agora, e por isso mora no schema do
  // formulário. Aqui ele não entra: este schema lê versões já gravadas, e recusar uma versão
  // antiga com garantia menor derrubaria a página de pagamento que um pedido antigo registrou.
  guaranteeDays: z.number().int().min(0).max(365).default(GUARANTEE_MIN_DAYS),
});

export type CheckoutConfig = z.infer<typeof checkoutConfigSchema>;

export function defaultCheckoutConfig(headline: string): CheckoutConfig {
  return checkoutConfigSchema.parse({ theme: {}, headline, fields: {} });
}
