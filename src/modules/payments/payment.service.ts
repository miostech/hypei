import type { PaymentMethodType, PaymentProviderType } from "@/generated/prisma/enums";
import { addDays, type Clock } from "@/lib/clock";
import { NotFoundError, ProviderError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import { logger } from "@/lib/logger";
import { assertSupportedCurrency, money, type Money } from "@/lib/money";
import type { NormalizedProviderEvent, PaymentProvider } from "@/lib/providers/payment/types";
import type { AffiliateService } from "@/modules/affiliates/affiliate.service";
import { calculateFeeBreakdown, publishedPlatformFee, type AffiliateShare } from "@/modules/fees/fee.calculator";
import { publishedReserve, reserveAmountFor } from "@/modules/reserves/reserve.calculator";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import { grantOrderAccess } from "@/modules/members/access";
import type { Repositories } from "@/server/repositories";
import type { UnitOfWork } from "@/server/unit-of-work";
import { canTransition, isCaptured } from "./payment-status";

type SucceededEvent = Extract<NormalizedProviderEvent, { kind: "payment.succeeded" }>;

export interface StartPaymentInput {
  organizationId: string;
  orderId: string;
  /** Set when this payment is the first cycle of a subscription. */
  subscriptionId?: string | null;
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
    private readonly affiliates: AffiliateService,
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
        subscriptionId: input.subscriptionId ?? null,
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
   * Quanto o afiliado ganha nesta venda, e sobre qual parte dela.
   *
   * A afiliação é por produto, então a base é só a fatia do produto afiliado — não o pedido
   * inteiro. Sem isto, um order bump de outro produto pagaria comissão a quem não o indicou.
   *
   * A afiliação é relida aqui, e não copiada da que valia no checkout, porque a comissão
   * congelada é a da afiliação; e `status` ou `active` podem ter mudado entre a criação do
   * pedido e a confirmação do pagamento. Quem foi desligado nesse intervalo não ganha.
   */
  private async affiliateShare(
    repos: Repositories,
    order: { id: string; affiliationId: string | null } | null,
    gross: Money,
  ): Promise<AffiliateShare | undefined> {
    if (!order?.affiliationId) return undefined;
    const affiliation = await repos.affiliates.findAffiliationById(order.affiliationId);
    if (!affiliation) return undefined;

    const affiliated = await repos.orders.productItemsTotal(order.id, affiliation.productId);
    return { bps: affiliation.commissionBps, base: money(affiliated, gross.currency) };
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
      // Sucesso que chega depois de uma falha: o uso do cupom foi devolvido quando ela
      // chegou, e esta venda com desconto precisa dele de volta.
      const couponWasReleased = payment.status === "FAILED" || payment.status === "CANCELED";

      if (event.currency !== payment.currency || event.amount !== payment.amount) {
        throw new ProviderError(provider, "Captured amount does not match the Kabrun payment", {
          paymentId: payment.id,
          expected: `${payment.amount} ${payment.currency}`,
          received: `${event.amount} ${event.currency}`,
        });
      }

      const organization = await repos.organizations.findById(payment.organizationId);
      if (!organization) throw new NotFoundError("Organization", payment.organizationId);
      // O meio de pagamento entra na conta do prazo: cartão demora a compensar, Pix e boleto não.
      const method = event.paymentMethod ?? payment.paymentMethod;
      const scope = { organizationId: organization.id, country: organization.country, currency: payment.currency, method };
      // Sem política cadastrada vale a taxa anunciada, não zero. O default anterior era
      // `NO_PLATFORM_FEE`, e faltar uma linha no banco não dava erro: dava venda de graça,
      // em silêncio, para sempre. Errar para o lado da taxa publicada é recuperável — o
      // produtor reclama e o valor se devolve. Errar para zero não aparece em lugar nenhum.
      const feeRule = (await repos.policies.findPlatformFeeRule(scope)) ?? publishedPlatformFee(payment.currency);
      const reserveRule = (await repos.policies.findReserveRule(scope)) ?? publishedReserve(payment.currency);
      const delayDays = (await repos.policies.findSettlementDelayDays(scope)) ?? this.config.defaultSettlementDelayDays;

      const gross = money(payment.amount, payment.currency);
      // A referred sale pays the affiliate out of the producer's share, so the
      // commission has to be known before the split is written anywhere.
      const order = await repos.orders.findById(payment.organizationId, payment.orderId);
      const fees = calculateFeeBreakdown(
        gross,
        money(event.processorFeeAmount, payment.currency),
        feeRule,
        await this.affiliateShare(repos, order, gross),
      );
      const paidAt = event.occurredAt;
      const reserved = reserveAmountFor(gross, fees.producerNetAmount, reserveRule);

      await repos.payments.update(payment.id, {
        status: "PAID",
        paidAt,
        paymentMethod: method,
        providerChargeId: event.providerChargeId,
        processorFeeAmount: fees.processorFeeAmount.amount,
        platformFeeAmount: fees.platformFeeAmount.amount,
        affiliateCommissionAmount: fees.affiliateCommissionAmount.amount,
        producerNetAmount: fees.producerNetAmount.amount,
        settleAt: addDays(paidAt, delayDays),
      });
      await repos.orders.setStatus(payment.orderId, "PAID");

      if (couponWasReleased && order?.couponId) {
        await repos.coupons.reclaimRedemption({
          couponId: order.couponId,
          orderId: order.id,
          customerId: payment.customerId,
          amount: order.discountAmount,
        });
      }

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
          { account: "PLATFORM_REVENUE", direction: "CREDIT", amount: fees.platformFeeAmount.amount, description: "Taxa Kabrun" },
          ...(fees.affiliateCommissionAmount.amount > 0n
            ? [
                {
                  account: "AFFILIATE_PAYABLE" as const,
                  direction: "CREDIT" as const,
                  amount: fees.affiliateCommissionAmount.amount,
                  description: "Comissão do afiliado",
                },
              ]
            : []),
          {
            account: "PRODUCER_PENDING",
            direction: "CREDIT",
            amount: fees.producerNetAmount.amount - reserved,
            description: "Saldo pendente do produtor",
          },
          // A reserva nasce fora do saldo dela: é dinheiro do produtor, mas que só passa a ser
          // sacável depois da janela de contestação.
          ...(reserved > 0n
            ? [{ account: "RESERVES" as const, direction: "CREDIT" as const, amount: reserved, description: "Reserva de segurança" }]
            : []),
        ],
      });

      if (reserved > 0n) {
        await repos.reserves.create({
          organizationId: payment.organizationId,
          amount: reserved,
          currency: payment.currency,
          reason: "security",
          referenceType: "Payment",
          referenceId: payment.id,
          releaseAt: addDays(paidAt, reserveRule.holdDays),
        });
      }

      if (order?.affiliateId && fees.affiliateCommissionAmount.amount > 0n) {
        await this.affiliates.recordCommission(repos, payment, {
          affiliateId: order.affiliateId,
          orderId: order.id,
          amount: fees.affiliateCommissionAmount.amount,
        });
      }

      await grantOrderAccess(repos, payment.orderId, payment.customerId);
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

      // Pagamento que não vai acontecer devolve o uso do cupom. Sem isto, PIX abandonado e
      // cartão recusado comiam a cota: o produtor anuncia 100 usos e entrega menos, e quem
      // teve o cartão recusado ouvia "você já usou este cupom" na segunda tentativa.
      if (status === "FAILED" || status === "CANCELED") {
        const order = await repos.orders.findById(payment.organizationId, payment.orderId);
        if (order?.couponId) await repos.coupons.releaseRedemption(order.couponId, order.id);
      }
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

  /**
   * Tudo que esta compra entregou, com o link de cada conteúdo publicado.
   *
   * A tela de obrigado nomeava só o produto do checkout. Com order bump isso passou a ser
   * mentira por omissão: quem pagou por três produtos era informado de um. A lista vem do
   * pedido, não do checkout, porque é o pedido que sabe o que foi realmente cobrado.
   *
   * Exposto pelo id do pagamento, como o status: é o que o comprador tem na mão ao voltar do
   * provedor, e não revela nada que ele já não tenha comprado.
   */
  async purchasedProducts(paymentId: string): Promise<{ name: string; courseSlug: string | null }[]> {
    const payment = await this.uow.repos.payments.findById(paymentId);
    if (!payment) throw new NotFoundError("Payment", paymentId);

    const products = await this.uow.repos.orders.itemProducts(payment.orderId);
    return Promise.all(
      products.map(async (product) => {
        const course = await this.uow.repos.courses.findByProductId(product.productId);
        return { name: product.productName, courseSlug: course?.published ? course.slug : null };
      }),
    );
  }
}
