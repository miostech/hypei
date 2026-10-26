import type { TaxRegime } from "@/generated/prisma/enums";
import { extractIncludedPercentage, money, type Money } from "@/lib/money";
import type { TaxPolicyRepository } from "./tax-policy.repository";

export interface TaxCalculationInput {
  /** Valor que o comprador paga. O imposto está DENTRO dele, nunca somado por fora. */
  amount: Money;
  organizationId: string;
  sellerCountry: string;
  buyerCountry: string | null;
  buyerTaxId?: string | null;
  productType: string;
}

export interface TaxCalculationResult {
  /** Parte de `amount` que corresponde a imposto. */
  taxAmount: Money;
  regime: TaxRegime;
  breakdown: { jurisdiction: string; rateBps: number; amount: Money }[];
}

/**
 * Cálculo de imposto da venda. Quem vende é o PRODUTOR: a Kabrun calcula, registra e
 * mostra, e o recolhimento é obrigação dele. Por isso o imposto não gera lançamento no
 * ledger — nenhum dinheiro muda de mãos por causa dele, ele apenas identifica quanto do
 * que já foi cobrado corresponde a tributo.
 *
 * Emissão de documento fiscal (NFS-e) e provedores de cálculo (Stripe Tax, Avalara)
 * entram atrás desta mesma interface.
 */
export interface TaxService {
  calculate(input: TaxCalculationInput): Promise<TaxCalculationResult>;
}

/** Nenhum imposto calculado. É o comportamento de quem não configurou política. */
export class NoTaxService implements TaxService {
  async calculate(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    return { taxAmount: money(0n, input.amount.currency), regime: "NONE", breakdown: [] };
  }
}

/**
 * Resolve a política do produtor (organização → país → padrão) e extrai a alíquota de
 * dentro do valor pago. Sem política ativa, nada é cobrado — o silêncio não vira imposto.
 */
export class PolicyTaxService implements TaxService {
  constructor(private readonly policies: TaxPolicyRepository) {}

  async calculate(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    const zero = money(0n, input.amount.currency);
    const policy = await this.policies.findTaxRule({
      organizationId: input.organizationId,
      country: input.sellerCountry,
    });

    if (!policy || policy.rateBps === 0 || policy.regime === "NONE") {
      return { taxAmount: zero, regime: policy?.regime ?? "NONE", breakdown: [] };
    }

    const taxAmount = extractIncludedPercentage(input.amount, policy.rateBps);
    return {
      taxAmount,
      regime: policy.regime,
      breakdown: [
        {
          jurisdiction: policy.jurisdiction ?? input.sellerCountry,
          rateBps: policy.rateBps,
          amount: taxAmount,
        },
      ],
    };
  }
}
