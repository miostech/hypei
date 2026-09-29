import type { AwardStatus, OrganizationAward } from "@/generated/prisma/client";
import type { DomainEvent } from "@/lib/events/domain-event";
import type { EventBus } from "@/lib/events/event-bus";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { AwardRepository } from "./award.repository";
import { AWARD_TIERS, nextTierAfter, tiersReachedBy, type AwardTierDefinition } from "./award.tiers";

export interface AwardProgress {
  currency: string;
  netRevenue: bigint;
  /** null once every tier has been reached. */
  next: AwardTierDefinition | null;
  /** 0–100 towards the next tier; 100 when there is nothing left to reach. */
  percentage: number;
  awards: (AwardTierDefinition & { award: OrganizationAward | null })[];
  earnedCount: number;
}

/**
 * Physical awards for revenue milestones.
 *
 * Tiers are granted from the payment event, not from the dashboard: rendering a
 * page must not be what decides someone earned a plaque, and the producer should
 * get it whether or not they happened to be looking.
 */
export class AwardService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repository: AwardRepository,
  ) {}

  register(bus: EventBus): void {
    bus.subscribe("payment.paid", (event) => this.onPaymentPaid(event));
  }

  private async onPaymentPaid(event: DomainEvent): Promise<void> {
    if (!event.organizationId) return;
    await this.grantReachedTiers(event.organizationId);
  }

  /** Grants every tier the organization has passed but does not hold yet. */
  async grantReachedTiers(organizationId: string): Promise<number> {
    const organization = await this.uow.repos.organizations.findById(organizationId);
    if (!organization) return 0;

    const currency = organization.defaultCurrency;
    const revenue = (await this.repository.netRevenue(organizationId)).find((row) => row.currency === currency);
    if (!revenue) return 0;

    const held = new Set((await this.repository.listForOrganization(organizationId)).map((award) => award.tier));
    let granted = 0;

    for (const definition of tiersReachedBy(revenue.net)) {
      if (held.has(definition.tier)) continue;
      const created = await this.repository.grant({
        organizationId,
        tier: definition.tier,
        threshold: definition.threshold,
        currency,
      });
      if (created) {
        granted++;
        logger.info({ organizationId, tier: definition.tier }, "award granted");
      }
    }
    return granted;
  }

  /** Everything the progress bar and the awards modal need. */
  async progress(organizationId: string): Promise<AwardProgress> {
    const organization = await this.uow.repos.organizations.findById(organizationId);
    if (!organization) throw new NotFoundError("Organization", organizationId);

    const currency = organization.defaultCurrency;
    const [revenueRows, awards] = await Promise.all([
      this.repository.netRevenue(organizationId),
      this.repository.listForOrganization(organizationId),
    ]);

    const netRevenue = revenueRows.find((row) => row.currency === currency)?.net ?? 0n;
    const next = nextTierAfter(netRevenue);
    const byTier = new Map(awards.map((award) => [award.tier, award]));

    return {
      currency,
      netRevenue,
      next,
      percentage: next ? Number((netRevenue * 100n) / next.threshold) : 100,
      awards: AWARD_TIERS.map((definition) => ({ ...definition, award: byTier.get(definition.tier) ?? null })),
      earnedCount: awards.length,
    };
  }

  // ── Platform operations ──────────────────────────────────────────────────
  listAll(status?: AwardStatus) {
    return this.repository.listAll(status ?? null, 100);
  }

  /** Records that the plaque left, with the tracking code the producer can follow. */
  async registerShipping(id: string, trackingCode: string | null): Promise<OrganizationAward> {
    const award = await this.repository.findById(id);
    if (!award) throw new NotFoundError("OrganizationAward", id);
    if (award.status !== "ACHIEVED") throw new ValidationError("Esta premiação já foi enviada");
    return this.repository.registerShipping(id, trackingCode?.trim() || null);
  }
}
