import type { DbClient } from "@/lib/database/postgres/client";
import type { OutboxEvent } from "@/generated/prisma/client";
import type { DomainEvent } from "./domain-event";

export interface OutboxRepository {
  /** Must be called with the SAME transaction as the state change it describes. */
  add(event: DomainEvent): Promise<void>;
  fetchPending(limit: number): Promise<OutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}

export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly db: DbClient) {}

  async add(event: DomainEvent) {
    await this.db.outboxEvent.create({
      data: {
        id: event.id,
        type: event.type,
        aggregateId: event.aggregateId,
        payload: JSON.parse(JSON.stringify(event.payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v))),
        createdAt: event.occurredAt,
      },
    });
  }

  fetchPending(limit: number) {
    return this.db.outboxEvent.findMany({
      where: { status: { in: ["PENDING", "FAILED"] }, attempts: { lt: 10 } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async markPublished(id: string) {
    await this.db.outboxEvent.update({ where: { id }, data: { status: "PUBLISHED", processedAt: new Date(), attempts: { increment: 1 } } });
  }

  async markFailed(id: string) {
    await this.db.outboxEvent.update({ where: { id }, data: { status: "FAILED", attempts: { increment: 1 } } });
  }
}
