import { NotFoundError } from "@/lib/errors";
import type { DisputeStatus, PayoutStatus } from "@/generated/prisma/enums";
import type { PlatformAdminRepository } from "./platform-admin.repository";

export interface PlatformOverview {
  organizations: { total: number; byStatus: { status: string; count: number }[] };
  volume: { currency: string; total: bigint; count: number }[];
  revenue: { currency: string; net: bigint }[];
  processorFees: { currency: string; net: bigint }[];
  affiliatePayable: { currency: string; net: bigint }[];
  pendingPayouts: { currency: string; total: bigint; count: number }[];
  openDisputes: number;
  verificationPending: number;
}

/** Window used by the overview and the revenue chart. */
export const ADMIN_WINDOW_DAYS = 30;

/**
 * Read-only view of the whole platform for Ripay staff.
 *
 * Deliberately has no write operations: anything that moves money or changes a
 * producer's account should happen through the domain services that already
 * enforce their rules, not through a back office shortcut.
 */
export class PlatformAdminService {
  constructor(private readonly repository: PlatformAdminRepository) {}

  async overview(): Promise<PlatformOverview> {
    const [byStatus, volume, revenue, processorFees, affiliatePayable, pendingPayouts, openDisputes, verificationPending] =
      await Promise.all([
        this.repository.organizationCounts(),
        this.repository.grossVolume(ADMIN_WINDOW_DAYS),
        this.repository.accountTotals("PLATFORM_REVENUE"),
        this.repository.accountTotals("PROCESSOR_FEES"),
        this.repository.accountTotals("AFFILIATE_PAYABLE"),
        this.repository.pendingPayouts(),
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
      openDisputes,
      verificationPending,
    };
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
