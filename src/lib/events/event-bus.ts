import { logger } from "@/lib/logger";
import type { DomainEvent, DomainEventType } from "./domain-event";

export type DomainEventHandler = (event: DomainEvent) => Promise<void> | void;

/**
 * Publish/subscribe abstraction. Phase 1 runs in-process; a Redis/BullMQ-backed
 * implementation can replace it without touching publishers or subscribers.
 */
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(type: DomainEventType | "*", handler: DomainEventHandler): () => void;
}

export class InProcessEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();

  subscribe(type: DomainEventType | "*", handler: DomainEventHandler) {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const targets = [...(this.handlers.get(event.type) ?? []), ...(this.handlers.get("*") ?? [])];
    const results = await Promise.allSettled(targets.map((h) => h(event)));
    for (const r of results) {
      if (r.status === "rejected") {
        logger.error({ err: r.reason, eventType: event.type, eventId: event.id }, "domain event handler failed");
      }
    }
    if (results.some((r) => r.status === "rejected")) {
      throw new Error(`One or more handlers failed for ${event.type}`);
    }
  }
}
