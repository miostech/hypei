import "server-only";
import { NextResponse } from "next/server";
import type { PaymentProviderType } from "@/generated/prisma/enums";
import { WebhookSignatureError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/logger/request-context";
import { getServices } from "@/server/container";

/**
 * Shared HTTP handling for provider webhooks:
 * raw body → verify signature → persist/dedupe → enqueue → fast 2xx.
 */
export async function handleWebhookRequest(provider: PaymentProviderType, request: Request): Promise<Response> {
  const rawBody = await request.text(); // RAW body is required for signature verification.
  return runWithRequestContext({ requestId: request.headers.get("x-request-id") ?? undefined }, async () => {
    try {
      const result = await getServices().webhookIngestion.ingest(provider, rawBody, request.headers);
      return NextResponse.json({ received: true, duplicate: result.duplicate });
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        logger.warn({ provider }, "webhook signature rejected");
        return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
      }
      if (err instanceof Error && err.message.includes("is not enabled")) {
        return NextResponse.json({ error: "provider_disabled" }, { status: 404 });
      }
      logger.error({ err, provider }, "webhook ingestion failed");
      // 5xx makes the provider retry; nothing was acknowledged.
      return NextResponse.json({ error: "ingestion_failed" }, { status: 500 });
    }
  });
}
