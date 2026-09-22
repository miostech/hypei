import type { PaymentProviderType, SubscriptionStatus } from "@/generated/prisma/enums";
import { logger } from "@/lib/logger";
import type { NormalizedProviderEvent } from "@/lib/providers/payment/types";
import type { UnitOfWork } from "@/server/unit-of-work";

type SubscriptionEvent = Extract<NormalizedProviderEvent, { kind: "subscription.updated" }>;

const STATUS: Record<SubscriptionEvent["status"], SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  paused: "PAUSED",
  canceled: "CANCELED",
  unpaid: "UNPAID",
};

/**
 * Subscription state is synchronized ONLY from provider events (Stripe Billing),
 * never from a frontend success callback. Phase 1: status sync; creation flow in Phase 2.
 */
export class SubscriptionService {
  constructor(private readonly uow: UnitOfWork) {}

  async applyProviderUpdate(provider: PaymentProviderType, event: SubscriptionEvent): Promise<boolean> {
    const count = await this.uow.repos.subscriptions.updateByProviderId(provider, event.providerSubscriptionId, {
      status: STATUS[event.status],
      currentPeriodStart: event.currentPeriodStart,
      currentPeriodEnd: event.currentPeriodEnd,
      cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    });
    if (count === 0) logger.info({ providerSubscriptionId: event.providerSubscriptionId }, "subscription not tracked yet");
    return count > 0;
  }

  list(organizationId: string) {
    return this.uow.repos.subscriptions.list(organizationId);
  }
}
