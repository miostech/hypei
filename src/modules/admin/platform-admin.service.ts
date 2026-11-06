import { NotFoundError } from "@/lib/errors";
import type { DisputeStatus, PayoutStatus } from "@/generated/prisma/enums";
import type { OrganizationTotalsRow, PlatformAdminRepository } from "./platform-admin.repository";

/**
 * O resultado da Kabrun numa moeda. O produtor paga a taxa anunciada e nada além; o que a
 * Kabrun paga ao adquirente sai dessa taxa, e o lucro é a diferença (ADR 011).
 */
export interface PlatformProfit {
  currency: string;
  /** Taxa cobrada dos produtores, já líquida de estorno e chargeback. */
  revenue: bigint;
  /** O que a Stripe (e amanhã a Asaas) cobrou nas vendas que ficaram de pé. */
  processorFees: bigint;
  /** Taxa de adquirente perdida: venda devolvida ou perdida no chargeback. */
  acquirerLosses: bigint;
  /** revenue − processorFees − acquirerLosses. */
  net: bigint;
}

export interface PlatformOverview {
  organizations: { total: number; byStatus: { status: string; count: number }[] };
  volume: { currency: string; total: bigint; count: number }[];
  revenue: { currency: string; net: bigint }[];
  processorFees: { currency: string; net: bigint }[];
  affiliatePayable: { currency: string; net: bigint }[];
  pendingPayouts: { currency: string; total: bigint; count: number }[];
  profit: PlatformProfit[];
  openDisputes: number;
  verificationPending: number;
}

/** Window used by the overview and the revenue chart. */
export const ADMIN_WINDOW_DAYS = 30;

/**
 * Read-only view of the whole platform for Kabrun staff.
 *
 * Deliberately has no write operations: anything that moves money or changes a
 * producer's account should happen through the domain services that already
 * enforce their rules, not through a back office shortcut.
 */
export class PlatformAdminService {
  constructor(private readonly repository: PlatformAdminRepository) {}

  async overview(): Promise<PlatformOverview> {
    const [byStatus, volume, revenue, processorFees, affiliatePayable, pendingPayouts, refunds, chargebacks, openDisputes, verificationPending] =
      await Promise.all([
        this.repository.organizationCounts(),
        this.repository.grossVolume(ADMIN_WINDOW_DAYS),
        this.repository.accountTotals("PLATFORM_REVENUE"),
        this.repository.accountTotals("PROCESSOR_FEES"),
        this.repository.accountTotals("AFFILIATE_PAYABLE"),
        this.repository.pendingPayouts(),
        this.repository.accountTotals("REFUNDS"),
        this.repository.accountTotals("CHARGEBACKS"),
        this.repository.openDisputeCount(),
        this.repository.verificationPendingCount(),
      ]);

    return {
      organizations: { total: byStatus.reduce((total, row) => total + row.count, 0), byStatus },
      volume,
      revenue,
      processorFees,
      affiliatePayable,
      pendingPayouts,
      profit: buildProfit(revenue, processorFees, refunds, chargebacks),
      openDisputes,
      verificationPending,
    };
  }

  /** Quanto cada produtor vendeu e quanto gerou de taxa, indexado por organização. */
  async organizationTotals(): Promise<Map<string, OrganizationTotalsRow[]>> {
    const rows = await this.repository.organizationTotals();
    const byOrganization = new Map<string, OrganizationTotalsRow[]>();
    for (const row of rows) {
      byOrganization.set(row.organizationId, [...(byOrganization.get(row.organizationId) ?? []), row]);
    }
    return byOrganization;
  }

  listOrganizations(query?: string) {
    return this.repository.listOrganizations(query?.trim() || null, 100);
  }

  async organization(id: string) {
    const organization = await this.repository.organizationDetail(id);
    if (!organization) throw new NotFoundError("Organization", id);
    return organization;
  }

  searchPayments(query?: string) {
    return this.repository.searchPayments(query?.trim() || null, 50);
  }

  listPayouts(status?: PayoutStatus) {
    return this.repository.listPayouts(status ?? null, 100);
  }

  listDisputes(onlyOpen = true) {
    const open: DisputeStatus[] = ["OPEN", "UNDER_REVIEW"];
    return this.repository.listDisputes(onlyOpen ? open : null, 100);
  }

  revenueByDay() {
    return this.repository.revenueByDay(ADMIN_WINDOW_DAYS);
  }
}

type Totals = { currency: string; net: bigint }[];

/** Junta as contas por moeda: uma venda em dólar não abate custo em real. */
function buildProfit(revenue: Totals, processorFees: Totals, refunds: Totals, chargebacks: Totals): PlatformProfit[] {
  const pick = (rows: Totals, currency: string) => rows.find((row) => row.currency === currency)?.net ?? 0n;
  const currencies = [...new Set([revenue, processorFees, refunds, chargebacks].flat().map((row) => row.currency))];

  return currencies
    .map((currency) => {
      const net = pick(revenue, currency);
      const fees = pick(processorFees, currency);
      const losses = pick(refunds, currency) + pick(chargebacks, currency);
      return { currency, revenue: net, processorFees: fees, acquirerLosses: losses, net: net - fees - losses };
    })
    .sort((a, b) => (b.revenue > a.revenue ? 1 : -1));
}
