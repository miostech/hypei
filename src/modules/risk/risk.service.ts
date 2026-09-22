import type { RiskEventRepository } from "./risk-event.repository";

export type RiskDecision = { decision: "allow" } | { decision: "review" | "deny"; reason: string };

export interface PayoutRiskInput {
  organizationId: string;
  amount: bigint;
  currency: string;
  availableAmount: bigint;
}

/**
 * Risk engine abstraction. Phase 1 has no real rules — every assessment is allowed,
 * but the signal is recorded (MongoDB risk_events) so future rules have history.
 */
export class RiskService {
  constructor(private readonly events?: RiskEventRepository) {}

  async assessPayout(input: PayoutRiskInput): Promise<RiskDecision> {
    await this.events?.record({
      organizationId: input.organizationId,
      signal: "payout.requested",
      score: 0,
      data: { amount: input.amount.toString(), currency: input.currency, available: input.availableAmount.toString() },
    });
    return { decision: "allow" };
  }
}
