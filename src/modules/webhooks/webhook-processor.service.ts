import type { PaymentProviderType } from "@/generated/prisma/enums";
import type { Clock } from "@/lib/clock";
import { logger } from "@/lib/logger";
import type { NormalizedProviderEvent, PaymentProvider } from "@/lib/providers/payment/types";
import type { DisputeService } from "@/modules/disputes/dispute.service";
import type { MerchantAccountService } from "@/modules/merchant-accounts/merchant-account.service";
import type { PaymentService } from "@/modules/payments/payment.service";
import type { PayoutService } from "@/modules/payouts/payout.service";
import type { RefundService } from "@/modules/refunds/refund.service";
import type { SubscriptionService } from "@/modules/subscriptions/subscription.service";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { WebhookPayloadRepository } from "./webhook-payload.repository";

export const MAX_WEBHOOK_ATTEMPTS = 8;

export interface WebhookHandlers {
  payments: PaymentService;
  refunds: RefundService;
  disputes: DisputeService;
  payouts: PayoutService;
  merchantAccounts: MerchantAccountService;
  subscriptions: SubscriptionService;
}

/**
 * Worker-side of webhooks. Translates provider payloads into normalized events and routes
 * them to domain services. Every handler is idempotent, so retries and out-of-order
 * delivery are safe; the WebhookEvent row guarantees one successful processing per event.
 */
export class WebhookProcessor {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly providers: Partial<Record<PaymentProviderType, PaymentProvider>>,
    private readonly payloads: WebhookPayloadRepository,
    private readonly handlers: WebhookHandlers,
    private readonly clock: Clock,
  ) {}

  async process(webhookEventId: string): Promise<void> {
    const event = await this.uow.repos.webhookEvents.claim(webhookEventId);
    if (!event) return; // already processed/being processed elsewhere

    try {
      const provider = this.providers[event.provider];
      if (!provider) throw new Error(`Provider ${event.provider} is not enabled`);
      const archived = await this.payloads.find(event.provider, event.providerEventId);
      if (!archived) throw new Error("Webhook payload not found in archive");

      const normalized = await provider.processWebhook({
        provider: event.provider,
        eventId: event.providerEventId,
        eventType: event.eventType,
        createdAt: event.receivedAt,
        payload: archived.payload,
      });

      let handled = false;
      for (const item of normalized) {
        handled = (await this.route(event.provider, item)) || handled;
      }
      await this.uow.repos.webhookEvents.markFinished(event.id, handled ? "PROCESSED" : "IGNORED");
    } catch (err) {
      const attempts = event.attempts;
      const next = attempts >= MAX_WEBHOOK_ATTEMPTS ? null : new Date(this.clock().getTime() + Math.min(3_600_000, 2 ** attempts * 5_000));
      logger.error({ err, webhookEventId: event.id, attempts }, "webhook processing failed");
      await this.uow.repos.webhookEvents.markFailed(event.id, err instanceof Error ? err.message : String(err), next);
      throw err;
    }
  }

  /** Re-processes FAILED events whose backoff elapsed (and stuck RECEIVED ones). */
  async retryDue(limit = 50): Promise<number> {
    const due = await this.uow.repos.webhookEvents.findRetryable(this.clock(), MAX_WEBHOOK_ATTEMPTS, limit);
    for (const e of due) await this.process(e.id).catch(() => undefined);
    return due.length;
  }

  private async route(provider: PaymentProviderType, event: NormalizedProviderEvent): Promise<boolean> {
    const h = this.handlers;
    switch (event.kind) {
      case "payment.succeeded":
        await h.payments.applySucceeded(provider, event);
        return true;
      case "payment.processing":
        await h.payments.applyStatus(provider, event.providerPaymentId, "PROCESSING");
        return true;
      case "payment.failed":
        await h.payments.applyStatus(provider, event.providerPaymentId, "FAILED", event.reason);
        return true;
      case "payment.canceled":
        await h.payments.applyStatus(provider, event.providerPaymentId, "CANCELED");
        return true;
      case "refund.succeeded":
        await h.refunds.applySucceeded(provider, event);
        return true;
      case "refund.failed":
        await h.refunds.applyFailed(event.providerRefundId, event.reason);
        return true;
      case "dispute.updated":
        await h.disputes.apply(provider, event);
        return true;
      case "payout.updated":
        return (await h.payouts.applyProviderUpdate(provider, event)) !== "ignored";
      case "merchant_account.updated":
        return (await h.merchantAccounts.applySnapshot(event.snapshot)) === "applied";
      case "subscription.updated":
        return h.subscriptions.applyProviderUpdate(provider, event);
      case "ignored":
        logger.debug({ reason: event.reason }, "webhook event ignored");
        return false;
    }
  }
}
