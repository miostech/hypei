import type { DbClient } from "@/lib/database/postgres/client";
import type { Prisma, Refund } from "@/generated/prisma/client";

export interface RefundRepository {
  findByIdempotencyKey(key: string): Promise<Refund | null>;
  findByProviderRefundId(providerRefundId: string): Promise<Refund | null>;
  findById(id: string): Promise<Refund | null>;
  create(input: {
    organizationId: string;
    paymentId: string;
    amount: bigint;
    currency: string;
    reason?: string | null;
    idempotencyKey: string;
    providerRefundId?: string | null;
  }): Promise<Refund>;
  update(id: string, data: Prisma.RefundUncheckedUpdateInput): Promise<Refund>;
  /** Sum of refunds that are committed or in flight (anything not FAILED). */
  committedAmount(paymentId: string): Promise<bigint>;
}

export class PrismaRefundRepository implements RefundRepository {
  constructor(private readonly db: DbClient) {}

  findByIdempotencyKey(key: string) {
    return this.db.refund.findUnique({ where: { idempotencyKey: key } });
  }

  findByProviderRefundId(providerRefundId: string) {
    return this.db.refund.findUnique({ where: { providerRefundId } });
  }

  findById(id: string) {
    return this.db.refund.findUnique({ where: { id } });
  }

  create(input: {
    organizationId: string;
    paymentId: string;
    amount: bigint;
    currency: string;
    reason?: string | null;
    idempotencyKey: string;
    providerRefundId?: string | null;
  }) {
    return this.db.refund.create({ data: { ...input, status: "REQUESTED" } });
  }

  update(id: string, data: Prisma.RefundUncheckedUpdateInput) {
    return this.db.refund.update({ where: { id }, data });
  }

  async committedAmount(paymentId: string) {
    const result = await this.db.refund.aggregate({
      where: { paymentId, status: { not: "FAILED" } },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0n;
  }
}
