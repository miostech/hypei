"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getRedis } from "@/lib/database/redis/client";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
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
