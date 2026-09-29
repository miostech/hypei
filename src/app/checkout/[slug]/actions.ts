"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getRedis } from "@/lib/database/redis/client";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { formatAmount } from "@/lib/ui/format";
import { InMemoryRateLimiter, RedisRateLimiter, type RateLimiter } from "@/lib/security/rate-limit";
import { startCheckoutSchema, trackingSchema } from "@/modules/checkout/checkout.schemas";
import { CHECKOUT_EVENT_TYPES } from "@/modules/analytics/analytics-event.repository";
import { getServices } from "@/server/container";

export interface StartCheckoutActionResult {
  ok: boolean;
  message?: string;
  paymentId?: string;
  clientSecret?: string | null;
  provider?: string;
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
  try {
    const parsed = startCheckoutSchema.parse(input);
    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed } = await rateLimiter().consume(`checkout:${ip}`, 20, 60);
    if (!allowed) return { ok: false, message: "Muitas tentativas. Aguarde um instante e tente novamente." };

    const result = await getServices().checkouts.start(parsed);
    return { ok: true, paymentId: result.paymentId, clientSecret: result.clientSecret, provider: result.provider };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, message: error.issues[0]?.message ?? "Dados inválidos" };
    }
    if (error instanceof ValidationError) return { ok: false, message: error.message };
    logger.error({ err: error }, "checkout start failed");
    return { ok: false, message: "Não foi possível iniciar o pagamento. Tente novamente." };
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
  try {
    const { slug, code } = couponSchema.parse(input);
    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed } = await rateLimiter().consume(`coupon:${ip}`, 10, 60);
    if (!allowed) return { ok: false, message: "Muitas tentativas. Aguarde um instante." };

    const result = await getServices().checkouts.previewCoupon(slug, code);
    return {
      ok: true,
      code: result.code,
      discount: formatAmount(result.discount, result.currency),
      total: formatAmount(result.total, result.currency),
    };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: "Código inválido" };
    if (error instanceof ValidationError) return { ok: false, message: error.message };
    logger.error({ err: error }, "coupon preview failed");
    return { ok: false, message: "Não foi possível validar o cupom." };
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
