import type { Db } from "mongodb";
import { COLLECTIONS } from "@/lib/database/mongo/collections";

export interface ProviderSnapshot {
  provider: string;
  objectType: string;
  objectId: string;
  organizationId?: string | null;
  data: unknown;
}

/** Point-in-time copies of provider objects (merchant accounts, payouts…) for audits/debugging. */
export interface ProviderSnapshotRepository {
  record(snapshot: ProviderSnapshot): Promise<void>;
}

export class MongoProviderSnapshotRepository implements ProviderSnapshotRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  async record(snapshot: ProviderSnapshot) {
    await (await this.db()).collection(COLLECTIONS.providerSnapshots).insertOne({ ...snapshot, capturedAt: new Date() });
  }
}
