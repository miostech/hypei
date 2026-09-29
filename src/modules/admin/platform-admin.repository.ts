import type { DbClient } from "@/lib/database/postgres/client";
import type { DisputeStatus, PayoutStatus } from "@/generated/prisma/enums";

/**
 * The only repository in Ripay that reads ACROSS organizations.
 *
 * Every other query is scoped by organizationId because a producer must never see
 * another producer's data. This one exists for Ripay staff, is read-only, and is
 * reachable solely through the platform admin area.
 */
export interface PlatformAdminRepository {
  organizationCounts(): Promise<{ status: string; count: number }[]>;
  grossVolume(sinceDays: number): Promise<{ currency: string; total: bigint; count: number }[]>;
  accountTotals(account: "PLATFORM_REVENUE" | "PROCESSOR_FEES" | "AFFILIATE_PAYABLE"): Promise<{ currency: string; net: bigint }[]>;
  pendingPayouts(): Promise<{ currency: string; total: bigint; count: number }[]>;
  openDisputeCount(): Promise<number>;
  verificationPendingCount(): Promise<number>;

  listOrganizations(query: string | null, limit: number): Promise<OrganizationRow[]>;
  organizationDetail(id: string): Promise<OrganizationDetail | null>;
  searchPayments(query: string | null, limit: number): Promise<PaymentRow[]>;
  listPayouts(status: PayoutStatus | null, limit: number): Promise<PayoutRow[]>;
  listDisputes(status: DisputeStatus[] | null, limit: number): Promise<DisputeRow[]>;
  revenueByDay(sinceDays: number): Promise<{ day: Date; currency: string; amount: bigint }[]>;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  country: string;
  status: string;
  defaultCurrency: string;
  createdAt: Date;
  merchantStatus: string | null;
  payoutsEnabled: boolean;
  verificationStatus: string | null;
  orders: number;
  products: number;
}

export interface OrganizationDetail extends OrganizationRow {
  legalName: string | null;
  supportEmail: string | null;
  businessType: string;
  members: { email: string; name: string | null; role: string }[];
  taxIdentities: { type: string; maskedValue: string }[];
  balances: { currency: string; available: bigint; pending: bigint; reserved: bigint }[];
  requirementsDue: string[];
  recentPayments: PaymentRow[];
}

export interface PaymentRow {
  id: string;
  organizationId: string;
  organizationName: string;
  customerEmail: string;
  amount: bigint;
  currency: string;
  status: string;
  provider: string;
  providerPaymentId: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

export interface PayoutRow {
  id: string;
  organizationId: string;
  organizationName: string;
  amount: bigint;
  currency: string;
  status: string;
  requestedAt: Date;
  paidAt: Date | null;
  failureReason: string | null;
}

export interface DisputeRow {
  id: string;
  organizationId: string;
  organizationName: string;
  amount: bigint;
  heldAmount: bigint;
  currency: string;
  status: string;
  evidenceDueAt: Date | null;
  createdAt: Date;
}

const PAYMENT_SELECT = {
  id: true,
  organizationId: true,
  amount: true,
  currency: true,
  status: true,
  provider: true,
  providerPaymentId: true,
  createdAt: true,
  paidAt: true,
  organization: { select: { name: true } },
  customer: { select: { email: true } },
} as const;

type PaymentRecord = {
  id: string;
  organizationId: string;
  amount: bigint;
  currency: string;
  status: string;
  provider: string;
  providerPaymentId: string | null;
  createdAt: Date;
  paidAt: Date | null;
  organization: { name: string };
  customer: { email: string };
};

function toPaymentRow(payment: PaymentRecord): PaymentRow {
  return {
    id: payment.id,
    organizationId: payment.organizationId,
    organizationName: payment.organization.name,
    customerEmail: payment.customer.email,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
  };
}

export class PrismaPlatformAdminRepository implements PlatformAdminRepository {
  constructor(private readonly db: DbClient) {}

  async organizationCounts() {
    const rows = await this.db.organization.groupBy({ by: ["status"], _count: true });
    return rows.map((row) => ({ status: row.status, count: row._count }));
  }

  async grossVolume(sinceDays: number) {
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    const rows = await this.db.payment.groupBy({
      by: ["currency"],
      where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, paidAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    });
    return rows.map((row) => ({ currency: row.currency, total: row._sum.amount ?? 0n, count: row._count }));
  }

  /** Net of the account across all organizations (credits minus debits). */
  async accountTotals(account: "PLATFORM_REVENUE" | "PROCESSOR_FEES" | "AFFILIATE_PAYABLE") {
    const rows = await this.db.ledgerEntry.groupBy({
      by: ["currency", "direction"],
      where: { account },
      _sum: { amount: true },
    });

    const totals = new Map<string, bigint>();
    for (const row of rows) {
      const signed = row.direction === "CREDIT" ? (row._sum.amount ?? 0n) : -(row._sum.amount ?? 0n);
      totals.set(row.currency, (totals.get(row.currency) ?? 0n) + signed);
    }
    return [...totals].map(([currency, net]) => ({ currency, net }));
  }

