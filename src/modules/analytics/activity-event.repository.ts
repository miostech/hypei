import type { Db } from "mongodb";
import { COLLECTIONS } from "@/lib/database/mongo/collections";

export interface ActivityEvent {
  organizationId: string | null;
  userId: string | null;
  type: string;
  data?: Record<string, unknown>;
}

/** Non-critical user activity trail (logins, page-level actions). Not an audit log. */
export interface ActivityEventRepository {
  record(event: ActivityEvent): Promise<void>;
}

export class MongoActivityEventRepository implements ActivityEventRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  async record(event: ActivityEvent) {
    await (await this.db()).collection(COLLECTIONS.activityEvents).insertOne({ ...event, createdAt: new Date() });
  }
}
