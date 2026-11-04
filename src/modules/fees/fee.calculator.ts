import { ValidationError } from "@/lib/errors";
import { addMoney, calculatePercentage, money, subtractMoney, type Money } from "@/lib/money";

export interface PlatformFeeRule {
  /** Percentage in basis points (500 = 5%). */
  percentageBps: number;
  /** Fixed amount in minor units, same currency as the sale. */
  fixedAmount: bigint;
}

/**
 * A taxa que a landing page anuncia, e o padrão que o seed grava.
 *
 * Existe para que preço anunciado e preço cobrado não possam divergir em silêncio: antes disto
 * a página não dizia nada e o seed gravava 10%, então qualquer número escrito à mão na página
 * nasceria errado. A verdade final continua sendo a PlatformFeePolicy no banco — uma
 * organização pode ter condição negociada —, mas o padrão sai daqui.
 *
 * O fixo é em unidades menores da moeda da venda: 249 vira R$ 2,49, € 2,49 ou US$ 2,49. Em euro
 * e dólar isso é bem mais caro em valor; se a condição lá fora for outra, é aqui que muda.
 */
export const PUBLISHED_PLATFORM_FEE: PlatformFeeRule = { percentageBps: 899, fixedAmount: 249n };

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

/**
 * gross = processorFee + platformFee + affiliateCommission + producerNet — always
 * exact, never floats. The commission is charged against the producer's share, as
 * the producer is the one who hired the affiliate; the platform fee is untouched.
 *
 * `affiliateBps` is applied to the gross sale value, the number the affiliate was
 * promised, and is capped at whatever is left for the producer so the split can
 * never go negative.
 */
export function calculateFeeBreakdown(
  gross: Money,
  processorFee: Money,
  rule: PlatformFeeRule,
  affiliateBps = 0,
): FeeBreakdown {
  if (gross.amount <= 0n) throw new ValidationError("Gross amount must be positive");
  if (processorFee.amount < 0n) throw new ValidationError("Processor fee cannot be negative");
  const platformFee = calculatePlatformFee(gross, rule);
  const beforeCommission = subtractMoney(subtractMoney(gross, processorFee), platformFee);
  if (beforeCommission.amount < 0n) {
    throw new ValidationError("Fees exceed the gross amount", {
      gross: gross.amount.toString(),
      processorFee: processorFee.amount.toString(),
      platformFee: platformFee.amount.toString(),
    });
  }

  const requested = affiliateBps > 0 ? calculatePercentage(gross, affiliateBps) : money(0n, gross.currency);
  const commission = requested.amount > beforeCommission.amount ? beforeCommission : requested;

  return {
    grossAmount: gross,
    processorFeeAmount: processorFee,
    platformFeeAmount: platformFee,
    affiliateCommissionAmount: commission,
    producerNetAmount: subtractMoney(beforeCommission, commission),
  };
}