  async pendingPayouts() {
    const rows = await this.db.payout.groupBy({
      by: ["currency"],
      where: { status: { in: ["REQUESTED", "PROCESSING"] } },
      _sum: { amount: true },
      _count: true,
    });
    return rows.map((row) => ({ currency: row.currency, total: row._sum.amount ?? 0n, count: row._count }));
  }

  openDisputeCount() {
    return this.db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } });
  }

  verificationPendingCount() {
    return this.db.organizationVerification.count({ where: { status: { in: ["PENDING", "REQUIRES_ACTION", "NOT_STARTED"] } } });
  }

  async listOrganizations(query: string | null, limit: number) {
    const organizations = await this.db.organization.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
              { legalName: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        merchantAccounts: { take: 1, orderBy: { createdAt: "desc" } },
        verifications: { take: 1, orderBy: { createdAt: "desc" } },
        _count: { select: { orders: true, products: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      country: organization.country,
      status: organization.status,
      defaultCurrency: organization.defaultCurrency,
      createdAt: organization.createdAt,
      merchantStatus: organization.merchantAccounts[0]?.status ?? null,
      payoutsEnabled: organization.merchantAccounts[0]?.payoutsEnabled ?? false,
      verificationStatus: organization.verifications[0]?.status ?? null,
      orders: organization._count.orders,
      products: organization._count.products,
    }));
  }

  async organizationDetail(id: string): Promise<OrganizationDetail | null> {
    const organization = await this.db.organization.findUnique({
      where: { id },
      include: {
        merchantAccounts: { take: 1, orderBy: { createdAt: "desc" } },
        verifications: { take: 1, orderBy: { createdAt: "desc" } },
        members: { include: { user: { select: { email: true, name: true } } } },
        taxIdentities: { select: { type: true, maskedValue: true } },
        balances: true,
        _count: { select: { orders: true, products: true } },
      },
    });
    if (!organization) return null;

    const recentPayments = await this.db.payment.findMany({
      where: { organizationId: id },
      select: PAYMENT_SELECT,
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      country: organization.country,
      status: organization.status,
      defaultCurrency: organization.defaultCurrency,
      createdAt: organization.createdAt,
      legalName: organization.legalName,
      supportEmail: organization.supportEmail,
      businessType: organization.businessType,
      merchantStatus: organization.merchantAccounts[0]?.status ?? null,
      payoutsEnabled: organization.merchantAccounts[0]?.payoutsEnabled ?? false,
      requirementsDue: organization.merchantAccounts[0]?.requirementsDue ?? [],
      verificationStatus: organization.verifications[0]?.status ?? null,
      orders: organization._count.orders,
      products: organization._count.products,
      members: organization.members.map((member) => ({
        email: member.user.email,
        name: member.user.name,
        role: member.role,
      })),
      taxIdentities: organization.taxIdentities,
      balances: organization.balances.map((balance) => ({
        currency: balance.currency,
        available: balance.availableAmount,
        pending: balance.pendingAmount,
        reserved: balance.reservedAmount,
      })),
      recentPayments: recentPayments.map(toPaymentRow),
    };
  }

  async searchPayments(query: string | null, limit: number) {
    const payments = await this.db.payment.findMany({
      where: query
        ? {
            OR: [
              { id: query },
              { orderId: query },
              { providerPaymentId: query },
              { customer: { email: { contains: query, mode: "insensitive" } } },
            ],
          }
        : undefined,
      select: PAYMENT_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return payments.map(toPaymentRow);
  }

  async listPayouts(status: PayoutStatus | null, limit: number) {
    const payouts = await this.db.payout.findMany({
      where: status ? { status } : undefined,
      include: { organization: { select: { name: true } } },
      orderBy: { requestedAt: "desc" },
      take: limit,
    });

    return payouts.map((payout) => ({
      id: payout.id,
      organizationId: payout.organizationId,
      organizationName: payout.organization.name,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      requestedAt: payout.requestedAt,
      paidAt: payout.paidAt,
      failureReason: payout.failureReason,
    }));
  }

  async listDisputes(status: DisputeStatus[] | null, limit: number) {
    const disputes = await this.db.dispute.findMany({
      where: status ? { status: { in: status } } : undefined,
      include: { organization: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: limit,
    });

    return disputes.map((dispute) => ({
      id: dispute.id,
      organizationId: dispute.organizationId,
      organizationName: dispute.organization.name,
      amount: dispute.amount,
      heldAmount: dispute.heldAmount,
      currency: dispute.currency,
      status: dispute.status,
      evidenceDueAt: dispute.evidenceDueAt,
      createdAt: dispute.createdAt,
    }));
  }

  async revenueByDay(sinceDays: number) {
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    return this.db.$queryRaw<{ day: Date; currency: string; amount: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day,
             currency,
             SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END)::bigint AS amount
      FROM "LedgerEntry"
      WHERE account = 'PLATFORM_REVENUE' AND "createdAt" >= ${since}
      GROUP BY 1, 2
      ORDER BY 1 ASC`;
  }
}
