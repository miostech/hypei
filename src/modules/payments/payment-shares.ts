import type { Payment } from "@/generated/prisma/client";
import type { LedgerAccount } from "@/generated/prisma/enums";
import { ValidationError } from "@/lib/errors";
import { allocateProportionally, money } from "@/lib/money";

export interface PaymentShares {
  producer: bigint;
  platform: bigint;
  /** Part of the refunded amount that came out of the affiliate's commission. */
  affiliate: bigint;
  /**
   * A parte da taxa do adquirente que corresponde a este pedaço da venda. NÃO entra na soma
   * de `amount`: o comprador nunca pagou essa taxa, a Kabrun pagou (ADR 011). Serve para
   * reclassificar o custo, de taxa de uma venda que ficou para perda de uma que voltou.
   */
  processor: bigint;
}

/**
 * Splits a partial amount of a captured payment (refund, dispute) into the same
 * proportions as the original sale. `producer + platform + affiliate` sempre fecha
 * exatamente em `amount` — que é o que sai do caixa para devolver ao comprador.
 */
export function splitByOriginalShares(payment: Payment, amount: bigint): PaymentShares {
  if (payment.producerNetAmount === null || payment.platformFeeAmount === null || payment.processorFeeAmount === null) {
    throw new ValidationError("Payment has no fee breakdown (not captured)");
  }
  const commission = payment.affiliateCommissionAmount ?? 0n;
  const [producer, platform, affiliate] = allocateProportionally(money(amount, payment.currency), [
    payment.producerNetAmount,
    payment.platformFeeAmount,
    commission,
  ]);
  // Proporcional ao quanto da venda está voltando, e por isso fora do rateio acima: a taxa do
  // adquirente é dinheiro que já saiu, não pedaço do que o comprador pagou.
  const processor = payment.amount > 0n ? (payment.processorFeeAmount * amount) / payment.amount : 0n;
  return {
    producer: producer.amount,
    platform: platform.amount,
    affiliate: affiliate.amount,
    processor,
  };
}

/** Where the producer's share of this payment currently sits. */
export function producerAccountFor(payment: Pick<Payment, "settledAt">): LedgerAccount {
  return payment.settledAt ? "PRODUCER_AVAILABLE" : "PRODUCER_PENDING";
}
