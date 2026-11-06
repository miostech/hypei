import { NotFoundError, ValidationError } from "@/lib/errors";
import { assertSupportedCurrency, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/money";
import type { UnitOfWork } from "@/server/unit-of-work";
import { publishedPlatformFee, type PlatformFeeRule } from "./fee.calculator";

/** A taxa que vale hoje para uma organização numa moeda, e de onde ela vem. */
export interface EffectiveFee {
  currency: CurrencyCode;
  /** O que a venda vai cobrar de verdade. */
  rule: PlatformFeeRule;
  /** A taxa que a página anuncia, para comparar com a negociada. */
  published: PlatformFeeRule;
  /**
   * `true` quando existe condição gravada só para esta organização. `false` quando ela está na
   * regra que vale para todas — seja a do banco, seja o padrão publicado.
   */
  negotiated: boolean;
}

/**
 * Uma taxa acima de 100% faria `calculateFeeBreakdown` recusar toda venda daquele produtor, e o
 * checkout dele quebraria sem ninguém entender por quê. Erro de digitação no admin não pode
 * virar loja fechada, então o limite é aqui, antes de gravar.
 */
const MAX_PERCENTAGE_BPS = 10_000;

/**
 * Quem muda a taxa de um produtor.
 *
 * Por padrão todo mundo paga o que a landing page anuncia
 * ([`PUBLISHED_PLATFORM_FEE`](./fee.calculator.ts)). Quando a Kabrun negocia condição com
 * alguém — volume alto, parceria, recuperação de um produtor que ia embora —, a exceção fica
 * numa linha de `PlatformFeePolicy` da organização, e é ela que a venda usa a partir do
 * próximo pagamento. Venda já capturada guarda a taxa que foi cobrada nela e não muda.
 */
export class PlatformFeeService {
  constructor(private readonly uow: UnitOfWork) {}

  /** O que cada moeda cobra desta organização hoje, com e sem condição negociada. */
  async effective(organizationId: string): Promise<EffectiveFee[]> {
    const organization = await this.uow.repos.organizations.findById(organizationId);
    if (!organization) throw new NotFoundError("Organization not found");

    const negotiated = new Map((await this.uow.repos.policies.listOrganizationPlatformFees(organizationId)).map((row) => [row.currency, row]));
    const resolved = await Promise.all(
      SUPPORTED_CURRENCIES.map(async (currency) => {
        const rule = await this.uow.repos.policies.findPlatformFeeRule({
          organizationId,
          country: organization.country,
          currency,
        });
        return {
          currency,
          rule: rule ?? publishedPlatformFee(currency),
          published: publishedPlatformFee(currency),
          negotiated: negotiated.has(currency),
        };
      }),
    );
    return resolved;
  }

  /** Grava a condição desta organização nesta moeda. Vale da próxima venda em diante. */
  async setForOrganization(input: {
    organizationId: string;
    currency: string;
    percentageBps: number;
    fixedAmount: bigint;
    userId?: string | null;
  }): Promise<EffectiveFee[]> {
    const currency = assertSupportedCurrency(input.currency);
    if (!Number.isInteger(input.percentageBps) || input.percentageBps < 0 || input.percentageBps > MAX_PERCENTAGE_BPS) {
      throw new ValidationError("A porcentagem tem que ficar entre 0% e 100%", { field: "percentage" });
    }
    if (input.fixedAmount < 0n) {
      throw new ValidationError("A parte fixa não pode ser negativa", { field: "fixedAmount" });
    }

    await this.uow.transaction(async (repos) => {
      await repos.policies.setOrganizationPlatformFee({
        organizationId: input.organizationId,
        currency,
        percentageBps: input.percentageBps,
        fixedAmount: input.fixedAmount,
      });
      await repos.audit.record({
        organizationId: input.organizationId,
        userId: input.userId,
        action: "platform_fee.negotiated",
        entity: "PlatformFeePolicy",
        entityId: input.organizationId,
        metadata: { currency, percentageBps: input.percentageBps, fixedAmount: input.fixedAmount },
      });
    });
    return this.effective(input.organizationId);
  }

  /** Devolve a organização para a taxa que vale para todas. */
  async clearForOrganization(input: { organizationId: string; currency: string; userId?: string | null }): Promise<EffectiveFee[]> {
    const currency = assertSupportedCurrency(input.currency);
    await this.uow.transaction(async (repos) => {
      await repos.policies.clearOrganizationPlatformFee({ organizationId: input.organizationId, currency });
      await repos.audit.record({
        organizationId: input.organizationId,
        userId: input.userId,
        action: "platform_fee.reset",
        entity: "PlatformFeePolicy",
        entityId: input.organizationId,
        metadata: { currency },
      });
    });
    return this.effective(input.organizationId);
  }
}
