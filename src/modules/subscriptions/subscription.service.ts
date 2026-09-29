import type { BillingInterval, PaymentProviderType, Subscription, SubscriptionStatus } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import { logger } from "@/lib/logger";
import type { NormalizedProviderEvent, PaymentProvider } from "@/lib/providers/payment/types";
import type { PaymentService } from "@/modules/payments/payment.service";
import type { Repositories } from "@/server/repositories";
import type { UnitOfWork } from "@/server/unit-of-work";

type SubscriptionEvent = Extract<NormalizedProviderEvent, { kind: "subscription.updated" }>;
type InvoicePaidEvent = Extract<NormalizedProviderEvent, { kind: "subscription.invoice_paid" }>;

const STATUS: Record<SubscriptionEvent["status"], SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  paused: "PAUSED",
  canceled: "CANCELED",
  unpaid: "UNPAID",
};

/** Access is kept only while the subscription is actually being paid. */
const ACCESS_GRANTING: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

const INTERVAL_DAYS: Record<BillingInterval, number> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};

export function nextPeriodEnd(from: Date, interval: BillingInterval): Date {
  return new Date(from.getTime() + INTERVAL_DAYS[interval] * 86_400_000);
}

/**
 * Subscription state is synchronized ONLY from provider events, never from a frontend
 * callback. A renewal arrives as an invoice paid by the provider and becomes a regular
 * sale in Ripay: same fees, same ledger, same member-area access.
 */
