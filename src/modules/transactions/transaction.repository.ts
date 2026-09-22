import type { DbClient } from "@/lib/database/postgres/client";
import type { PaymentProviderType, TransactionStatus, TransactionType } from "@/generated/prisma/client";

export interface RecordTransactionInput {
  organizationId: string;
  paymentId?: string | null;
  provider: PaymentProviderType;
  providerTransactionId: string;
  type: TransactionType;
  amount: bigint;
  currency: string;
  status: TransactionStatus;
  occurredAt: Date;
  metadata?: Record<string, string>;
}

export interface TransactionRepository {
  /** Idempotent on (provider, providerTransactionId, type). */
  record(input: RecordTransactionInput): Promise<void>;
}

export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly db: DbClient) {}

  async record(input: RecordTransactionInput) {
    const { provider, providerTransactionId, type } = input;
    await this.db.transaction.upsert({
      where: { provider_providerTransactionId_type: { provider, providerTransactionId, type } },
      create: input,
      update: {},
    });
  }
}
