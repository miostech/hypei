import type { DbClient } from "@/lib/database/postgres/client";
import type { Affiliate, AffiliateCommission, AffiliateLink, Prisma } from "@/generated/prisma/client";

export type AffiliateWithLinks = Affiliate & { links: (AffiliateLink & { checkout: { slug: string; name: string } | null })[] };

export interface AffiliateTotals {
  affiliateId: string;
  sales: number;
  /** Commission still inside the settlement window. */
  pending: bigint;
  /** Settled and waiting to be paid to the affiliate. */
  available: bigint;
  paid: bigint;
}

export type CommissionListItem = AffiliateCommission & {
  affiliate: { id: string; name: string; email: string };
  order: { id: string; customer: { name: string; email: string }; items: { productName: string }[] };
};

/** What a referral code resolves to at checkout time. */
export interface AttributionTarget {
  affiliateId: string;
  linkId: string;
  commissionBps: number;
  organizationId: string;
}

export interface AffiliateRepository {
  create(input: Prisma.AffiliateUncheckedCreateInput): Promise<Affiliate>;
  update(organizationId: string, id: string, data: Prisma.AffiliateUncheckedUpdateInput): Promise<Affiliate>;
  findById(organizationId: string, id: string): Promise<AffiliateWithLinks | null>;
  findByEmail(organizationId: string, email: string): Promise<Affiliate | null>;
  list(organizationId: string): Promise<AffiliateWithLinks[]>;
  totals(organizationId: string): Promise<AffiliateTotals[]>;

  createLink(input: { affiliateId: string; code: string; checkoutId: string | null }): Promise<AffiliateLink>;
  findLinkByCode(code: string): Promise<AttributionTarget | null>;
  registerClick(code: string): Promise<void>;

  createCommission(input: Prisma.AffiliateCommissionUncheckedCreateInput): Promise<AffiliateCommission>;
  findCommissionByOrder(orderId: string): Promise<AffiliateCommission | null>;
  updateCommission(id: string, data: Prisma.AffiliateCommissionUncheckedUpdateInput): Promise<AffiliateCommission>;
  /** Commissions of payments whose settlement window has closed. */
  markSettledCommissions(paymentIds: string[]): Promise<number>;
  listCommissions(organizationId: string, limit: number): Promise<CommissionListItem[]>;
  listPayable(organizationId: string, affiliateId: string): Promise<AffiliateCommission[]>;
}

export class PrismaAffiliateRepository implements AffiliateRepository {
  constructor(private readonly db: DbClient) {}

  create(input: Prisma.AffiliateUncheckedCreateInput) {
    return this.db.affiliate.create({ data: input });
  }

  async update(organizationId: string, id: string, data: Prisma.AffiliateUncheckedUpdateInput) {
    const result = await this.db.affiliate.updateMany({ where: { id, organizationId }, data });
    if (result.count === 0) throw new Error(`Affiliate ${id} not found in organization ${organizationId}`);
    return this.db.affiliate.findUniqueOrThrow({ where: { id } });
  }

  findById(organizationId: string, id: string) {
    return this.db.affiliate.findFirst({
      where: { id, organizationId },
      include: { links: { include: { checkout: { select: { slug: true, name: true } } } } },
    });
  }

  findByEmail(organizationId: string, email: string) {
    return this.db.affiliate.findFirst({ where: { organizationId, email: email.toLowerCase() } });
  }

  list(organizationId: string) {
    return this.db.affiliate.findMany({
      where: { organizationId },
      include: { links: { include: { checkout: { select: { slug: true, name: true } } } } },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    });
  }

  async totals(organizationId: string): Promise<AffiliateTotals[]> {
    const rows = await this.db.affiliateCommission.groupBy({
      by: ["affiliateId", "status"],
      where: { organizationId },
      _sum: { amount: true, reversedAmount: true },
      _count: true,
    });

    const totals = new Map<string, AffiliateTotals>();
    for (const row of rows) {
      const entry = totals.get(row.affiliateId) ?? { affiliateId: row.affiliateId, sales: 0, pending: 0n, available: 0n, paid: 0n };
      const net = (row._sum.amount ?? 0n) - (row._sum.reversedAmount ?? 0n);
      if (row.status !== "CANCELED") entry.sales += row._count;
      if (row.status === "PENDING") entry.pending += net;
      if (row.status === "AVAILABLE" || row.status === "APPROVED") entry.available += net;
      if (row.status === "PAID") entry.paid += net;
      totals.set(row.affiliateId, entry);
    }
    return [...totals.values()];
  }

  createLink(input: { affiliateId: string; code: string; checkoutId: string | null }) {
    return this.db.affiliateLink.create({ data: input });
  }

  async findLinkByCode(code: string): Promise<AttributionTarget | null> {
    const link = await this.db.affiliateLink.findUnique({
      where: { code },
      include: { affiliate: { select: { id: true, commissionBps: true, active: true, organizationId: true } } },
    });
    if (!link || !link.affiliate.active) return null;
    return {
      affiliateId: link.affiliate.id,
      linkId: link.id,
      commissionBps: link.affiliate.commissionBps,
      organizationId: link.affiliate.organizationId,
    };
  }

  async registerClick(code: string) {
    await this.db.affiliateLink.updateMany({ where: { code }, data: { clicks: { increment: 1 } } });
  }

  createCommission(input: Prisma.AffiliateCommissionUncheckedCreateInput) {
    return this.db.affiliateCommission.create({ data: input });
  }

  findCommissionByOrder(orderId: string) {
    return this.db.affiliateCommission.findFirst({ where: { orderId } });
  }

  updateCommission(id: string, data: Prisma.AffiliateCommissionUncheckedUpdateInput) {
    return this.db.affiliateCommission.update({ where: { id }, data });
  }

  async markSettledCommissions(paymentIds: string[]) {
    if (paymentIds.length === 0) return 0;
    const orders = await this.db.payment.findMany({ where: { id: { in: paymentIds } }, select: { orderId: true } });
    const result = await this.db.affiliateCommission.updateMany({
      where: { orderId: { in: orders.map((order) => order.orderId) }, status: "PENDING" },
      data: { status: "AVAILABLE" },
    });
    return result.count;
  }

  listCommissions(organizationId: string, limit: number) {
    return this.db.affiliateCommission.findMany({
      where: { organizationId },
      include: {
        affiliate: { select: { id: true, name: true, email: true } },
        order: {
          select: { id: true, customer: { select: { name: true, email: true } }, items: { select: { productName: true }, take: 1 } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  listPayable(organizationId: string, affiliateId: string) {
    return this.db.affiliateCommission.findMany({
      where: { organizationId, affiliateId, status: { in: ["AVAILABLE", "APPROVED"] } },
    });
  }
}
