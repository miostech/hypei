import { ValidationError } from "@/lib/errors";
import { addMoney, calculatePercentage, money, subtractMoney, type Money } from "@/lib/money";

export interface PlatformFeeRule {
  /** Percentage in basis points (500 = 5%). */
  percentageBps: number;
  /** Fixed amount in minor units, same currency as the sale. */
  fixedAmount: bigint;
}

export const NO_PLATFORM_FEE: PlatformFeeRule = { percentageBps: 0, fixedAmount: 0n };

/** Supports percentage, fixed, or percentage + fixed (e.g. 5% + R$1,00). */
export function calculatePlatformFee(gross: Money, rule: PlatformFeeRule): Money {
  return addMoney(calculatePercentage(gross, rule.percentageBps), money(rule.fixedAmount, gross.currency));
}

export interface FeeBreakdown {
  grossAmount: Money;
  processorFeeAmount: Money;
  platformFeeAmount: Money;
  producerNetAmount: Money;
}

/**
 * gross = processorFee + platformFee + producerNet — always exact, never floats.
 * Processor fee (what the PSP charged) and platform fee (Hypei) are kept separate.
 */
export function calculateFeeBreakdown(gross: Money, processorFee: Money, rule: PlatformFeeRule): FeeBreakdown {
  if (gross.amount <= 0n) throw new ValidationError("Gross amount must be positive");
  if (processorFee.amount < 0n) throw new ValidationError("Processor fee cannot be negative");
  const platformFee = calculatePlatformFee(gross, rule);
  const producerNet = subtractMoney(subtractMoney(gross, processorFee), platformFee);
  if (producerNet.amount < 0n) {
    throw new ValidationError("Fees exceed the gross amount", {
      gross: gross.amount.toString(),
      processorFee: processorFee.amount.toString(),
      platformFee: platformFee.amount.toString(),
    });
  }
  return { grossAmount: gross, processorFeeAmount: processorFee, platformFeeAmount: platformFee, producerNetAmount: producerNet };
}
