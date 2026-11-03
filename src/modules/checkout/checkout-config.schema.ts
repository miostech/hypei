import { z } from "zod";
import { PaymentMethodType } from "@/generated/prisma/enums";
import { GUARANTEE_MIN_DAYS, MAX_ORDER_BUMPS } from "./checkout.schemas";

/**
 * Versioned checkout configuration (MongoDB). The price of the offer being sold is NOT here:
 * it always comes from the Offer in PostgreSQL.
 *
 * O preço dos order bumps é a única exceção, e é deliberada. Um bump é "leve a planilha por
 * R$ 29", um valor que existe para aquele checkout e não para a oferta em si; obrigar o
 * produtor a criar uma oferta nova a cada combinação transformaria o catálogo em lixo. O que
 * segura a exceção é o versionamento: cada edição grava uma versão nova, o pedido registra em
 * `checkoutVersion` qual delas o comprador viu, e o `OrderItem` guarda o valor efetivamente
 * cobrado. Nada aqui é lido na hora de conferir o que uma venda antiga custou.
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
  /**
   * Ofertas adicionais marcáveis, na ordem em que aparecem. Lista vazia é o normal.
   *
   * `amount` e `compareAtAmount` estão em unidades menores (centavos), como todo dinheiro na
   * Kabrun. Aqui são `number` e não `bigint` porque isto é um documento JSON; a conversão para
   * `bigint` acontece ao ler, antes de qualquer conta. Nenhuma aritmética roda sobre eles nesta
   * forma. A grandeza cabe com folga: 2^53 centavos são noventa trilhões de reais.
   *
   * Versão antiga gravada antes do recurso não tem esta chave e cai no padrão — por isso o
   * `.default([])` em vez de campo obrigatório: recusar uma versão antiga derrubaria a página
   * que um pedido antigo registrou.
   */
  orderBumps: z
    .array(
      z.object({
        offerId: z.string().min(1),
        headline: z.string().min(1).max(120),
        description: z.string().max(240).default(""),
        amount: z.number().int().positive(),
        compareAtAmount: z.number().int().positive().nullable().default(null),
      }),
    )
    .max(MAX_ORDER_BUMPS)
    .default([]),
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
