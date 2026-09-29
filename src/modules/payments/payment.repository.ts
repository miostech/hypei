import type { DbClient } from "@/lib/database/postgres/client";
import type { Payment, PaymentMethodType, PaymentProviderType, PaymentStatus, Prisma } from "@/generated/prisma/client";

export interface PaymentRepository {
  create(input: {
    organizationId: string;
    orderId: string;
    customerId: string;
    subscriptionId?: string | null;
    provider: PaymentProviderType;
    amount: bigint;
    currency: string;
    paymentMethod?: PaymentMethodType | null;
    metadata?: Record<string, string>;
  }): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findForOrganization(organizationId: string, id: string): Promise<Payment | null>;
  findByProviderPaymentId(provider: PaymentProviderType, providerPaymentId: string): Promise<Payment | null>;
  /** Row lock serializing all financial transitions of a payment (capture, settle, refund, dispute). */
  lock(id: string): Promise<Payment>;
  update(id: string, data: Prisma.PaymentUncheckedUpdateInput): Promise<Payment>;
  findDueForSettlement(now: Date, limit: number, organizationId?: string): Promise<Pick<Payment, "id">[]>;
  nextSettlementDate(organizationId: string, currency: string): Promise<Date | null>;
  countByStatus(organizationId: string): Promise<Partial<Record<PaymentStatus, number>>>;
}

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly db: DbClient) {}

  create(input: {
    organizationId: string;
    orderId: string;
    customerId: string;
    provider: PaymentProviderType;
    amount: bigint;
    currency: string;
    paymentMethod?: PaymentMethodType | null;
    metadata?: Record<string, string>;
  }) {
    return this.db.payment.create({ data: { ...input, status: "CREATED" } });
  }

  findById(id: string) {
    return this.db.payment.findUnique({ where: { id } });
  }

  findForOrganization(organizationId: string, id: string) {
    return this.db.payment.findFirst({ where: { id, organizationId } });
  }

  findByProviderPaymentId(provider: PaymentProviderType, providerPaymentId: string) {
    return this.db.payment.findUnique({ where: { provider_providerPaymentId: { provider, providerPaymentId } } });
  }

  async lock(id: string) {
    await this.db.$queryRaw`SELECT id FROM "Payment" WHERE id = ${id} FOR UPDATE`;
    return this.db.payment.findUniqueOrThrow({ where: { id } });
  }

  update(id: string, data: Prisma.PaymentUncheckedUpdateInput) {
    return this.db.payment.update({ where: { id }, data });
  }

  findDueForSettlement(now: Date, limit: number, organizationId?: string) {
    return this.db.payment.findMany({
      where: {
        settledAt: null,
        settleAt: { lte: now },
        status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "CHARGEBACK"] },
        ...(organizationId ? { organizationId } : {}),
      },
      select: { id: true },
      orderBy: { settleAt: "asc" },
      take: limit,
    });
  }

  async nextSettlementDate(organizationId: string, currency: string) {
    const next = await this.db.payment.findFirst({
      where: { organizationId, currency, settledAt: null, settleAt: { not: null } },
      orderBy: { settleAt: "asc" },
      select: { settleAt: true },
    });
    return next?.settleAt ?? null;
  }

  async countByStatus(organizationId: string) {
    const rows = await this.db.payment.groupBy({ by: ["status"], where: { organizationId }, _count: true });
    return Object.fromEntries(rows.map((r) => [r.status, r._count])) as Partial<Record<PaymentStatus, number>>;
  }
}
