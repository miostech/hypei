import type { AwardTier } from "@/generated/prisma/enums";

export interface AwardTierDefinition {
  tier: AwardTier;
  label: string;
  /** Milestone in minor units (R$ 10.000,00 = 1_000_000). */
  threshold: bigint;
}

/**
 * Milestones are measured on net revenue — what the producer actually kept after
 * fees, refunds and chargebacks. Rewarding gross would hand a plaque to someone
 * who sold a lot and refunded everything.
 */
export const AWARD_TIERS: AwardTierDefinition[] = [
  { tier: "BRONZE", label: "Bronze", threshold: 1_000_000n },
  { tier: "SILVER", label: "Prata", threshold: 10_000_000n },
  { tier: "GOLD", label: "Ouro", threshold: 100_000_000n },
  { tier: "EMERALD", label: "Esmeralda", threshold: 500_000_000n },
  { tier: "DIAMOND", label: "Diamante", threshold: 1_000_000_000n },
  { tier: "ONYX", label: "Ônix", threshold: 2_500_000_000n },
];

export const AWARD_TIER_BY_NAME = new Map(AWARD_TIERS.map((definition) => [definition.tier, definition]));

/** Every tier the revenue has already passed. */
export function tiersReachedBy(netRevenue: bigint): AwardTierDefinition[] {
  return AWARD_TIERS.filter((definition) => netRevenue >= definition.threshold);
}

export function nextTierAfter(netRevenue: bigint): AwardTierDefinition | null {
  return AWARD_TIERS.find((definition) => netRevenue < definition.threshold) ?? null;
}
