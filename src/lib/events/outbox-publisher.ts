import { logger } from "@/lib/logger";
import type { DomainEvent, DomainEventType } from "./domain-event";
import type { EventBus } from "./event-bus";
import type { OutboxRepository } from "./outbox.repository";

/**
 * Transactional outbox relay: reads events committed together with state changes
 * and publishes them. Guarantees "DB updated ⇒ event eventually published" (at-least-once).
 */
export class OutboxPublisher {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly bus: EventBus,
  ) {}

  async publishPending(limit = 100): Promise<number> {
    const pending = await this.outbox.claimPending(limit);
    let published = 0;
    for (const row of pending) {
      const payload = row.payload as Record<string, unknown>;
      const event: DomainEvent = {
        id: row.id,
        type: row.type as DomainEventType,
        aggregateId: row.aggregateId,
        organizationId: (payload.organizationId as string | null) ?? null,
        occurredAt: row.createdAt,
        payload,
      };
      try {
        await this.bus.publish(event);
        await this.outbox.markPublished(row.id);
        published++;
      } catch (err) {
        logger.warn({ err, outboxId: row.id, type: row.type }, "outbox publish failed; will retry");
        await this.outbox.markFailed(row.id);
      }
    }
    return published;
  }
}
