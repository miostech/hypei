"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getRedis } from "@/lib/database/redis/client";
import { ValidationError } from "@/lib/errors";
import { getCheckoutDictionary, type CheckoutDictionary } from "@/lib/i18n/checkout";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/i18n/locale";
import { logger } from "@/lib/logger";
import { formatAmount } from "@/lib/ui/format";
import { InMemoryRateLimiter, RedisRateLimiter, type RateLimiter } from "@/lib/security/rate-limit";
import { startCheckoutSchema, trackingSchema } from "@/modules/checkout/checkout.schemas";
import { CouponNotUsableError } from "@/modules/coupons/coupon.service";
import { CHECKOUT_EVENT_TYPES } from "@/modules/analytics/analytics-event.repository";
import { getServices } from "@/server/container";

export interface StartCheckoutActionResult {
  ok: boolean;
  message?: string;
  paymentId?: string;
  clientSecret?: string | null;
  provider?: string;
}

/**
 * Idioma em que esta action responde.
 *
 * Vem no corpo, mandado pelo cliente, e não do Accept-Language da requisição: a página aceita
 * ?lang= para o produtor conferir o checkout em outro idioma, e aí o navegador dele continuaria
 * pedindo português. O que o comprador está lendo na tela é a resposta certa.
 *
 * Entrada inválida cai no padrão em vez de recusar: o idioma é moldura da mensagem, nunca
 * motivo para derrubar um pagamento.
 */
const localeSchema = z.object({ locale: z.enum(SUPPORTED_LOCALES).catch(DEFAULT_LOCALE) });

async function buyerDictionary(input: unknown): Promise<CheckoutDictionary> {
  const parsed = localeSchema.safeParse(input);
  return getCheckoutDictionary(parsed.success ? parsed.data.locale : DEFAULT_LOCALE);
}

/** Zod fala em caminho de campo; o comprador precisa da frase do campo dele. */
function invalidInputMessage(error: z.ZodError, dict: CheckoutDictionary): string {
  const field = error.issues[0]?.path[0];
  if (field === "name") return dict.errors.invalidName;
  if (field === "email") return dict.errors.invalidEmail;
  return dict.errors.invalidData;
}

/**
 * Traduz o erro de domínio pelo código que ele carrega, nunca pela mensagem — comparar texto
 * quebraria na primeira vez que alguém reescrevesse a frase.
 *
 * Erro de domínio que chegue aqui sem código vira a frase genérica e um aviso no log: a frase
 * em português não serve a quem compra de fora, e o log é como o código que falta aparece.
 */
function buyerMessage(error: unknown, dict: CheckoutDictionary, fallback: string): string {
  if (error instanceof CouponNotUsableError) return dict.errors.coupon[error.reason];
  if (error instanceof ValidationError) {
    if (error.details?.reason === "checkoutNotLive") return dict.errors.checkoutNotLive;
    logger.warn({ err: error }, "buyer-facing domain error without a reason code");
  }
  return fallback;
}

let limiter: RateLimiter | undefined;
function rateLimiter(): RateLimiter {
  if (!limiter) {
    try {
      limiter = new RedisRateLimiter(getRedis());
    } catch (err) {
      logger.warn({ err }, "redis unavailable; falling back to in-memory rate limiting");
      limiter = new InMemoryRateLimiter();
    }
  }
  return limiter;
}

/** Public endpoint: rate-limited per IP and idempotent per checkout attempt. */
export async function startCheckoutAction(input: unknown): Promise<StartCheckoutActionResult> {
  const dict = await buyerDictionary(input);
  try {
    const parsed = startCheckoutSchema.parse(input);
    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed } = await rateLimiter().consume(`checkout:${ip}`, 20, 60);
    if (!allowed) return { ok: false, message: dict.errors.rateLimited };

    const result = await getServices().checkouts.start(parsed);
    return { ok: true, paymentId: result.paymentId, clientSecret: result.clientSecret, provider: result.provider };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: invalidInputMessage(error, dict) };
    if (error instanceof ValidationError) return { ok: false, message: buyerMessage(error, dict, dict.errors.startFailed) };
    logger.error({ err: error }, "checkout start failed");
    return { ok: false, message: dict.errors.startFailed };
  }
}

