import type { Db } from "mongodb";
import { COLLECTIONS } from "@/lib/database/mongo/collections";

export const CHECKOUT_EVENT_TYPES = [
  "checkout.viewed",
  "checkout.started",
  "checkout.customer_created",
  "checkout.payment_started",
  "checkout.payment_failed",
  "checkout.completed",
] as const;

export type CheckoutEventType = (typeof CHECKOUT_EVENT_TYPES)[number];

export interface AnalyticsEvent {
  eventType: CheckoutEventType | string;
  organizationId: string;
  checkoutId?: string | null;
  sessionId: string;
  customerId?: string | null;
  orderId?: string | null;
  tracking: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    referrer?: string | null;
    affiliateId?: string | null;
  };
  properties?: Record<string, unknown>;
  createdAt: Date;
}

export interface AnalyticsEventRepository {
  record(event: AnalyticsEvent): Promise<void>;
  countByType(organizationId: string, since: Date): Promise<Record<string, number>>;
  topSources(organizationId: string, since: Date, limit: number): Promise<{ source: string; count: number }[]>;
}

export class MongoAnalyticsEventRepository implements AnalyticsEventRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  private async collection() {
    return (await this.db()).collection<AnalyticsEvent>(COLLECTIONS.analyticsEvents);
  }

  async record(event: AnalyticsEvent) {
    await (await this.collection()).insertOne({ ...event });
  }

  async countByType(organizationId: string, since: Date) {
    const rows = await (await this.collection())
      .aggregate<{ _id: string; count: number }>([
        { $match: { organizationId, createdAt: { $gte: since } } },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
      ])
      .toArray();
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }

  async topSources(organizationId: string, since: Date, limit: number) {
    const rows = await (await this.collection())
      .aggregate<{ _id: string | null; count: number }>([
        { $match: { organizationId, eventType: "checkout.viewed", createdAt: { $gte: since } } },
        { $group: { _id: "$tracking.utm_source", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ])
      .toArray();
    return rows.map((r) => ({ source: r._id ?? "direto", count: r.count }));
  }
}

export class InMemoryAnalyticsEventRepository implements AnalyticsEventRepository {
  readonly events: AnalyticsEvent[] = [];
  async record(event: AnalyticsEvent) {
    this.events.push(event);
  }
  async countByType(organizationId: string) {
    const out: Record<string, number> = {};
    for (const e of this.events.filter((x) => x.organizationId === organizationId)) out[e.eventType] = (out[e.eventType] ?? 0) + 1;
    return out;
  }
  async topSources() {
    return [];
  }
}
