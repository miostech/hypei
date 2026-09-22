import type { Db } from "mongodb";
import { COLLECTIONS } from "@/lib/database/mongo/collections";

export interface RiskEvent {
  organizationId: string;
  signal: string;
  score: number;
  data: Record<string, unknown>;
}

export interface RiskEventRepository {
  record(event: RiskEvent): Promise<void>;
}

export class MongoRiskEventRepository implements RiskEventRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  async record(event: RiskEvent) {
    await (await this.db()).collection(COLLECTIONS.riskEvents).insertOne({ ...event, createdAt: new Date() });
  }
}
