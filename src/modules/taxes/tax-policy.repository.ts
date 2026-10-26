import type { TaxRegime } from "@/generated/prisma/enums";
import type { DbClient } from "@/lib/database/postgres/client";

export interface TaxRule {
  regime: TaxRegime;
  rateBps: number;
  jurisdiction: string | null;
}

export interface TaxPolicyScope {
  organizationId: string;
  country: string;
}

/** Mesma precedência das demais políticas: organização → país → padrão global. */
export interface TaxPolicyRepository {
  findTaxRule(scope: TaxPolicyScope): Promise<TaxRule | null>;
}

const specificity = (p: { organizationId: string | null; country: string | null }) =>
  (p.organizationId ? 2 : 0) + (p.country ? 1 : 0);

export class PrismaTaxPolicyRepository implements TaxPolicyRepository {
  constructor(private readonly db: DbClient) {}

  async findTaxRule(scope: TaxPolicyScope): Promise<TaxRule | null> {
    const candidates = await this.db.taxPolicy.findMany({
      where: {
        active: true,
        OR: [{ organizationId: scope.organizationId }, { organizationId: null }],
        AND: [{ OR: [{ country: scope.country }, { country: null }] }],
      },
    });
    const best = candidates.sort((a, b) => specificity(b) - specificity(a))[0];
    return best ? { regime: best.regime, rateBps: best.rateBps, jurisdiction: best.jurisdiction } : null;
  }
}
