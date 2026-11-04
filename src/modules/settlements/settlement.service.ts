import type { Clock } from "@/lib/clock";
import { createDomainEvent } from "@/lib/events/domain-event";
import { logger } from "@/lib/logger";
import { assertSupportedCurrency } from "@/lib/money";
import type { AffiliateService } from "@/modules/affiliates/affiliate.service";
import type { FinanceOverviewService } from "@/modules/balances/finance-overview.service";
import { FAST_CARD_SETTLEMENT_DAYS, FAST_SETTLEMENT_MIN_REVENUE } from "@/modules/balances/settlement-terms";
import { accountBalance } from "@/modules/ledger/ledger.accounts";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import type { UnitOfWork } from "@/server/unit-of-work";

export interface SettlementRunResult {
  processed: number;
  released: bigint;
}

export interface FastSettlementDecision {
  granted: boolean;
  /** Quanto a conta precisa ter vendido — o que a tela diz a quem ainda não chegou lá. */
  minimumRevenue: bigint;
  revenue: bigint;
}

/**
 * Moves producer funds PENDING → AVAILABLE once a payment's settlement date
 * (from its SettlementPolicy) has passed. Independent from the provider's own balance:
 * funds available at Stripe are not automatically available to the producer at Kabrun.
 */
export class SettlementService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ledger: LedgerService,
    private readonly affiliates: AffiliateService,
    private readonly finance: FinanceOverviewService,
    private readonly clock: Clock,
  ) {}

  /**
   * Pedido de recebimento de cartão em 2 dias, decidido na hora pelo faturamento da conta.
   *
   * Receber antes é a Kabrun adiantando dinheiro que a bandeira só paga depois — quem já
   * vendeu muito tem como cobrir um estorno, quem está começando não. Acima do mínimo a
   * liberação é automática e vale só para o cartão: Pix e boleto já caem em dois dias.
   * Abaixo, nada muda e a conta continua no prazo que já tinha.
   */
  async requestFastCardSettlement(input: { organizationId: string; currency: string; userId?: string | null }): Promise<FastSettlementDecision> {
    const currency = assertSupportedCurrency(input.currency);
    const { grossRevenue } = await this.finance.summary(input.organizationId, currency);
    const minimumRevenue = FAST_SETTLEMENT_MIN_REVENUE[currency];
    if (grossRevenue < minimumRevenue) return { granted: false, minimumRevenue, revenue: grossRevenue };

    await this.uow.transaction(async (repos) => {
      await repos.policies.setOrganizationSettlementDelay({
        organizationId: input.organizationId,
        currency,
        method: "CREDIT_CARD",
        delayDays: FAST_CARD_SETTLEMENT_DAYS,
      });
      await repos.audit.record({
        organizationId: input.organizationId,
        userId: input.userId,
        action: "settlement.fast_card_enabled",
        entity: "SettlementPolicy",
        entityId: input.organizationId,
        metadata: { currency, delayDays: FAST_CARD_SETTLEMENT_DAYS, revenue: grossRevenue },
      });
    });
    return { granted: true, minimumRevenue, revenue: grossRevenue };
  }

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
      // The producer's money is out of the window, so the affiliate's is too.
      await repos.affiliates.markSettledCommissions([payment.id]);
      // A comissão já está na conta de quem indicou desde a venda; aqui ela só sai do
      // pendente para o disponível, junto com a do produtor.
      await this.affiliates.releaseSettledCommissions(repos, payment.orderId, now);
      await repos.payments.update(payment.id, { settledAt: now });
      return pending > 0n ? pending : 0n;
    });
  }
}
