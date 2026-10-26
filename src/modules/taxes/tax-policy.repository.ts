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
  /** A política própria da organização, ignorando as herdadas de país ou padrão. */
  findOwn(organizationId: string): Promise<TaxRule | null>;
  saveOwn(organizationId: string, rule: TaxRule): Promise<void>;
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

  async findOwn(organizationId: string): Promise<TaxRule | null> {
    const policy = await this.db.taxPolicy.findFirst({ where: { organizationId, active: true } });
    return policy ? { regime: policy.regime, rateBps: policy.rateBps, jurisdiction: policy.jurisdiction } : null;
  }

  async saveOwn(organizationId: string, rule: TaxRule): Promise<void> {
    // Uma política por organização: a existente é atualizada no lugar, para não acumular
    // linhas concorrentes que a resolução por especificidade teria de desempatar.
    const existing = await this.db.taxPolicy.findFirst({ where: { organizationId } });
    if (existing) {
      await this.db.taxPolicy.update({
        where: { id: existing.id },
        data: { regime: rule.regime, rateBps: rule.rateBps, jurisdiction: rule.jurisdiction, active: true },
      });
      return;
    }
    await this.db.taxPolicy.create({
      data: {
        organizationId,
        regime: rule.regime,
        rateBps: rule.rateBps,
        jurisdiction: rule.jurisdiction,
      },
    });
  }
}
