import type { Db } from "mongodb";

/**
 * MongoDB holds flexible/document/event data ONLY. It is never the single source
 * of truth for money: prices come from Offer (Postgres), balances from the ledger.
 */
export const COLLECTIONS = {
  checkoutConfigs: "checkout_configs",
  analyticsEvents: "analytics_events",
  webhookPayloads: "webhook_payloads",
  providerSnapshots: "provider_snapshots",
  activityEvents: "activity_events",
  riskEvents: "risk_events",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Idempotent index setup — run by `npm run mongo:setup` and on first use in dev. */
export async function ensureMongoIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection(COLLECTIONS.checkoutConfigs).createIndexes([
      { key: { checkoutId: 1, version: 1 }, unique: true, name: "checkout_version_unique" },
      { key: { organizationId: 1, checkoutId: 1, version: -1 }, name: "org_checkout_latest" },
    ]),
    db.collection(COLLECTIONS.analyticsEvents).createIndexes([
      { key: { organizationId: 1, eventType: 1, createdAt: -1 }, name: "org_type_time" },
      { key: { sessionId: 1, createdAt: 1 }, name: "session_time" },
      { key: { customerId: 1, createdAt: -1 }, name: "customer_time", sparse: true },
      { key: { checkoutId: 1, createdAt: -1 }, name: "checkout_time" },
      { key: { createdAt: -1 }, name: "time" },
    ]),
    db.collection(COLLECTIONS.webhookPayloads).createIndexes([
      { key: { provider: 1, eventId: 1 }, unique: true, name: "provider_event_unique" },
      { key: { receivedAt: -1 }, name: "received_time" },
    ]),
    db.collection(COLLECTIONS.providerSnapshots).createIndexes([
      { key: { provider: 1, objectType: 1, objectId: 1, capturedAt: -1 }, name: "provider_object_time" },
      { key: { organizationId: 1, capturedAt: -1 }, name: "org_time", sparse: true },
    ]),
    db.collection(COLLECTIONS.activityEvents).createIndexes([
      { key: { organizationId: 1, createdAt: -1 }, name: "org_time" },
      { key: { userId: 1, createdAt: -1 }, name: "user_time" },
    ]),
    db.collection(COLLECTIONS.riskEvents).createIndexes([
      { key: { organizationId: 1, createdAt: -1 }, name: "org_time" },
      { key: { signal: 1, createdAt: -1 }, name: "signal_time" },
    ]),
  ]);
}
