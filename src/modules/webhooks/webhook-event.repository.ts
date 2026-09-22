import type { DbClient } from "@/lib/database/postgres/client";
import { isUniqueViolation } from "@/lib/database/postgres/client";
import type { PaymentProviderType, WebhookEvent, WebhookEventStatus } from "@/generated/prisma/client";

export interface WebhookEventRepository {
  /** Inserts the event unless (provider, providerEventId) already exists. */
  insertIfAbsent(input: { provider: PaymentProviderType; providerEventId: string; eventType: string }): Promise<{ event: WebhookEvent; created: boolean }>;
  findById(id: string): Promise<WebhookEvent | null>;
  /** Atomically claims an event for processing (prevents two workers processing it). */
  claim(id: string): Promise<WebhookEvent | null>;
  markFinished(id: string, status: Extract<WebhookEventStatus, "PROCESSED" | "IGNORED">): Promise<void>;
  markFailed(id: string, error: string, nextAttemptAt: Date | null): Promise<void>;
  findRetryable(now: Date, maxAttempts: number, limit: number): Promise<WebhookEvent[]>;
}

export class PrismaWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly db: DbClient) {}

  async insertIfAbsent(input: { provider: PaymentProviderType; providerEventId: string; eventType: string }) {
    const where = { provider_providerEventId: { provider: input.provider, providerEventId: input.providerEventId } };
    const existing = await this.db.webhookEvent.findUnique({ where });
    if (existing) return { event: existing, created: false };
    try {
      return { event: await this.db.webhookEvent.create({ data: input }), created: true };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return { event: await this.db.webhookEvent.findUniqueOrThrow({ where }), created: false };
    }
  }

  findById(id: string) {
    return this.db.webhookEvent.findUnique({ where: { id } });
  }

  async claim(id: string) {
    const result = await this.db.webhookEvent.updateMany({
      where: { id, status: { in: ["RECEIVED", "FAILED"] } },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    return result.count === 1 ? this.findById(id) : null;
  }

  async markFinished(id: string, status: "PROCESSED" | "IGNORED") {
    await this.db.webhookEvent.update({ where: { id }, data: { status, processedAt: new Date(), error: null, nextAttemptAt: null } });
  }

  async markFailed(id: string, error: string, nextAttemptAt: Date | null) {
    await this.db.webhookEvent.update({ where: { id }, data: { status: "FAILED", error: error.slice(0, 2000), nextAttemptAt } });
  }

  findRetryable(now: Date, maxAttempts: number, limit: number) {
    return this.db.webhookEvent.findMany({
      where: {
        OR: [
          { status: "FAILED", attempts: { lt: maxAttempts }, nextAttemptAt: { lte: now } },
          // Received but never processed (e.g. process crashed before the queue ran it).
          { status: "RECEIVED", receivedAt: { lte: new Date(now.getTime() - 60_000) } },
        ],
      },
      orderBy: { receivedAt: "asc" },
      take: limit,
    });
  }
}
