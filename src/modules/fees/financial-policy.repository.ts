import type { DbClient } from "@/lib/database/postgres/client";
import type { PaymentMethodType } from "@/generated/prisma/enums";
import type { PlatformFeeRule } from "./fee.calculator";

export interface PolicyScope {
  organizationId: string;
  country: string;
  currency: string;
  /** O meio de pagamento da venda. Só o prazo depende dele; a taxa, não. */
  method?: PaymentMethodType | null;
}

/**
 * Resolves configurable financial policies with precedence:
 * organization-specific → country → currency → payment method → global default.
 */
export interface FinancialPolicyRepository {
  findPlatformFeeRule(scope: PolicyScope): Promise<PlatformFeeRule | null>;
  findSettlementDelayDays(scope: PolicyScope): Promise<number | null>;
  /** Grava a condição desta organização: uma linha por moeda e meio, sobrescrita se já existir. */
  setOrganizationSettlementDelay(input: {
    organizationId: string;
    currency: string;
    method: PaymentMethodType;
    delayDays: number;
  }): Promise<void>;
}

/**
 * Quanto uma política "fala especificamente de você".
 *
 * A ordem importa e é total: condição negociada da organização vence qualquer regra geral,
 * depois o país, depois a moeda, e por último o meio de pagamento. Sem pesos distintos duas
 * regras igualmente específicas empatavam e o desempate ficava por conta da ordem do banco.
 */
const specificity = (p: { organizationId: string | null; country: string | null; currency?: string | null; method?: PaymentMethodType | null }) =>
  (p.organizationId ? 8 : 0) + (p.country ? 4 : 0) + (p.currency ? 2 : 0) + (p.method ? 1 : 0);

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

  async setOrganizationSettlementDelay(input: {
    organizationId: string;
    currency: string;
    method: PaymentMethodType;
    delayDays: number;
  }): Promise<void> {
    const existing = await this.db.settlementPolicy.findFirst({
      where: { organizationId: input.organizationId, currency: input.currency, method: input.method },
    });
    if (existing) {
      await this.db.settlementPolicy.update({ where: { id: existing.id }, data: { delayDays: input.delayDays, active: true } });
      return;
    }
    await this.db.settlementPolicy.create({ data: { ...input, country: null } });
  }

  async findSettlementDelayDays(scope: PolicyScope): Promise<number | null> {
    const candidates = await this.db.settlementPolicy.findMany({
      where: {
        active: true,
        OR: [{ organizationId: scope.organizationId }, { organizationId: null }],
        AND: [
          { OR: [{ country: scope.country }, { country: null }] },
          { OR: [{ currency: scope.currency }, { currency: null }] },
          // Regra sem meio definido vale para todos; com meio, só para aquele. Venda de meio
          // desconhecido fica com as regras gerais — nunca com a do cartão por descuido.
          { OR: scope.method ? [{ method: scope.method }, { method: null }] : [{ method: null }] },
        ],
      },
    });
    const best = candidates.sort((a, b) => specificity(b) - specificity(a))[0];
    return best ? best.delayDays : null;
  }
}
