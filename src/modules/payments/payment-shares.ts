import type { Payment } from "@/generated/prisma/client";
import type { LedgerAccount } from "@/generated/prisma/enums";
import { ValidationError } from "@/lib/errors";
import { allocateProportionally, money } from "@/lib/money";

export interface PaymentShares {
  producer: bigint;
  platform: bigint;
  processor: bigint;
  /** Part of the refunded amount that came out of the affiliate's commission. */
  affiliate: bigint;
}

/**
 * Splits a partial amount of a captured payment (refund, dispute) into the same
 * proportions as the original sale. Parts always add up exactly to `amount`.
 */
export function splitByOriginalShares(payment: Payment, amount: bigint): PaymentShares {
  if (payment.producerNetAmount === null || payment.platformFeeAmount === null || payment.processorFeeAmount === null) {
    throw new ValidationError("Payment has no fee breakdown (not captured)");
  }
  const commission = payment.affiliateCommissionAmount ?? 0n;
  const [producer, platform, processor, affiliate] = allocateProportionally(money(amount, payment.currency), [
    payment.producerNetAmount,
    payment.platformFeeAmount,
    payment.processorFeeAmount,
    commission,
  ]);
  return {
    producer: producer.amount,
    platform: platform.amount,
    processor: processor.amount,
    affiliate: affiliate.amount,
  };
}

/** Where the producer's share of this payment currently sits. */
export function producerAccountFor(payment: Pick<Payment, "settledAt">): LedgerAccount {
  return payment.settledAt ? "PRODUCER_AVAILABLE" : "PRODUCER_PENDING";
}
