import { logger } from "@/lib/logger";
import type { TrackingInput } from "@/modules/checkout/checkout.schemas";
import type { AnalyticsEventRepository, CheckoutEventType } from "./analytics-event.repository";

export interface TrackCheckoutEventInput {
  eventType: CheckoutEventType;
  organizationId: string;
  checkoutId: string;
  sessionId: string;
  customerId?: string | null;
  orderId?: string | null;
  tracking: TrackingInput;
  properties?: Record<string, unknown>;
}

/** Best-effort event ingestion: analytics must never break a checkout. */
export class TrackingService {
  constructor(private readonly events: AnalyticsEventRepository) {}

  async trackCheckout(input: TrackCheckoutEventInput): Promise<void> {
    try {
      await this.events.record({
        eventType: input.eventType,
        organizationId: input.organizationId,
        checkoutId: input.checkoutId,
        sessionId: input.sessionId,
        customerId: input.customerId ?? null,
        orderId: input.orderId ?? null,
        tracking: {
          utm_source: input.tracking.utm_source ?? null,
          utm_medium: input.tracking.utm_medium ?? null,
          utm_campaign: input.tracking.utm_campaign ?? null,
          utm_content: input.tracking.utm_content ?? null,
          utm_term: input.tracking.utm_term ?? null,
          referrer: input.tracking.referrer ?? null,
          affiliateId: input.tracking.affiliateId ?? null,
        },
        properties: input.properties,
        createdAt: new Date(),
      });
    } catch (err) {
      logger.warn({ err, eventType: input.eventType }, "failed to record analytics event");
    }
  }

  funnel(organizationId: string, sinceDays: number) {
    return this.events.countByType(organizationId, new Date(Date.now() - sinceDays * 86_400_000));
  }

  topSources(organizationId: string, sinceDays: number) {
    return this.events.topSources(organizationId, new Date(Date.now() - sinceDays * 86_400_000), 5);
  }
}
