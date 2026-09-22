import type { Dispute, Payment } from "@/generated/prisma/client";
import type { DisputeStatus, PaymentProviderType } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import { assertSupportedCurrency } from "@/lib/money";
import type { NormalizedProviderEvent } from "@/lib/providers/payment/types";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import { producerAccountFor, splitByOriginalShares } from "@/modules/payments/payment-shares";
import type { Repositories } from "@/server/repositories";
import type { UnitOfWork } from "@/server/unit-of-work";

type DisputeEvent = Extract<NormalizedProviderEvent, { kind: "dispute.updated" }>;

const STATUS_MAP: Record<DisputeEvent["status"], DisputeStatus> = {
  open: "OPEN",
  under_review: "UNDER_REVIEW",
  won: "WON",
  lost: "LOST",
};

/**
 * Chargebacks:
 * - opened → producer share of the disputed amount is moved to RESERVES (held);
 * - won    → held amount returns to the producer;
 * - lost   → held amount + platform/processor shares leave platform cash (CHARGEBACKS expense).
 * Events may arrive out of order; each ledger step has its own idempotency key.
 */
export class DisputeService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ledger: LedgerService,
  ) {}

  async apply(provider: PaymentProviderType, event: DisputeEvent): Promise<void> {
    await this.uow.transaction(async (repos) => {
      const found = await repos.payments.findByProviderPaymentId(provider, event.providerPaymentId);
      if (!found) throw new NotFoundError("Payment", event.providerPaymentId);
      const payment = await repos.payments.lock(found.id);

      let dispute = await repos.disputes.findByProviderDisputeId(event.providerDisputeId);
      if (!dispute) dispute = await this.open(repos, payment, event);
      dispute = await repos.disputes.lock(dispute.id);
      if (dispute.status === "WON" || dispute.status === "LOST" || dispute.status === "CLOSED") return;

      const status = STATUS_MAP[event.status];
      if (status === "WON") await this.release(repos, payment, dispute);
      else if (status === "LOST") await this.lose(repos, payment, dispute);
      else await repos.disputes.update(dispute.id, { status, evidenceDueAt: event.evidenceDueAt });
    });
  }

  private async open(repos: Repositories, payment: Payment, event: DisputeEvent): Promise<Dispute> {
    const shares = splitByOriginalShares(payment, event.amount);
    const dispute = await repos.disputes.create({
      organizationId: payment.organizationId,
      paymentId: payment.id,
      providerDisputeId: event.providerDisputeId,
      amount: event.amount,
      currency: event.currency,
      heldAmount: shares.producer,
      reason: event.reason,
      status: "OPEN",
      evidenceDueAt: event.evidenceDueAt,
    });
    await this.ledger.post(repos, {
      organizationId: payment.organizationId,
      idempotencyKey: `dispute:${dispute.id}:hold`,
      type: "dispute.hold",
      referenceType: "Dispute",
      referenceId: dispute.id,
      paymentId: payment.id,
      currency: assertSupportedCurrency(payment.currency),
      description: "Reserva por disputa/chargeback",
      lines: [
        { account: producerAccountFor(payment), direction: "DEBIT", amount: shares.producer },
        { account: "RESERVES", direction: "CREDIT", amount: shares.producer },
      ],
    });
    await repos.outbox.add(createDomainEvent("dispute.created", dispute.id, payment.organizationId, { paymentId: payment.id, amount: event.amount }));
    return dispute;
  }

  private async release(repos: Repositories, payment: Payment, dispute: Dispute) {
    await this.ledger.post(repos, {
      organizationId: payment.organizationId,
      idempotencyKey: `dispute:${dispute.id}:released`,
      type: "dispute.won",
      referenceType: "Dispute",
      referenceId: dispute.id,
      paymentId: payment.id,
      currency: assertSupportedCurrency(payment.currency),
      description: "Disputa ganha — reserva liberada",
      lines: [
        { account: "RESERVES", direction: "DEBIT", amount: dispute.heldAmount },
        { account: producerAccountFor(payment), direction: "CREDIT", amount: dispute.heldAmount },
      ],
    });
    await repos.disputes.update(dispute.id, { status: "WON", closedAt: new Date() });
    await repos.outbox.add(createDomainEvent("dispute.closed", dispute.id, payment.organizationId, { outcome: "won" }));
  }

  private async lose(repos: Repositories, payment: Payment, dispute: Dispute) {
    const shares = splitByOriginalShares(payment, dispute.amount);
    await this.ledger.post(repos, {
      organizationId: payment.organizationId,
      idempotencyKey: `dispute:${dispute.id}:lost`,
      type: "dispute.lost",
      referenceType: "Dispute",
      referenceId: dispute.id,
      paymentId: payment.id,
      currency: assertSupportedCurrency(payment.currency),
      description: "Chargeback perdido",
      lines: [
        { account: "RESERVES", direction: "DEBIT", amount: dispute.heldAmount },
        { account: "PLATFORM_REVENUE", direction: "DEBIT", amount: shares.platform },
        { account: "CHARGEBACKS", direction: "DEBIT", amount: shares.processor },
        { account: "PLATFORM_CASH", direction: "CREDIT", amount: dispute.amount },
      ],
    });
    await repos.disputes.update(dispute.id, { status: "LOST", closedAt: new Date() });
    await repos.payments.update(payment.id, { status: "CHARGEBACK" });
    await repos.transactions.record({
      organizationId: payment.organizationId,
      paymentId: payment.id,
      provider: payment.provider,
      providerTransactionId: dispute.providerDisputeId,
      type: "CHARGEBACK",
      amount: dispute.amount,
      currency: dispute.currency,
      status: "SUCCEEDED",
      occurredAt: new Date(),
    });
    await repos.outbox.add(createDomainEvent("dispute.closed", dispute.id, payment.organizationId, { outcome: "lost" }));
  }
}