export class SubscriptionService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly provider: PaymentProvider,
    private readonly payments: PaymentService,
  ) {}

  list(organizationId: string) {
    return this.uow.repos.subscriptions.list(organizationId);
  }

  async get(organizationId: string, id: string) {
    const subscription = await this.uow.repos.subscriptions.findForOrganization(organizationId, id);
    if (!subscription) throw new NotFoundError("Subscription", id);
    return subscription;
  }

  /**
   * Registers the subscription that a checkout just started. The first charge is the
   * payment created by the checkout itself; renewals come from the provider.
   */
  async createFromCheckout(
    repos: Repositories,
    input: {
      organizationId: string;
      customerId: string;
      offerId: string;
      amount: bigint;
      currency: string;
      billingInterval: BillingInterval;
      trialDays: number | null;
      startedAt: Date;
    },
  ): Promise<Subscription> {
    const trialing = (input.trialDays ?? 0) > 0;
    const periodEnd = trialing
      ? new Date(input.startedAt.getTime() + (input.trialDays ?? 0) * 86_400_000)
      : nextPeriodEnd(input.startedAt, input.billingInterval);

    const subscription = await repos.subscriptions.create({
      organizationId: input.organizationId,
      customerId: input.customerId,
      offerId: input.offerId,
      provider: this.provider.type,
      status: trialing ? "TRIALING" : "ACTIVE",
      amount: input.amount,
      currency: input.currency,
      billingInterval: input.billingInterval,
      currentPeriodStart: input.startedAt,
      currentPeriodEnd: periodEnd,
    });

    await repos.outbox.add(
      createDomainEvent("subscription.created", subscription.id, input.organizationId, {
        customerId: input.customerId,
        amount: input.amount,
        currency: input.currency,
      }),
    );
    return subscription;
  }

  /** Stores the provider id once the subscription exists on their side. */
  async attachProviderId(id: string, providerSubscriptionId: string) {
    await this.uow.repos.subscriptions.update(id, { providerSubscriptionId });
  }

  async applyProviderUpdate(provider: PaymentProviderType, event: SubscriptionEvent): Promise<boolean> {
    const subscription = await this.uow.repos.subscriptions.findByProviderId(provider, event.providerSubscriptionId);
    if (!subscription) {
      logger.info({ providerSubscriptionId: event.providerSubscriptionId }, "subscription not tracked yet");
      return false;
    }

    const status = STATUS[event.status];
    await this.uow.transaction(async (repos) => {
      await repos.subscriptions.update(subscription.id, {
        status,
        currentPeriodStart: event.currentPeriodStart,
        currentPeriodEnd: event.currentPeriodEnd,
        cancelAtPeriodEnd: event.cancelAtPeriodEnd,
        canceledAt: status === "CANCELED" ? event.occurredAt : null,
      });
      await this.syncAccess(repos, subscription, status);

      if (status !== subscription.status) {
        await repos.outbox.add(
          createDomainEvent(
            status === "CANCELED" ? "subscription.canceled" : "subscription.renewed",
            subscription.id,
            subscription.organizationId,
            { status, previousStatus: subscription.status },
          ),
        );
      }
    });
    return true;
  }

  /**
   * A billing cycle was charged. Creates the order and payment for it and runs the
   * same capture path as any other sale, so fees, ledger and access stay identical.
   */
  async applyInvoicePaid(provider: PaymentProviderType, event: InvoicePaidEvent): Promise<boolean> {
    const subscription = await this.uow.repos.subscriptions.findByProviderId(provider, event.providerSubscriptionId);
    if (!subscription) {
      logger.info({ providerSubscriptionId: event.providerSubscriptionId }, "invoice for unknown subscription");
      return false;
    }

    const existing = await this.uow.repos.payments.findByProviderPaymentId(provider, event.providerPaymentId);
    if (existing) return true; // Webhooks are at-least-once; the cycle is already recorded.

    const offer = await this.uow.repos.offers.findById(subscription.organizationId, subscription.offerId);
    if (!offer) throw new NotFoundError("Offer", subscription.offerId);

    const payment = await this.uow.transaction(async (repos) => {
      const order = await repos.orders.create({
        organizationId: subscription.organizationId,
        customerId: subscription.customerId,
        currency: subscription.currency,
        subtotalAmount: event.amount,
        discountAmount: 0n,
        taxAmount: 0n,
        totalAmount: event.amount,
        items: [
          {
            offerId: offer.id,
            productName: offer.product?.name ?? offer.name,
            offerName: offer.name,
            quantity: 1,
            unitAmount: event.amount,
            totalAmount: event.amount,
          },
        ],
      });

      const created = await repos.payments.create({
        organizationId: subscription.organizationId,
        orderId: order.id,
        customerId: subscription.customerId,
        subscriptionId: subscription.id,
        provider,
        amount: event.amount,
        currency: subscription.currency,
      });
      await repos.payments.update(created.id, { providerPaymentId: event.providerPaymentId, status: "PENDING" });

      await repos.subscriptions.update(subscription.id, {
        status: "ACTIVE",
        billingCycles: { increment: 1 },
        currentPeriodStart: event.currentPeriodStart ?? subscription.currentPeriodEnd,
        currentPeriodEnd:
          event.currentPeriodEnd ?? nextPeriodEnd(event.currentPeriodStart ?? event.occurredAt, subscription.billingInterval),
      });
      return created;
    });

    await this.payments.applySucceeded(provider, {
      kind: "payment.succeeded",
      providerPaymentId: event.providerPaymentId,
      providerChargeId: null,
      amount: event.amount,
      currency: event.currency,
      processorFeeAmount: event.processorFeeAmount,
      paymentMethod: "CREDIT_CARD",
      occurredAt: event.occurredAt,
    });
    logger.info({ subscriptionId: subscription.id, paymentId: payment.id }, "subscription renewed");
    return true;
  }

  /** Cancels at the end of the paid period (default) or straight away. */
  async cancel(organizationId: string, userId: string, id: string, mode: "at_period_end" | "now") {
    const subscription = await this.get(organizationId, id);
    if (subscription.status === "CANCELED") throw new ValidationError("Esta assinatura já está cancelada");

    if (subscription.providerSubscriptionId) {
      await this.provider.cancelSubscription(subscription.providerSubscriptionId, `subscription:${id}:cancel`);
    }

    await this.uow.transaction(async (repos) => {
      const status: SubscriptionStatus = mode === "now" ? "CANCELED" : subscription.status;
      await repos.subscriptions.update(id, {
        status,
        cancelAtPeriodEnd: mode === "at_period_end",
        canceledAt: mode === "now" ? new Date() : null,
      });
      if (mode === "now") await this.syncAccess(repos, subscription, "CANCELED");

      await repos.audit.record({
        organizationId,
        userId,
        action: "subscription.canceled",
        entity: "Subscription",
        entityId: id,
        metadata: { mode },
      });
      await repos.outbox.add(
        createDomainEvent("subscription.canceled", id, organizationId, { mode, customerId: subscription.customerId }),
      );
    });
  }

  /**
   * Keeps member-area access in step with the subscription: someone who stopped
   * paying stops watching, and comes back the moment the payment goes through.
   */
  private async syncAccess(repos: Repositories, subscription: Subscription, status: SubscriptionStatus) {
    const offer = await repos.offers.findById(subscription.organizationId, subscription.offerId);
    if (!offer) return;
    const course = await repos.courses.findByProductId(offer.productId);
    if (!course) return;

    if (ACCESS_GRANTING.includes(status)) {
      await repos.courses.restoreEnrollment(course.id, subscription.customerId);
    } else {
      await repos.courses.revokeEnrollment(course.id, subscription.customerId);
    }
  }
}
