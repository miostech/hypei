import type { DomainEvent } from "@/lib/events/domain-event";
import type { EventBus } from "@/lib/events/event-bus";
import { logger } from "@/lib/logger";
import { formatMoney, money, type CurrencyCode } from "@/lib/money";
import type { EmailProvider } from "@/lib/providers/email/email-provider";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { EmailTemplate, RenderedEmail } from "./templates";
import { disputeOpened, payoutPaid, purchaseConfirmed, refundCompleted, saleCompleted } from "./templates";

/**
 * Turns domain events into transactional e-mail.
 *
 * Everything runs off the outbox, so a send is attempted only after the state change
 * is committed, and every attempt is recorded — the outbox is at-least-once, and
 * nobody should get two "your payout was sent" messages because a retry happened.
 */
export class NotificationService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly email: EmailProvider,
    private readonly config: { appUrl: string },
  ) {}

  /** Wires the subscriptions; called once when the container is built. */
  register(bus: EventBus): void {
    bus.subscribe("payment.paid", (event) => this.onPaymentPaid(event));
    bus.subscribe("refund.completed", (event) => this.onRefundCompleted(event));
    bus.subscribe("payout.paid", (event) => this.onPayoutPaid(event));
    bus.subscribe("dispute.created", (event) => this.onDisputeCreated(event));
  }

  private amount(value: bigint, currency: string): string {
    return formatMoney(money(value, currency as CurrencyCode));
  }

  private url(path: string): string {
    return new URL(path, this.config.appUrl).toString();
  }

  /**
   * Claims the send, mails it, and records the outcome. A failure is recorded and
   * rethrown so the outbox retries the event later.
   */
  private async deliver(input: {
    eventId: string;
    template: EmailTemplate;
    recipient: string | null;
    organizationId: string | null;
    rendered: RenderedEmail;
  }): Promise<void> {
    if (!input.recipient) {
      logger.warn({ template: input.template, eventId: input.eventId }, "no recipient for notification");
      return;
    }

    const { repos } = this.uow;
    const deliveryId = await repos.notifications.claim({
      eventId: input.eventId,
      template: input.template,
      recipient: input.recipient,
      subject: input.rendered.subject,
      organizationId: input.organizationId,
    });
    if (!deliveryId) return;

    try {
      const { id } = await this.email.send({
        to: input.recipient,
        subject: input.rendered.subject,
        html: input.rendered.html,
        text: input.rendered.text,
        tags: { template: input.template },
      });
      await repos.notifications.markSent(deliveryId, id);
      logger.info({ template: input.template, to: input.recipient }, "notification sent");
    } catch (err) {
      await repos.notifications.markFailed(deliveryId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /** Buyer gets the receipt and the access link; producer gets the sale. */
  private async onPaymentPaid(event: DomainEvent): Promise<void> {
    const context = await this.uow.repos.notifications.purchaseContext(event.aggregateId);
    if (!context) return;

    const accessUrl = context.courseSlug
      ? this.url(`/members/${context.organizationSlug}/courses/${context.courseSlug}`)
      : undefined;

    await this.deliver({
      eventId: event.id,
      template: "purchase.confirmed",
      recipient: context.customerEmail,
      organizationId: context.organizationId,
      rendered: purchaseConfirmed({
        customerName: context.customerName,
        productName: context.productName,
        amountLabel: this.amount(context.amount, context.currency),
        orderReference: context.orderReference,
        accessUrl,
        organizationName: context.organizationName,
        supportEmail: context.supportEmail ?? undefined,
      }),
    });

    await this.deliver({
      eventId: event.id,
      template: "sale.completed",
      recipient: context.producerEmail,
      organizationId: context.organizationId,
      rendered: saleCompleted({
        productName: context.productName,
        amountLabel: this.amount(context.amount, context.currency),
        netLabel: this.amount(context.netAmount, context.currency),
        customerName: context.customerName,
        customerEmail: context.customerEmail,
        dashboardUrl: this.url("/sales"),
        organizationName: context.organizationName,
      }),
    });
  }

  private async onRefundCompleted(event: DomainEvent): Promise<void> {
    const context = await this.uow.repos.notifications.refundContext(event.aggregateId);
    if (!context) return;

    await this.deliver({
      eventId: event.id,
      template: "refund.completed",
      recipient: context.customerEmail,
      organizationId: context.organizationId,
      rendered: refundCompleted({
        customerName: context.customerName,
        productName: context.productName,
        amountLabel: this.amount(context.amount, context.currency),
        organizationName: context.organizationName,
        supportEmail: context.supportEmail ?? undefined,
      }),
    });
  }

  private async onPayoutPaid(event: DomainEvent): Promise<void> {
    const context = await this.uow.repos.notifications.payoutContext(event.aggregateId);
    if (!context) return;

    await this.deliver({
      eventId: event.id,
      template: "payout.paid",
      recipient: context.producerEmail,
      organizationId: context.organizationId,
      rendered: payoutPaid({
        amountLabel: this.amount(context.amount, context.currency),
        destinationLabel: context.destinationLabel,
        financeUrl: this.url("/finance"),
        organizationName: context.organizationName,
      }),
    });
  }

  private async onDisputeCreated(event: DomainEvent): Promise<void> {
    const context = await this.uow.repos.notifications.disputeContext(event.aggregateId);
    if (!context) return;

    await this.deliver({
      eventId: event.id,
      template: "dispute.opened",
      recipient: context.producerEmail,
      organizationId: context.organizationId,
      rendered: disputeOpened({
        amountLabel: this.amount(context.amount, context.currency),
        productName: context.productName,
        dashboardUrl: this.url("/sales"),
        organizationName: context.organizationName,
      }),
    });
  }
}
