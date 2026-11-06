import { NotFoundError } from "@/lib/errors";
import type { DisputeStatus, PayoutStatus } from "@/generated/prisma/enums";
import type { OrganizationTotalsRow, PlatformAdminRepository } from "./platform-admin.repository";
import { adminPeriodStart, DEFAULT_ADMIN_PERIOD, type AdminPeriod } from "./admin-period";

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
  /** O recorte que estes números respeitam. Os de saldo não dependem dele. */
  period: AdminPeriod;
  organizations: { total: number; byStatus: { status: string; count: number }[] };
  /** Vendido no período, bruto, antes de qualquer taxa. */
  volume: { currency: string; total: bigint; count: number }[];
  revenue: { currency: string; net: bigint }[];
  processorFees: { currency: string; net: bigint }[];
  /** Taxas de sempre, independente do recorte: serve para o período não parecer o total. */
  revenueAllTime: { currency: string; net: bigint }[];
  affiliatePayable: { currency: string; net: bigint }[];
  pendingPayouts: { currency: string; total: bigint; count: number }[];
  profit: PlatformProfit[];
  openDisputes: number;
  verificationPending: number;
}

/** Window used by the revenue chart. */
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

  /**
   * Fluxo (vendido, taxa cobrada, custo, lucro) respeita o recorte; saldo não.
   *
   * Comissão a pagar e saque na fila são o que a plataforma **deve agora**: filtrar por data
   * mostraria só o pedaço da dívida que nasceu no período, e uma dívida pela metade é pior do
   * que nenhum número.
   */
  async overview(period: AdminPeriod = DEFAULT_ADMIN_PERIOD): Promise<PlatformOverview> {
    const since = adminPeriodStart(period);
    const [
      byStatus,
      volume,
      revenue,
      processorFees,
      revenueAllTime,
      affiliatePayable,
      pendingPayouts,
      refunds,
      chargebacks,
      openDisputes,
      verificationPending,
    ] = await Promise.all([
      this.repository.organizationCounts(),
      this.repository.grossVolume(since),
      this.repository.accountTotals("PLATFORM_REVENUE", since),
      this.repository.accountTotals("PROCESSOR_FEES", since),
      this.repository.accountTotals("PLATFORM_REVENUE"),
      this.repository.accountTotals("AFFILIATE_PAYABLE"),
      this.repository.pendingPayouts(),
      this.repository.accountTotals("REFUNDS", since),
      this.repository.accountTotals("CHARGEBACKS", since),
      this.repository.openDisputeCount(),
      this.repository.verificationPendingCount(),
    ]);

    return {
      period,
      organizations: { total: byStatus.reduce((total, row) => total + row.count, 0), byStatus },
      volume,
      revenue,
      processorFees,
      revenueAllTime,
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
    return this.repository.revenueByDay(new Date(Date.now() - ADMIN_WINDOW_DAYS * 86_400_000));
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