const couponSchema = z.object({ slug: z.string().min(1).max(64), code: z.string().trim().min(1).max(32) });

export interface ApplyCouponResult {
  ok: boolean;
  message?: string;
  code?: string;
  discount?: string;
  total?: string;
}

/**
 * Public endpoint, so it is rate limited harder than the checkout itself: without
 * that, this is a free oracle for guessing discount codes.
 */
export async function applyCouponAction(input: unknown): Promise<ApplyCouponResult> {
  const dict = await buyerDictionary(input);
  try {
    const { slug, code } = couponSchema.parse(input);
    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed } = await rateLimiter().consume(`coupon:${ip}`, 10, 60);
    if (!allowed) return { ok: false, message: dict.errors.rateLimited };

    const result = await getServices().checkouts.previewCoupon(slug, code);
    return {
      ok: true,
      code: result.code,
      discount: formatAmount(result.discount, result.currency),
      total: formatAmount(result.total, result.currency),
    };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: dict.errors.invalidCode };
    if (error instanceof ValidationError) return { ok: false, message: buyerMessage(error, dict, dict.errors.couponFailed) };
    logger.error({ err: error }, "coupon preview failed");
    return { ok: false, message: dict.errors.couponFailed };
  }
}

/** Counts a visit that arrived through a referral link. Best effort, never blocks. */
export async function registerAffiliateClick(code: unknown): Promise<void> {
  const parsed = z.string().trim().min(4).max(24).safeParse(code);
  if (!parsed.success) return;
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimiter().consume(`ref:${ip}`, 30, 60);
  if (!allowed) return;
  await getServices().affiliates.registerClick(parsed.data).catch((err) => logger.warn({ err }, "click tracking failed"));
}

const trackSchema = z.object({
  eventType: z.enum(CHECKOUT_EVENT_TYPES),
  organizationId: z.string().min(1),
  checkoutId: z.string().min(1),
  sessionId: z.string().min(8).max(64),
  tracking: trackingSchema,
});

export async function trackCheckoutEvent(input: unknown): Promise<void> {
  const parsed = trackSchema.safeParse(input);
  if (!parsed.success) return;
  await getServices().tracking.trackCheckout(parsed.data);
}

/**
 * Development only: asks the mock provider to emit a signed webhook, so the payment is
 * confirmed through exactly the same path a real provider would use.
 */
export async function simulateMockPayment(paymentId: string, outcome: "succeeded" | "failed"): Promise<{ ok: boolean; message?: string }> {
  if (process.env.APP_ENV === "production") return { ok: false, message: "Indisponível" };
  const services = getServices();
  const provider = services.paymentProvider;
  if (provider.type !== "MOCK" || !("emit" in provider)) return { ok: false, message: "Provedor simulado não está ativo" };

  const payment = await services.uow.repos.payments.findById(paymentId);
  if (!payment?.providerPaymentId) return { ok: false, message: "Pagamento não encontrado" };

  const mock = provider as unknown as { emit: (event: unknown) => Promise<void> };
  await mock.emit(
    outcome === "succeeded"
      ? { type: "payment.succeeded", providerPaymentId: payment.providerPaymentId, amount: payment.amount.toString(), currency: payment.currency }
      : { type: "payment.failed", providerPaymentId: payment.providerPaymentId, reason: "simulated_decline" },
  );
  return { ok: true };
}

export async function getPaymentStatus(paymentId: string): Promise<{ status: string }> {
  const payment = await getServices().payments.getPublicStatus(paymentId).catch(() => null);
  return { status: payment?.status ?? "UNKNOWN" };
}
