import type { DbClient } from "@/lib/database/postgres/client";
import type { PaymentMethodType } from "@/generated/prisma/enums";
import type { ReserveRule } from "@/modules/balances/settlement-terms";
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
/** Uma taxa negociada que existe para esta organização, numa moeda. */
export interface OrganizationFeeRow {
  currency: string;
  percentageBps: number;
  fixedAmount: bigint;
}

export interface FinancialPolicyRepository {
  findPlatformFeeRule(scope: PolicyScope): Promise<PlatformFeeRule | null>;
  findSettlementDelayDays(scope: PolicyScope): Promise<number | null>;
  findReserveRule(scope: PolicyScope): Promise<ReserveRule | null>;
  /** Grava a condição desta organização: uma linha por moeda e meio, sobrescrita se já existir. */
  setOrganizationSettlementDelay(input: {
    organizationId: string;
    currency: string;
    method: PaymentMethodType;
    delayDays: number;
  }): Promise<void>;
  /** Só as taxas negociadas desta organização — nunca as regras gerais que valem para todas. */
  listOrganizationPlatformFees(organizationId: string): Promise<OrganizationFeeRow[]>;
  /** Grava a taxa negociada desta organização nesta moeda, sobrescrevendo a anterior. */
  setOrganizationPlatformFee(input: OrganizationFeeRow & { organizationId: string }): Promise<void>;
  /** Apaga a condição negociada: a organização volta para a taxa que vale para todas. */
  clearOrganizationPlatformFee(input: { organizationId: string; currency: string }): Promise<void>;
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

  async findReserveRule(scope: PolicyScope): Promise<ReserveRule | null> {
    const candidates = await this.db.reservePolicy.findMany({
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
    return best ? { percentageBps: best.percentageBps, holdDays: best.holdDays } : null;
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

  async listOrganizationPlatformFees(organizationId: string): Promise<OrganizationFeeRow[]> {
    const rows = await this.db.platformFeePolicy.findMany({
      where: { organizationId, active: true },
      orderBy: { currency: "asc" },
    });
    return rows.map((row) => ({ currency: row.currency, percentageBps: row.percentageBps, fixedAmount: row.fixedAmount }));
  }

  /**
   * `country: null` de propósito: a condição é da organização, e ela vale onde ela vender.
   * Com país preenchido a linha deixaria de casar na venda feita de outro lugar, e a produtora
   * voltaria para a taxa geral sem ninguém ter mudado nada.
   */
  async setOrganizationPlatformFee(input: OrganizationFeeRow & { organizationId: string }): Promise<void> {
    const existing = await this.db.platformFeePolicy.findFirst({
      where: { organizationId: input.organizationId, currency: input.currency },
    });
    const data = { percentageBps: input.percentageBps, fixedAmount: input.fixedAmount, active: true };
    if (existing) {
      await this.db.platformFeePolicy.update({ where: { id: existing.id }, data });
      return;
    }
    await this.db.platformFeePolicy.create({
      data: { ...data, organizationId: input.organizationId, currency: input.currency, country: null },
    });
  }

  /** Apaga a linha em vez de desativar: condição que não vale mais não é histórico de nada. */
  async clearOrganizationPlatformFee(input: { organizationId: string; currency: string }): Promise<void> {
    await this.db.platformFeePolicy.deleteMany({ where: { organizationId: input.organizationId, currency: input.currency } });
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
