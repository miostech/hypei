import { z } from "zod";
import { PaymentMethodType } from "@/generated/prisma/enums";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { slugSchema } from "@/modules/organizations/organization.schemas";

/**
 * Piso da garantia, em dias.
 *
 * Não é preferência de produto: o art. 49 do CDC dá ao comprador sete dias para desistir de
 * compra feita fora do estabelecimento. Anunciar menos que isso não reduz o direito dele, só
 * cria promessa que a plataforma teria de quebrar no primeiro pedido de reembolso.
 */
export const GUARANTEE_MIN_DAYS = 7;

/**
 * Teto de order bumps por checkout.
 *
 * Não é limite técnico: é de conversão. Cada caixa a mais divide a atenção de quem já decidiu
 * comprar, e a terceira oferta costuma custar a primeira. Três é onde o produtor ainda consegue
 * explicar por que cada uma está ali.
 */
export const MAX_ORDER_BUMPS = 3;

/**
 * Uma oferta adicional marcável dentro do checkout.
 *
 * O preço é digitado aqui, no checkout, e não lido da oferta — foi decisão de produto, e cobra
 * o seu preço: o valor passa a existir também no Mongo, versionado. Duas travas seguram a
 * divergência. O navegador manda só quais bumps foram marcados, nunca quanto custam, e o
 * servidor relê a versão corrente para cobrar. E o `OrderItem` guarda o valor cobrado, então
 * editar o checkout amanhã não reescreve o que um pedido de ontem registrou.
 */
export const orderBumpInputSchema = z.object({
  offerId: z.string().min(1, "Selecione a oferta do bump"),
  headline: z.string().trim().min(2, "Informe a chamada do bump").max(120),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  price: z.string().trim().regex(/^\d{1,9}([.,]\d{1,2})?$/, "Valor inválido (ex.: 29,00)"),
  /** "De R$ 97", riscado ao lado do preço. Vazio não mostra nada — âncora inventada é propaganda enganosa. */
  compareAtPrice: z.string().trim().regex(/^\d{1,9}([.,]\d{1,2})?$/, "Valor inválido (ex.: 97,00)").optional().or(z.literal("")),
});

export type OrderBumpInput = z.infer<typeof orderBumpInputSchema>;

export const checkoutBuilderSchema = z.object({
  offerId: z.string().min(1, "Selecione uma oferta"),
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
  headline: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
  logoKey: z.string().trim().max(300).optional().or(z.literal("")),
  bannerKey: z.string().trim().max(300).optional().or(z.literal("")),
  collectPhone: z.boolean(),
  guaranteeDays: z.coerce.number().int().min(GUARANTEE_MIN_DAYS, `A garantia é de no mínimo ${GUARANTEE_MIN_DAYS} dias`).max(365),
  enabledPaymentMethods: z.array(z.enum(PaymentMethodType)),
  orderBumps: z.array(orderBumpInputSchema).max(MAX_ORDER_BUMPS).default([]),
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
  referralCode: z.string().trim().max(24).optional().or(z.literal("")),
  tracking: trackingSchema,
  /**
   * Idioma em que o comprador estava lendo a página.
   *
   * Vai para o Customer porque o e-mail de confirmação sai do outbox, horas depois e sem
   * requisição nenhuma: na hora de mandar não existe mais Accept-Language para consultar. O
   * único momento em que dá para saber a língua dele é agora.
   */
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  /**
   * Quais bumps o comprador marcou — só os ids. O preço de cada um o servidor relê da versão
   * corrente do checkout: o que vem do navegador é escolha, nunca valor.
   *
   * Opcional como o `tracking`: a maioria das compras não marca nenhum, e quem chama sem
   * mencionar bump nenhum está dizendo exatamente isso.
   */
  bumpOfferIds: z.array(z.string().min(1).max(64)).max(MAX_ORDER_BUMPS).optional(),
});

export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>;
