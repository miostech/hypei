import type { DbClient } from "@/lib/database/postgres/client";
import type { Affiliate, AffiliateCommission, Affiliation, Prisma } from "@/generated/prisma/client";

export type ProductSummary = { id: string; name: string; slug: string };

export type AffiliateWithAffiliations = Affiliate & {
  affiliations: (Affiliation & { product: ProductSummary })[];
};

/** Uma afiliação vista pelo lado de quem vende: o produto e de quem é o produto. */
export type AffiliationWithProduct = Affiliation & {
  product: ProductSummary & { organization: { name: string; slug: string } };
};

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

/**
 * O que um código de indicação resolve na hora do checkout.
 *
 * O `productId` vem junto porque a comissão é por produto: o pedido pode levar um order bump
 * de outro produto, e pagar comissão sobre ele seria pagar por uma venda que não foi dela.
 */
export interface AttributionTarget {
  affiliateId: string;
  affiliationId: string;
  productId: string;
  commissionBps: number;
  organizationId: string;
}

/** O produto que um link de convite abre, com a oferta de comissão que ele anuncia. */
export type InviteTarget = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  affiliateCommissionBps: number | null;
  organization: { name: string; slug: string };
};

export interface AffiliateRepository {
  create(input: Prisma.AffiliateUncheckedCreateInput): Promise<Affiliate>;
  update(organizationId: string, id: string, data: Prisma.AffiliateUncheckedUpdateInput): Promise<Affiliate>;
  findById(organizationId: string, id: string): Promise<AffiliateWithAffiliations | null>;
  findByEmail(organizationId: string, email: string): Promise<Affiliate | null>;
  findByUser(organizationId: string, userId: string): Promise<Affiliate | null>;
  list(organizationId: string): Promise<AffiliateWithAffiliations[]>;
  totals(organizationId: string): Promise<AffiliateTotals[]>;

  createAffiliation(input: { productId: string; affiliateId: string; commissionBps: number; code: string }): Promise<Affiliation>;
  findAffiliation(productId: string, affiliateId: string): Promise<Affiliation | null>;
  findAffiliationById(id: string): Promise<Affiliation | null>;
  findAffiliationByCode(code: string): Promise<AttributionTarget | null>;
  setAffiliationStatus(id: string, status: Affiliation["status"]): Promise<void>;
  registerClick(code: string): Promise<void>;
  /** As afiliações de uma pessoa, em todos os produtores. A área dela é montada daqui. */
  listAffiliationsForUser(userId: string): Promise<AffiliationWithProduct[]>;

  /** O produto por trás de um link de convite, se ele ainda aceita afiliados. */
  findProductByInviteCode(code: string): Promise<InviteTarget | null>;

  createCommission(input: Prisma.AffiliateCommissionUncheckedCreateInput): Promise<AffiliateCommission>;
  findCommissionByOrder(orderId: string): Promise<AffiliateCommission | null>;
  updateCommission(id: string, data: Prisma.AffiliateCommissionUncheckedUpdateInput): Promise<AffiliateCommission>;
  /** Commissions of payments whose settlement window has closed. */
  markSettledCommissions(paymentIds: string[]): Promise<number>;
  listCommissions(organizationId: string, limit: number): Promise<CommissionListItem[]>;
  listPayable(organizationId: string, affiliateId: string): Promise<AffiliateCommission[]>;
  /** As comissões de uma pessoa, olhando pela conta que recebe — não pela que paga. */
  listCommissionsForPayee(payeeOrganizationId: string, limit: number): Promise<CommissionListItem[]>;
}

const AFFILIATION_INCLUDE = { product: { select: { id: true, name: true, slug: true } } } as const;

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
      include: { affiliations: { include: AFFILIATION_INCLUDE } },
    });
  }

  findByEmail(organizationId: string, email: string) {
    return this.db.affiliate.findFirst({ where: { organizationId, email: email.toLowerCase() } });
  }

  findByUser(organizationId: string, userId: string) {
    return this.db.affiliate.findFirst({ where: { organizationId, userId } });
  }

  list(organizationId: string) {
    return this.db.affiliate.findMany({
      where: { organizationId },
      include: { affiliations: { include: AFFILIATION_INCLUDE } },
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

  createAffiliation(input: { productId: string; affiliateId: string; commissionBps: number; code: string }) {
    return this.db.affiliation.create({ data: input });
  }

  findAffiliation(productId: string, affiliateId: string) {
    return this.db.affiliation.findUnique({ where: { productId_affiliateId: { productId, affiliateId } } });
  }

  /**
   * A afiliação ativa, pelo id. Devolve null quando ela foi encerrada ou a pessoa foi
   * desativada: quem chama na hora de pagar precisa do estado de agora, não do da venda.
   */
  async findAffiliationById(id: string) {
    const affiliation = await this.db.affiliation.findFirst({
      where: { id, status: "ACTIVE", affiliate: { active: true } },
    });
    return affiliation;
  }

  async findAffiliationByCode(code: string): Promise<AttributionTarget | null> {
    const affiliation = await this.db.affiliation.findUnique({
      where: { code },
      include: { affiliate: { select: { id: true, active: true, organizationId: true } } },
    });
    // As duas condições importam: o produtor pode desativar a pessoa inteira, ou encerrar
    // apenas a afiliação a um produto. Qualquer das duas para de atribuir vendas novas.
    if (!affiliation || affiliation.status !== "ACTIVE" || !affiliation.affiliate.active) return null;
    return {
      affiliateId: affiliation.affiliate.id,
      affiliationId: affiliation.id,
      productId: affiliation.productId,
      commissionBps: affiliation.commissionBps,
      organizationId: affiliation.affiliate.organizationId,
    };
  }

  async setAffiliationStatus(id: string, status: Affiliation["status"]) {
    await this.db.affiliation.update({ where: { id }, data: { status } });
  }

  async registerClick(code: string) {
    await this.db.affiliation.updateMany({ where: { code }, data: { clicks: { increment: 1 } } });
  }

  listAffiliationsForUser(userId: string) {
    return this.db.affiliation.findMany({
      where: { affiliate: { userId } },
      include: {
        product: { select: { id: true, name: true, slug: true, organization: { select: { name: true, slug: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findProductByInviteCode(code: string) {
    return this.db.product.findFirst({
      where: { affiliateInviteCode: code, affiliationEnabled: true },
      select: {
        id: true,
        name: true,
        slug: true,
        organizationId: true,
        affiliateCommissionBps: true,
        organization: { select: { name: true, slug: true } },
      },
    });
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

  listCommissionsForPayee(payeeOrganizationId: string, limit: number) {
    return this.db.affiliateCommission.findMany({
      where: { affiliate: { payeeOrganizationId } },
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
}
