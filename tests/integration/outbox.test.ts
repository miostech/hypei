import { beforeEach, describe, expect, it } from "vitest";
import { createDomainEvent, type DomainEvent } from "@/lib/events/domain-event";
import type { EventBus } from "@/lib/events/event-bus";
import { OutboxPublisher } from "@/lib/events/outbox-publisher";
import { PrismaOutboxRepository } from "@/lib/events/outbox.repository";
import { resetDatabase, testPrisma } from "../support/test-app";

/** Records what it was asked to publish, slowly enough for relays to overlap. */
class RecordingBus implements EventBus {
  readonly published: string[] = [];
  failOn = new Set<string>();

  async publish(event: DomainEvent) {
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (this.failOn.has(event.id)) throw new Error("handler failed");
    this.published.push(event.id);
  }

  subscribe() {
    return () => {};
  }
}

describe("Outbox relay", () => {
  const prisma = testPrisma();
  const repository = new PrismaOutboxRepository(prisma);

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function seed(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let index = 0; index < count; index++) {
      const event = createDomainEvent("payment.paid", `payment-${index}`, null, { index });
      await repository.add(event);
      ids.push(event.id);
    }
    return ids;
  }

  it("publishes each event exactly once when relays run concurrently", async () => {
    const ids = await seed(6);
    const bus = new RecordingBus();
    const publisher = new OutboxPublisher(repository, bus);

    // Three relays at once: two app instances plus an overlapping tick.
    await Promise.all([publisher.publishPending(), publisher.publishPending(), publisher.publishPending()]);

    expect([...bus.published].sort()).toEqual([...ids].sort());
    const rows = await prisma.outboxEvent.findMany();
    expect(rows.every((row) => row.status === "PUBLISHED")).toBe(true);
    expect(rows.every((row) => row.attempts === 1)).toBe(true);
  });

  it("retries an event whose handler failed", async () => {
    const [id] = await seed(1);
    const bus = new RecordingBus();
    bus.failOn.add(id);
    const publisher = new OutboxPublisher(repository, bus);

    await publisher.publishPending();
    expect(bus.published).toHaveLength(0);
    expect(await prisma.outboxEvent.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "FAILED", attempts: 1 });

    bus.failOn.clear();
    await publisher.publishPending();
    expect(bus.published).toEqual([id]);
    expect(await prisma.outboxEvent.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "PUBLISHED", attempts: 2 });
  });

  it("gives up after too many attempts instead of looping forever", async () => {
    const [id] = await seed(1);
    await prisma.outboxEvent.update({ where: { id }, data: { attempts: 10, status: "FAILED" } });

    const bus = new RecordingBus();
    await new OutboxPublisher(repository, bus).publishPending();

    expect(bus.published).toHaveLength(0);
    expect(await prisma.outboxEvent.findUniqueOrThrow({ where: { id } })).toMatchObject({ attempts: 10 });
  });

  it("reclaims an event abandoned by a relay that died mid-publish", async () => {
    const [id] = await seed(1);
    await prisma.outboxEvent.update({
      where: { id },
      data: { status: "PUBLISHING", claimedAt: new Date(Date.now() - 10 * 60_000) },
    });

    const bus = new RecordingBus();
    await new OutboxPublisher(repository, bus).publishPending();

    expect(bus.published).toEqual([id]);
  });

  it("leaves a fresh claim alone", async () => {
    const [id] = await seed(1);
    await prisma.outboxEvent.update({ where: { id }, data: { status: "PUBLISHING", claimedAt: new Date() } });

    const bus = new RecordingBus();
    await new OutboxPublisher(repository, bus).publishPending();

    expect(bus.published).toHaveLength(0);
  });
});
