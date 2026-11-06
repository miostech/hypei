import { ValidationError } from "@/lib/errors";
import { addMoney, assertSupportedCurrency, calculatePercentage, money, subtractMoney, type CurrencyCode, type Money } from "@/lib/money";

export interface PlatformFeeRule {
  /** Percentage in basis points (500 = 5%). */
  percentageBps: number;
  /** Fixed amount in minor units, same currency as the sale. */
  fixedAmount: bigint;
}

/**
 * A taxa que a landing page anuncia, e o padrão que o seed grava, por moeda.
 *
 * Existe para que preço anunciado e preço cobrado não possam divergir em silêncio: antes disto
 * a página não dizia nada e o seed gravava 10%, então qualquer número escrito à mão na página
 * nasceria errado. A verdade final continua sendo a PlatformFeePolicy no banco — uma
 * organização pode ter condição negociada —, mas o padrão sai daqui.
 *
 * O fixo é em unidades menores da moeda da venda. Venda fora do Brasil custa mais: o dinheiro
 * demora mais a chegar e o risco de chargeback é maior, então o percentual é outro e o fixo é
 * cobrado na moeda da venda, não convertido do real.
 */
export const PUBLISHED_PLATFORM_FEE: Record<CurrencyCode, PlatformFeeRule> = {
  BRL: { percentageBps: 899, fixedAmount: 249n },
  EUR: { percentageBps: 999, fixedAmount: 80n },
  USD: { percentageBps: 999, fixedAmount: 80n },
};

/** A taxa anunciada da moeda da venda. Moeda não suportada nunca chega aqui. */
export function publishedPlatformFee(currency: string): PlatformFeeRule {
  return PUBLISHED_PLATFORM_FEE[assertSupportedCurrency(currency)];
}

/** Supports percentage, fixed, or percentage + fixed (e.g. 5% + R$1,00). */
export function calculatePlatformFee(gross: Money, rule: PlatformFeeRule): Money {
  return addMoney(calculatePercentage(gross, rule.percentageBps), money(rule.fixedAmount, gross.currency));
}

export interface FeeBreakdown {
  grossAmount: Money;
  processorFeeAmount: Money;
  platformFeeAmount: Money;
  /** Commission owed to the affiliate who referred the sale; zero without one. */
  affiliateCommissionAmount: Money;
  producerNetAmount: Money;
}

/** Quanto o afiliado ganha, e sobre qual parte da venda. */
export interface AffiliateShare {
  bps: number;
  /**
   * O que foi cobrado pelos itens do produto afiliado. Nunca o pedido inteiro: a afiliação
   * é por produto, e um order bump de outro produto entra na mesma cobrança. Pagar comissão
   * sobre ele seria pagar por uma venda que o afiliado não fez.
   *
   * O total do item já vem líquido de cupom, e não inclui imposto — que é exatamente a base
   * que o afiliado deve receber: o dinheiro da venda dele, sem o que nunca foi receita.
   */
  base: Money;
}

/**
 * gross = platformFee + affiliateCommission + producerNet — sempre exato, nunca float.
 *
 * A taxa do adquirente NÃO entra nesta divisão: ela é custo da Kabrun, pago com a taxa que a
 * Kabrun cobra, e não sai do produtor. O produtor paga o que a página anuncia e nada além
 * disso (ADR 011). Ela continua no resultado porque é registrada no ledger e é o que separa a
 * receita da plataforma do lucro dela — só não desconta de quem vendeu.
 *
 * A comissão sai do `base` que quem chama informou, e é limitada ao que sobrou para o
 * produtor, de modo que a divisão nunca fique negativa.
 */
export function calculateFeeBreakdown(
  gross: Money,
  processorFee: Money,
  rule: PlatformFeeRule,
  affiliate?: AffiliateShare,
): FeeBreakdown {
  if (gross.amount <= 0n) throw new ValidationError("Gross amount must be positive");
  if (processorFee.amount < 0n) throw new ValidationError("Processor fee cannot be negative");
  const platformFee = calculatePlatformFee(gross, rule);
  const beforeCommission = subtractMoney(gross, platformFee);
  if (beforeCommission.amount < 0n) {
    throw new ValidationError("Fees exceed the gross amount", {
      gross: gross.amount.toString(),
      platformFee: platformFee.amount.toString(),
    });
  }

  const requested =
    affiliate && affiliate.bps > 0 && affiliate.base.amount > 0n
      ? calculatePercentage(affiliate.base, affiliate.bps)
      : money(0n, gross.currency);
  const commission = requested.amount > beforeCommission.amount ? beforeCommission : requested;

  return {
    grossAmount: gross,
    processorFeeAmount: processorFee,
    platformFeeAmount: platformFee,
    affiliateCommissionAmount: commission,
    producerNetAmount: subtractMoney(beforeCommission, commission),
  };
}
