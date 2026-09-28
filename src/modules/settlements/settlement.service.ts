import type { Clock } from "@/lib/clock";
import { createDomainEvent } from "@/lib/events/domain-event";
import { logger } from "@/lib/logger";
import { assertSupportedCurrency } from "@/lib/money";
import { accountBalance } from "@/modules/ledger/ledger.accounts";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import type { UnitOfWork } from "@/server/unit-of-work";

export interface SettlementRunResult {
  processed: number;
  released: bigint;
}

/**
 * Moves producer funds PENDING → AVAILABLE once a payment's settlement date
 * (from its SettlementPolicy) has passed. Independent from the provider's own balance:
 * funds available at Stripe are not automatically available to the producer at Ripay.
 */
export class SettlementService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ledger: LedgerService,
    private readonly clock: Clock,
  ) {}

  async releaseDue(options: { now?: Date; organizationId?: string; limit?: number } = {}): Promise<SettlementRunResult> {
    const now = options.now ?? this.clock();
    const due = await this.uow.repos.payments.findDueForSettlement(now, options.limit ?? 500, options.organizationId);
    let released = 0n;
    for (const { id } of due) {
      released += await this.settlePayment(id, now);
    }
    if (due.length > 0) logger.info({ processed: due.length, released: released.toString() }, "settlement run finished");
    return { processed: due.length, released };
  }

  /** Releases whatever is still pending for this payment (after refunds/disputes). Idempotent. */
  async settlePayment(paymentId: string, now: Date): Promise<bigint> {
    return this.uow.transaction(async (repos) => {
      const payment = await repos.payments.lock(paymentId);
      if (payment.settledAt) return 0n;

      const pending = accountBalance("PRODUCER_PENDING", (await repos.ledger.totalsByAccountForPayment(payment.id)).PRODUCER_PENDING);
      if (pending > 0n) {
        await this.ledger.post(repos, {
          organizationId: payment.organizationId,
          idempotencyKey: `payment:${payment.id}:settled`,
          type: "settlement.released",
          referenceType: "Payment",
          referenceId: payment.id,
          paymentId: payment.id,
          currency: assertSupportedCurrency(payment.currency),
          description: "Liberação do saldo (settlement)",
          lines: [
            { account: "PRODUCER_PENDING", direction: "DEBIT", amount: pending },
            { account: "PRODUCER_AVAILABLE", direction: "CREDIT", amount: pending },
          ],
        });
        await repos.outbox.add(
          createDomainEvent("settlement.released", payment.id, payment.organizationId, { amount: pending, currency: payment.currency }),
        );
      }
      await repos.payments.update(payment.id, { settledAt: now });
      return pending > 0n ? pending : 0n;
    });
  }
}
