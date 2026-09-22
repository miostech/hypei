import type { DbClient } from "@/lib/database/postgres/client";
import type { Payout, PaymentProviderType, Prisma } from "@/generated/prisma/client";

export interface PayoutRepository {
  findByIdempotencyKey(key: string): Promise<Payout | null>;
  create(input: {
    organizationId: string;
    amount: bigint;
    currency: string;
    provider: PaymentProviderType;
    idempotencyKey: string;
    requestedById?: string | null;
  }): Promise<Payout>;
  findById(id: string): Promise<Payout | null>;
  findByProviderPayoutId(provider: PaymentProviderType, providerPayoutId: string): Promise<Payout | null>;
  lock(id: string): Promise<Payout>;
  update(id: string, data: Prisma.PayoutUncheckedUpdateInput): Promise<Payout>;
  list(organizationId: string, limit: number): Promise<Payout[]>;
}

export class PrismaPayoutRepository implements PayoutRepository {
  constructor(private readonly db: DbClient) {}

  findByIdempotencyKey(key: string) {
    return this.db.payout.findUnique({ where: { idempotencyKey: key } });
  }

  create(input: {
    organizationId: string;
    amount: bigint;
    currency: string;
    provider: PaymentProviderType;
    idempotencyKey: string;
    requestedById?: string | null;
  }) {
    return this.db.payout.create({ data: { ...input, status: "REQUESTED" } });
  }

  findById(id: string) {
    return this.db.payout.findUnique({ where: { id } });
  }

  findByProviderPayoutId(provider: PaymentProviderType, providerPayoutId: string) {
    return this.db.payout.findUnique({ where: { provider_providerPayoutId: { provider, providerPayoutId } } });
  }

  async lock(id: string) {
    await this.db.$queryRaw`SELECT id FROM "Payout" WHERE id = ${id} FOR UPDATE`;
    return this.db.payout.findUniqueOrThrow({ where: { id } });
  }

  update(id: string, data: Prisma.PayoutUncheckedUpdateInput) {
    return this.db.payout.update({ where: { id }, data });
  }

  list(organizationId: string, limit: number) {
    return this.db.payout.findMany({ where: { organizationId }, orderBy: { requestedAt: "desc" }, take: limit });
  }
}
