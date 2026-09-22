import type { PaymentProviderType } from "@/generated/prisma/enums";
import { logger } from "@/lib/logger";
import type { JobQueue } from "@/lib/providers/queue/job-queue";
import type { PaymentProvider } from "@/lib/providers/payment/types";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { WebhookPayloadRepository } from "./webhook-payload.repository";

export const WEBHOOK_JOB = "webhooks.process";

export interface IngestResult {
  webhookEventId: string;
  duplicate: boolean;
}

/**
 * HTTP-side of webhooks: receive → verify signature → persist (dedupe) → enqueue → respond.
 * No financial logic runs here.
 */
export class WebhookIngestionService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly providers: Partial<Record<PaymentProviderType, PaymentProvider>>,
    private readonly payloads: WebhookPayloadRepository,
    private readonly queue: JobQueue,
  ) {}

  async ingest(providerType: PaymentProviderType, rawBody: string, headers: Headers): Promise<IngestResult> {
    const provider = this.providers[providerType];
    if (!provider) throw new Error(`Payment provider ${providerType} is not enabled`);

    const verified = await provider.verifyWebhook(rawBody, headers); // throws WebhookSignatureError

    // Archive first (idempotent upsert) so the processor always finds the payload.
    await this.payloads.save({
      provider: verified.provider,
      eventId: verified.eventId,
      eventType: verified.eventType,
      payload: verified.payload,
      receivedAt: new Date(),
    });

    const { event, created } = await this.uow.repos.webhookEvents.insertIfAbsent({
      provider: verified.provider,
      providerEventId: verified.eventId,
      eventType: verified.eventType,
    });

    const needsProcessing = created || event.status === "RECEIVED" || event.status === "FAILED";
    if (needsProcessing) {
      await this.queue.enqueue(WEBHOOK_JOB, { webhookEventId: event.id }, { jobId: event.id });
    } else {
      logger.info({ provider: providerType, eventId: verified.eventId }, "duplicate webhook ignored");
    }
    return { webhookEventId: event.id, duplicate: !created };
  }
}
