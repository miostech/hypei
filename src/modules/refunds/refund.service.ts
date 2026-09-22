import type { PaymentProviderType } from "@/generated/prisma/enums";
import { NotFoundError, RefundNotAllowedError, ValidationError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import { assertSupportedCurrency } from "@/lib/money";
import type { NormalizedProviderEvent, PaymentProvider } from "@/lib/providers/payment/types";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import { producerAccountFor, splitByOriginalShares } from "@/modules/payments/payment-shares";
import type { Repositories } from "@/server/repositories";
import type { UnitOfWork } from "@/server/unit-of-work";

type RefundSucceeded = Extract<NormalizedProviderEvent, { kind: "refund.succeeded" }>;

export interface RequestRefundInput {
  organizationId: string;
  paymentId: string;
  amount: bigint;
  reason?: string;
  /** Client-generated; retries with the same key never create a second refund. */
  idempotencyKey: string;
  userId?: string | null;
}

/**
 * Refund policy (explicit, documented in ADR 005):
 * - producer share and Hypei fee are reversed proportionally;
 * - the processor fee the PSP does not return is absorbed by the platform (REFUNDS expense);
 * - producer balance may go negative ONLY through reversals (refund/chargeback), never through payouts.
 */
export class RefundService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly provider: PaymentProvider,
    private readonly ledger: LedgerService,
  ) {}

  async request(input: RequestRefundInput) {
    if (input.amount <= 0n) throw new ValidationError("Refund amount must be positive");

    const refund = await this.uow.transaction(async (repos) => {
      const existing = await repos.refunds.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;

      const found = await repos.payments.findForOrganization(input.organizationId, input.paymentId);
      if (!found) throw new NotFoundError("Payment", input.paymentId);
      const payment = await repos.payments.lock(found.id);
      if (payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED") {
        throw new RefundNotAllowedError(`Payment in status ${payment.status} cannot be refunded`);
      }
      const committed = await repos.refunds.committedAmount(payment.id);
      if (committed + input.amount > payment.amount) {
        throw new RefundNotAllowedError(
          `Refund exceeds refundable amount (paid ${payment.amount}, already refunded/in progress ${committed})`,
        );
      }
      const created = await repos.refunds.create({
        organizationId: payment.organizationId,
        paymentId: payment.id,
        amount: input.amount,
        currency: payment.currency,
        reason: input.reason ?? null,
        idempotencyKey: input.idempotencyKey,
      });
      await repos.audit.record({
        organizationId: payment.organizationId,
        userId: input.userId,
        action: "refund.requested",
        entity: "Refund",
        entityId: created.id,
        metadata: { paymentId: payment.id, amount: input.amount },
      });
      await repos.outbox.add(createDomainEvent("refund.created", created.id, payment.organizationId, { paymentId: payment.id, amount: input.amount }));
      return created;
    });

    if (refund.providerRefundId || refund.status !== "REQUESTED") return refund;

    const payment = await this.uow.repos.payments.findById(refund.paymentId);
    if (!payment?.providerPaymentId) throw new NotFoundError("Payment", refund.paymentId);
    const result = await this.provider.refundPayment({
      providerPaymentId: payment.providerPaymentId,
      amount: refund.amount,
      currency: assertSupportedCurrency(refund.currency),
      reason: refund.reason ?? undefined,
      metadata: { organizationId: refund.organizationId, paymentId: payment.id, refundId: refund.id },
      idempotencyKey: `refund:${refund.id}`,
    });
    // Ledger only moves when the provider CONFIRMS the refund (webhook).
    return this.uow.repos.refunds.update(refund.id, { providerRefundId: result.providerRefundId, status: "PROCESSING" });
  }

  /** Applies a provider-confirmed refund. Idempotent per refund. */
  async applySucceeded(provider: PaymentProviderType, event: RefundSucceeded): Promise<"applied" | "duplicate"> {
    return this.uow.transaction(async (repos) => {
      const found = await repos.payments.findByProviderPaymentId(provider, event.providerPaymentId);
      if (!found) throw new NotFoundError("Payment", event.providerPaymentId);
      const payment = await repos.payments.lock(found.id);

      let refund = await repos.refunds.findByProviderRefundId(event.providerRefundId);
      if (!refund) {
        // Refund initiated outside Hypei (e.g. provider dashboard): record it now.
        refund = await repos.refunds.create({
          organizationId: payment.organizationId,
          paymentId: payment.id,
          amount: event.amount,
          currency: event.currency,
          reason: "external",
          idempotencyKey: `provider-refund:${event.providerRefundId}`,
          providerRefundId: event.providerRefundId,
        });
      }
      if (refund.status === "PAID") return "duplicate";
      if (payment.refundedAmount + refund.amount > payment.amount) {
        throw new RefundNotAllowedError("Confirmed refunds exceed the captured amount");
      }

      await this.postReversal(repos, payment, refund.id, refund.amount);

      const refundedAmount = payment.refundedAmount + refund.amount;
      const fullyRefunded = refundedAmount === payment.amount;
      await repos.payments.update(payment.id, {
        refundedAmount,
        status: payment.status === "CHARGEBACK" ? "CHARGEBACK" : fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      });
      await repos.orders.setStatus(payment.orderId, fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED");
      await repos.refunds.update(refund.id, { status: "PAID", completedAt: event.occurredAt });
      await repos.transactions.record({
        organizationId: payment.organizationId,
        paymentId: payment.id,
        provider,
        providerTransactionId: event.providerRefundId,
        type: "REFUND",
        amount: refund.amount,
        currency: refund.currency,
        status: "SUCCEEDED",
        occurredAt: event.occurredAt,
      });
      await repos.outbox.add(createDomainEvent("refund.completed", refund.id, payment.organizationId, { paymentId: payment.id, amount: refund.amount }));
      return "applied";
    });
  }

  async applyFailed(providerRefundId: string, reason: string | null) {
    const refund = await this.uow.repos.refunds.findByProviderRefundId(providerRefundId);
    if (!refund || refund.status === "PAID") return;
    await this.uow.repos.refunds.update(refund.id, { status: "FAILED", failureReason: reason });
  }

  private async postReversal(
    repos: Repositories,
    payment: Parameters<typeof splitByOriginalShares>[0],
    refundId: string,
    amount: bigint,
  ) {
    const shares = splitByOriginalShares(payment, amount);
    await this.ledger.post(repos, {
      organizationId: payment.organizationId,
      idempotencyKey: `refund:${refundId}`,
      type: "refund.completed",
      referenceType: "Refund",
      referenceId: refundId,
      paymentId: payment.id,
      currency: assertSupportedCurrency(payment.currency),
      description: "Reembolso ao comprador",
      lines: [
        { account: producerAccountFor(payment), direction: "DEBIT", amount: shares.producer, description: "Estorno da parte do produtor" },
        { account: "PLATFORM_REVENUE", direction: "DEBIT", amount: shares.platform, description: "Estorno da taxa Hypei" },
        { account: "REFUNDS", direction: "DEBIT", amount: shares.processor, description: "Taxa de processamento não recuperada" },
        { account: "PLATFORM_CASH", direction: "CREDIT", amount, description: "Devolução ao comprador" },
      ],
    });
  }
}
