import type { DbClient } from "@/lib/database/postgres/client";

export interface BalanceRecord {
  organizationId: string;
  currency: string;
  pendingAmount: bigint;
  availableAmount: bigint;
  reservedAmount: bigint;
  updatedAt: Date;
}

export interface BalanceRepository {
  /** Row-level lock (SELECT … FOR UPDATE) serializing money-out operations per org+currency. */
  lock(organizationId: string, currency: string): Promise<void>;
  save(record: Omit<BalanceRecord, "updatedAt">): Promise<BalanceRecord>;
  find(organizationId: string, currency: string): Promise<BalanceRecord | null>;
  listByOrganization(organizationId: string): Promise<BalanceRecord[]>;
}

export class PrismaBalanceRepository implements BalanceRepository {
  constructor(private readonly db: DbClient) {}

  async lock(organizationId: string, currency: string): Promise<void> {
    await this.db.balance.upsert({
      where: { organizationId_currency: { organizationId, currency } },
      create: { organizationId, currency },
      update: {},
    });
    await this.db.$queryRaw`SELECT id FROM "Balance" WHERE "organizationId" = ${organizationId} AND currency = ${currency} FOR UPDATE`;
  }

  save(record: Omit<BalanceRecord, "updatedAt">) {
    const { organizationId, currency, ...amounts } = record;
    return this.db.balance.upsert({
      where: { organizationId_currency: { organizationId, currency } },
      create: record,
      update: amounts,
    });
  }

  find(organizationId: string, currency: string) {
    return this.db.balance.findUnique({ where: { organizationId_currency: { organizationId, currency } } });
  }

  listByOrganization(organizationId: string) {
    return this.db.balance.findMany({ where: { organizationId }, orderBy: { currency: "asc" } });
  }
}
