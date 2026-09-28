import type { PaymentMethodType, PaymentProviderType } from "@/generated/prisma/enums";
import { addDays, type Clock } from "@/lib/clock";
import { NotFoundError, ProviderError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import { logger } from "@/lib/logger";
import { assertSupportedCurrency, money } from "@/lib/money";
import type { NormalizedProviderEvent, PaymentProvider } from "@/lib/providers/payment/types";
import { calculateFeeBreakdown, NO_PLATFORM_FEE } from "@/modules/fees/fee.calculator";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import type { Repositories } from "@/server/repositories";
import type { UnitOfWork } from "@/server/unit-of-work";
import { canTransition, isCaptured } from "./payment-status";

type SucceededEvent = Extract<NormalizedProviderEvent, { kind: "payment.succeeded" }>;

export interface StartPaymentInput {
  organizationId: string;
  orderId: string;
  customer: { id: string; email: string; name: string; country: string | null };
  amount: bigint;
  currency: string;
  paymentMethods: PaymentMethodType[];
  description: string;
  offerId: string;
}

export interface StartPaymentResult {
  paymentId: string;
  provider: PaymentProviderType;
  clientSecret: string | null;
}

export interface PaymentServiceConfig {
  defaultSettlementDelayDays: number;
}

/**
 * Buyer-side money movement. A Payment only becomes PAID from a VERIFIED provider event
 * (webhook) — never from a browser redirect or client-side confirmation.
 */
export class PaymentService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly provider: PaymentProvider,
    private readonly ledger: LedgerService,
    private readonly clock: Clock,
    private readonly config: PaymentServiceConfig,
  ) {}

  /** 1) create Payment (CREATED) → 2) provider payment (idempotent) → 3) store provider id. */
  async start(input: StartPaymentInput): Promise<StartPaymentResult> {
    const currency = assertSupportedCurrency(input.currency);
    const payment = await this.uow.transaction(async (repos) => {
      const created = await repos.payments.create({
        organizationId: input.organizationId,
        orderId: input.orderId,
        customerId: input.customer.id,
        provider: this.provider.type,
        amount: input.amount,
        currency,
      });
      await repos.outbox.add(
        createDomainEvent("payment.created", created.id, input.organizationId, { orderId: input.orderId, amount: input.amount, currency }),
      );
      return created;
    });

    const metadata = {
      organizationId: input.organizationId,
      orderId: input.orderId,
      paymentId: payment.id,
      customerId: input.customer.id,
      offerId: input.offerId,
    };

    const providerCustomerId = await this.ensureProviderCustomer(input.customer, metadata);
    const result = await this.provider.createPayment({
      amount: input.amount,
      currency,
      providerCustomerId,
      paymentMethods: input.paymentMethods,
      description: input.description,
      metadata,
      idempotencyKey: `payment:${payment.id}`,
    });

    await this.uow.repos.payments.update(payment.id, {
      providerPaymentId: result.providerPaymentId,
      providerCustomerId: providerCustomerId ?? null,
      status: "PENDING",
    });

    return { paymentId: payment.id, provider: this.provider.type, clientSecret: result.clientSecret };
  }

  private async ensureProviderCustomer(
    customer: StartPaymentInput["customer"],
    metadata: Record<string, string>,
  ): Promise<string | undefined> {
    const existing = await this.uow.repos.customers.findProviderCustomerId(customer.id, this.provider.type);
    if (existing) return existing;
    const { providerCustomerId } = await this.provider.createCustomer({
      email: customer.email,
      name: customer.name,
      country: customer.country,
      metadata: { organizationId: metadata.organizationId, customerId: customer.id },
      idempotencyKey: `customer:${customer.id}:${this.provider.type}`,
    });
    await this.uow.repos.customers.linkProviderCustomer(customer.id, this.provider.type, providerCustomerId);
    return providerCustomerId;
  }

  /**
   * Applies a confirmed capture atomically:
   * Payment PAID + Order PAID + Transactions + ledger journal + balance projection + outbox.
   * Idempotent: a duplicate/late event for an already captured payment is a no-op.
   */
  async applySucceeded(provider: PaymentProviderType, event: SucceededEvent): Promise<"applied" | "duplicate"> {
    return this.uow.transaction(async (repos) => {
      const found = await repos.payments.findByProviderPaymentId(provider, event.providerPaymentId);
      if (!found) throw new NotFoundError("Payment", event.providerPaymentId);
      const payment = await repos.payments.lock(found.id);
      if (isCaptured(payment.status)) return "duplicate";

      if (event.currency !== payment.currency || event.amount !== payment.amount) {
        throw new ProviderError(provider, "Captured amount does not match the Ripay payment", {
          paymentId: payment.id,
          expected: `${payment.amount} ${payment.currency}`,
          received: `${event.amount} ${event.currency}`,
        });
      }

      const organization = await repos.organizations.findById(payment.organizationId);
      if (!organization) throw new NotFoundError("Organization", payment.organizationId);
      const scope = { organizationId: organization.id, country: organization.country, currency: payment.currency };
      const feeRule = (await repos.policies.findPlatformFeeRule(scope)) ?? NO_PLATFORM_FEE;
      const delayDays = (await repos.policies.findSettlementDelayDays(scope)) ?? this.config.defaultSettlementDelayDays;

      const gross = money(payment.amount, payment.currency);
      const fees = calculateFeeBreakdown(gross, money(event.processorFeeAmount, payment.currency), feeRule);
      const paidAt = event.occurredAt;

      await repos.payments.update(payment.id, {
        status: "PAID",
        paidAt,
        paymentMethod: event.paymentMethod ?? payment.paymentMethod,
        providerChargeId: event.providerChargeId,
        processorFeeAmount: fees.processorFeeAmount.amount,
        platformFeeAmount: fees.platformFeeAmount.amount,
        producerNetAmount: fees.producerNetAmount.amount,
        settleAt: addDays(paidAt, delayDays),
      });
      await repos.orders.setStatus(payment.orderId, "PAID");

      const providerTxId = event.providerChargeId ?? event.providerPaymentId;
      await repos.transactions.record({
        organizationId: payment.organizationId,
        paymentId: payment.id,
        provider,
        providerTransactionId: providerTxId,
        type: "PAYMENT",
        amount: payment.amount,
        currency: payment.currency,
        status: "SUCCEEDED",
        occurredAt: paidAt,
      });
      if (fees.processorFeeAmount.amount > 0n) {
        await repos.transactions.record({
          organizationId: payment.organizationId,
          paymentId: payment.id,
          provider,
          providerTransactionId: providerTxId,
          type: "FEE",
          amount: fees.processorFeeAmount.amount,
          currency: payment.currency,
          status: "SUCCEEDED",
          occurredAt: paidAt,
        });
      }

      await this.ledger.post(repos, {
        organizationId: payment.organizationId,
        idempotencyKey: `payment:${payment.id}:captured`,
        type: "payment.captured",
        referenceType: "Payment",
        referenceId: payment.id,
        paymentId: payment.id,
        currency: gross.currency,
        description: "Venda confirmada",
        lines: [
          { account: "PLATFORM_CASH", direction: "DEBIT", amount: fees.grossAmount.amount, description: "Valor bruto da venda" },
          { account: "PROCESSOR_FEES", direction: "CREDIT", amount: fees.processorFeeAmount.amount, description: "Taxa de processamento" },
          { account: "PLATFORM_REVENUE", direction: "CREDIT", amount: fees.platformFeeAmount.amount, description: "Taxa Ripay" },
          { account: "PRODUCER_PENDING", direction: "CREDIT", amount: fees.producerNetAmount.amount, description: "Saldo pendente do produtor" },
        ],
      });

      await this.grantAccess(repos, payment.orderId, payment.customerId);
      await repos.outbox.add(
        createDomainEvent("payment.paid", payment.id, payment.organizationId, {
          orderId: payment.orderId,
          amount: payment.amount,
          currency: payment.currency,
          producerNetAmount: fees.producerNetAmount.amount,
        }),
      );
      return "applied";
    });
  }

  /** Enrolls the buyer in any course sold by the order (member area access). */
  private async grantAccess(repos: Repositories, orderId: string, customerId: string) {
    for (const productId of await repos.orders.productIds(orderId)) {
      const course = await repos.courses.findByProductId(productId);
      if (course) await repos.courses.enroll({ courseId: course.id, customerId, orderId });
    }
  }

  async applyStatus(
    provider: PaymentProviderType,
    providerPaymentId: string,
    status: "PROCESSING" | "FAILED" | "CANCELED",
    reason?: string | null,
  ): Promise<"applied" | "skipped"> {
    return this.uow.transaction(async (repos) => {
      const found = await repos.payments.findByProviderPaymentId(provider, providerPaymentId);
      if (!found) throw new NotFoundError("Payment", providerPaymentId);
      const payment = await repos.payments.lock(found.id);
      if (!canTransition(payment.status, status)) {
        logger.info({ paymentId: payment.id, from: payment.status, to: status }, "ignoring out-of-order payment status");
        return "skipped";
      }
      const now = this.clock();
      await repos.payments.update(payment.id, {
        status,
        ...(status === "FAILED" ? { failedAt: now, failureReason: reason ?? null } : {}),
        ...(status === "CANCELED" ? { canceledAt: now } : {}),
      });
      if (status === "FAILED") {
        await repos.outbox.add(createDomainEvent("payment.failed", payment.id, payment.organizationId, { reason: reason ?? null }));
      }
      if (status === "CANCELED") await repos.orders.setStatus(payment.orderId, "CANCELED");
      return "applied";
    });
  }

  /** Re-fetches the client secret for a retried checkout attempt (secrets are never persisted). */
  async resumeClientSecret(paymentId: string): Promise<string | null> {
    const payment = await this.uow.repos.payments.findById(paymentId);
    if (!payment?.providerPaymentId) return null;
    return (await this.provider.getPayment(payment.providerPaymentId)).clientSecret;
  }

  /** Public, non-sensitive status lookup used by the checkout success page. */
  async getPublicStatus(paymentId: string) {
    const payment = await this.uow.repos.payments.findById(paymentId);
    if (!payment) throw new NotFoundError("Payment", paymentId);
    return { id: payment.id, status: payment.status, amount: payment.amount, currency: payment.currency };
  }
}
