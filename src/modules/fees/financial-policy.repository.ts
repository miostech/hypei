import type { DbClient } from "@/lib/database/postgres/client";
import type { PlatformFeeRule } from "./fee.calculator";

export interface PolicyScope {
  organizationId: string;
  country: string;
  currency: string;
}

/**
 * Resolves configurable financial policies with precedence:
 * organization-specific → country-specific → global default.
 */
export interface FinancialPolicyRepository {
  findPlatformFeeRule(scope: PolicyScope): Promise<PlatformFeeRule | null>;
  findSettlementDelayDays(scope: PolicyScope): Promise<number | null>;
}

const specificity = (p: { organizationId: string | null; country: string | null }) =>
  (p.organizationId ? 2 : 0) + (p.country ? 1 : 0);

export class PrismaFinancialPolicyRepository implements FinancialPolicyRepository {
  constructor(private readonly db: DbClient) {}

  async findPlatformFeeRule(scope: PolicyScope): Promise<PlatformFeeRule | null> {
    const candidates = await this.db.platformFeePolicy.findMany({
      where: {
        active: true,
        currency: scope.currency,
        OR: [{ organizationId: scope.organizationId }, { organizationId: null }],
        AND: [{ OR: [{ country: scope.country }, { country: null }] }],
      },
    });
    const best = candidates.sort((a, b) => specificity(b) - specificity(a))[0];
    return best ? { percentageBps: best.percentageBps, fixedAmount: best.fixedAmount } : null;
  }

  async findSettlementDelayDays(scope: PolicyScope): Promise<number | null> {
    const candidates = await this.db.settlementPolicy.findMany({
      where: {
        active: true,
        OR: [{ organizationId: scope.organizationId }, { organizationId: null }],
        AND: [
          { OR: [{ country: scope.country }, { country: null }] },
          { OR: [{ currency: scope.currency }, { currency: null }] },
        ],
      },
    });
    const best = candidates.sort((a, b) => specificity(b) - specificity(a))[0];
    return best ? best.delayDays : null;
  }
}
