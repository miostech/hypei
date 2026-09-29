import type { DbClient } from "@/lib/database/postgres/client";
import type { EmailTemplate } from "./templates";

export interface PartyContext {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  supportEmail: string | null;
  /** Where producer notifications go: support e-mail, falling back to the owner. */
  producerEmail: string | null;
}

export interface PurchaseContext extends PartyContext {
  customerName: string;
  customerEmail: string;
  productName: string;
  amount: bigint;
  netAmount: bigint;
  currency: string;
  orderReference: string;
  /** Slug of the published course bought, when the product has one. */
  courseSlug: string | null;
}

export interface RefundContext extends PartyContext {
  customerName: string;
  customerEmail: string;
  productName: string;
  amount: bigint;
  currency: string;
}

export interface PayoutContext extends PartyContext {
  amount: bigint;
  currency: string;
  destinationLabel: string;
}

export interface DisputeContext extends PartyContext {
  amount: bigint;
  currency: string;
  productName: string;
}

export interface ClaimInput {
  eventId: string;
  template: EmailTemplate;
  recipient: string;
  subject: string;
  organizationId: string | null;
}

export interface NotificationRepository {
  purchaseContext(paymentId: string): Promise<PurchaseContext | null>;
  refundContext(refundId: string): Promise<RefundContext | null>;
  payoutContext(payoutId: string): Promise<PayoutContext | null>;
  disputeContext(disputeId: string): Promise<DisputeContext | null>;
  /** Reserves the send. Returns null when this event already mailed this person. */
  claim(input: ClaimInput): Promise<string | null>;
  markSent(id: string, providerId: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

const OWNER_SELECT = {
  select: { user: { select: { email: true } } },
  where: { role: "OWNER" as const },
  take: 1,
};

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly db: DbClient) {}

  private party(organization: {
    id: string;
    name: string;
    slug: string;
    supportEmail: string | null;
    members: { user: { email: string } }[];
  }): PartyContext {
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      supportEmail: organization.supportEmail,
      producerEmail: organization.supportEmail ?? organization.members[0]?.user.email ?? null,
    };
  }

  async purchaseContext(paymentId: string): Promise<PurchaseContext | null> {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: {
        customer: true,
        organization: { include: { members: OWNER_SELECT } },
        order: { include: { items: { include: { offer: { include: { product: { include: { course: true } } } } }, take: 1 } } },
      },
    });
    if (!payment) return null;

    const product = payment.order.items[0]?.offer.product;
    const course = product?.course;
    return {
      ...this.party(payment.organization),
      customerName: payment.customer.name,
      customerEmail: payment.customer.email,
      productName: product?.name ?? "seu pedido",
      amount: payment.amount,
      netAmount: payment.producerNetAmount ?? payment.amount,
      currency: payment.currency,
      orderReference: payment.order.id.slice(-8).toUpperCase(),
      courseSlug: course?.published ? course.slug : null,
    };
  }

  async refundContext(refundId: string): Promise<RefundContext | null> {
    const refund = await this.db.refund.findUnique({
      where: { id: refundId },
      include: {
        payment: {
          include: {
            customer: true,
            organization: { include: { members: OWNER_SELECT } },
            order: { include: { items: { include: { offer: { include: { product: true } } }, take: 1 } } },
          },
        },
      },
    });
    if (!refund) return null;

    return {
      ...this.party(refund.payment.organization),
      customerName: refund.payment.customer.name,
      customerEmail: refund.payment.customer.email,
      productName: refund.payment.order.items[0]?.offer.product.name ?? "sua compra",
      amount: refund.amount,
      currency: refund.payment.currency,
    };
  }

  async payoutContext(payoutId: string): Promise<PayoutContext | null> {
    const payout = await this.db.payout.findUnique({
      where: { id: payoutId },
      include: { organization: { include: { members: OWNER_SELECT } }, destination: true },
    });
    if (!payout) return null;

    const destination = payout.destination;
    return {
      ...this.party(payout.organization),
      amount: payout.amount,
      currency: payout.currency,
      destinationLabel: destination?.label ?? "conta cadastrada",
    };
  }

  async disputeContext(disputeId: string): Promise<DisputeContext | null> {
    const dispute = await this.db.dispute.findUnique({
      where: { id: disputeId },
      include: {
        payment: {
          include: {
            organization: { include: { members: OWNER_SELECT } },
            order: { include: { items: { include: { offer: { include: { product: true } } }, take: 1 } } },
          },
        },
      },
    });
    if (!dispute) return null;

    return {
      ...this.party(dispute.payment.organization),
      amount: dispute.amount,
      currency: dispute.payment.currency,
      productName: dispute.payment.order.items[0]?.offer.product.name ?? "uma compra",
    };
  }

  async claim({ eventId, template, recipient, subject, organizationId }: ClaimInput): Promise<string | null> {
    const existing = await this.db.emailDelivery.findUnique({
      where: { eventId_template_recipient: { eventId, template, recipient } },
    });

    // A failed attempt may be retried; a sent (or in-flight) one must never repeat.
    if (existing) {
      if (existing.status !== "FAILED") return null;
      await this.db.emailDelivery.update({ where: { id: existing.id }, data: { status: "SENDING", error: null } });
      return existing.id;
    }

    try {
      const created = await this.db.emailDelivery.create({
        data: { eventId, template, recipient, subject, organizationId, status: "SENDING" },
      });
      return created.id;
    } catch {
      // Lost the race against a concurrent handler: it owns the send.
      return null;
    }
  }

  async markSent(id: string, providerId: string) {
    await this.db.emailDelivery.update({ where: { id }, data: { status: "SENT", providerId, error: null } });
  }

  async markFailed(id: string, error: string) {
    await this.db.emailDelivery.update({ where: { id }, data: { status: "FAILED", error: error.slice(0, 500) } });
  }
}
