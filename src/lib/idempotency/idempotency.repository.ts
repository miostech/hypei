import type { DbClient } from "@/lib/database/postgres/client";
import { isUniqueViolation } from "@/lib/database/postgres/client";

export interface IdempotencyRecord {
  key: string;
  scope: string;
  requestHash: string;
  responseData: unknown;
  expiresAt: Date;
}

export interface IdempotencyRepository {
  find(key: string): Promise<IdempotencyRecord | null>;
  /** Returns false if the key already exists. */
  tryInsert(record: Omit<IdempotencyRecord, "responseData">): Promise<boolean>;
  saveResponse(key: string, responseData: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export class PrismaIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly db: DbClient) {}

  find(key: string) {
    return this.db.idempotencyKey.findUnique({ where: { key } });
  }

  async tryInsert(record: Omit<IdempotencyRecord, "responseData">) {
    try {
      await this.db.idempotencyKey.create({ data: record });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  async saveResponse(key: string, responseData: unknown) {
    await this.db.idempotencyKey.update({ where: { key }, data: { responseData: responseData as object } });
  }

  async delete(key: string) {
    await this.db.idempotencyKey.deleteMany({ where: { key } });
  }
}
