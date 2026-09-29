import type { DbClient } from "@/lib/database/postgres/client";
import type { OutboxEvent } from "@/generated/prisma/client";
import type { DomainEvent } from "./domain-event";

/** A claim older than this is assumed to belong to a relay that died mid-publish. */
const STALE_CLAIM_MINUTES = 5;
const MAX_ATTEMPTS = 10;

export interface OutboxRepository {
  /** Must be called with the SAME transaction as the state change it describes. */
  add(event: DomainEvent): Promise<void>;
  /**
   * Atomically reserves pending events for this relay. Two relays running at the
   * same time — two instances, or a scheduled tick overlapping a request — never
   * get the same row, so handlers are not invoked twice for one event.
   */
  claimPending(limit: number): Promise<OutboxEvent[]>;
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

  /**
   * `FOR UPDATE SKIP LOCKED` is what makes the claim safe: concurrent relays skip
   * the rows another transaction already holds instead of blocking or duplicating.
   */
  claimPending(limit: number): Promise<OutboxEvent[]> {
    return this.db.$queryRaw<OutboxEvent[]>`
      UPDATE "OutboxEvent" AS target
      SET status = 'PUBLISHING', "claimedAt" = now(), attempts = target.attempts + 1
      FROM (
        SELECT id FROM "OutboxEvent"
        WHERE attempts < ${MAX_ATTEMPTS}
          AND (
            status IN ('PENDING', 'FAILED')
            OR (status = 'PUBLISHING' AND "claimedAt" < now() - ${`${STALE_CLAIM_MINUTES} minutes`}::interval)
          )
        ORDER BY "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      ) AS claimed
      WHERE target.id = claimed.id
      RETURNING target.*`;
  }

  async markPublished(id: string) {
    await this.db.outboxEvent.update({ where: { id }, data: { status: "PUBLISHED", processedAt: new Date() } });
  }

  async markFailed(id: string) {
    await this.db.outboxEvent.update({ where: { id }, data: { status: "FAILED" } });
  }
}
