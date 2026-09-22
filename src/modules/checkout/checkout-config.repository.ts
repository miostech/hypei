import type { Db } from "mongodb";
import { COLLECTIONS } from "@/lib/database/mongo/collections";
import type { CheckoutConfig } from "./checkout-config.schema";

export interface CheckoutConfigVersion {
  checkoutId: string;
  organizationId: string;
  version: number;
  config: CheckoutConfig;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Versioned, append-only checkout presentation. Every change creates a new version,
 * so an Order can always point at the exact version the buyer saw.
 */
export interface CheckoutConfigRepository {
  createVersion(input: { checkoutId: string; organizationId: string; version: number; config: CheckoutConfig }): Promise<CheckoutConfigVersion>;
  getVersion(checkoutId: string, version: number): Promise<CheckoutConfigVersion | null>;
  latest(checkoutId: string): Promise<CheckoutConfigVersion | null>;
}

export class MongoCheckoutConfigRepository implements CheckoutConfigRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  private async collection() {
    return (await this.db()).collection<CheckoutConfigVersion>(COLLECTIONS.checkoutConfigs);
  }

  async createVersion(input: { checkoutId: string; organizationId: string; version: number; config: CheckoutConfig }) {
    const now = new Date();
    const doc: CheckoutConfigVersion = { ...input, createdAt: now, updatedAt: now };
    await (await this.collection()).insertOne({ ...doc });
    return doc;
  }

  async getVersion(checkoutId: string, version: number) {
    return (await this.collection()).findOne({ checkoutId, version }, { projection: { _id: 0 } });
  }

  async latest(checkoutId: string) {
    return (await this.collection()).findOne({ checkoutId }, { sort: { version: -1 }, projection: { _id: 0 } });
  }
}

export class InMemoryCheckoutConfigRepository implements CheckoutConfigRepository {
  readonly docs: CheckoutConfigVersion[] = [];

  async createVersion(input: { checkoutId: string; organizationId: string; version: number; config: CheckoutConfig }) {
    if (this.docs.some((d) => d.checkoutId === input.checkoutId && d.version === input.version)) {
      throw new Error("duplicate checkout version");
    }
    const doc = { ...input, createdAt: new Date(), updatedAt: new Date() };
    this.docs.push(doc);
    return doc;
  }

  async getVersion(checkoutId: string, version: number) {
    return this.docs.find((d) => d.checkoutId === checkoutId && d.version === version) ?? null;
  }

  async latest(checkoutId: string) {
    return this.docs.filter((d) => d.checkoutId === checkoutId).sort((a, b) => b.version - a.version)[0] ?? null;
  }
}
