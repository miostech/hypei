import type { Db } from "mongodb";
import { COLLECTIONS } from "@/lib/database/mongo/collections";

export interface WebhookPayloadDocument {
  provider: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  receivedAt: Date;
}

/** Raw (verified) webhook payload archive. Postgres keeps dedupe/processing state. */
export interface WebhookPayloadRepository {
  save(doc: WebhookPayloadDocument): Promise<void>;
  find(provider: string, eventId: string): Promise<WebhookPayloadDocument | null>;
}

export class MongoWebhookPayloadRepository implements WebhookPayloadRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  private async collection() {
    return (await this.db()).collection<WebhookPayloadDocument>(COLLECTIONS.webhookPayloads);
  }

  async save(doc: WebhookPayloadDocument) {
    await (await this.collection()).updateOne(
      { provider: doc.provider, eventId: doc.eventId },
      { $setOnInsert: doc },
      { upsert: true },
    );
  }

  async find(provider: string, eventId: string) {
    return (await this.collection()).findOne({ provider, eventId }, { projection: { _id: 0 } });
  }
}

export class InMemoryWebhookPayloadRepository implements WebhookPayloadRepository {
  private readonly docs = new Map<string, WebhookPayloadDocument>();
  async save(doc: WebhookPayloadDocument) {
    const key = `${doc.provider}:${doc.eventId}`;
    if (!this.docs.has(key)) this.docs.set(key, doc);
  }
  async find(provider: string, eventId: string) {
    return this.docs.get(`${provider}:${eventId}`) ?? null;
  }
}
