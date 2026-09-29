import { randomUUID } from "node:crypto";
import type { PaymentMethodType, PaymentProviderType } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import type { IdempotencyService } from "@/lib/idempotency/idempotency.service";
import type { TrackingService } from "@/modules/analytics/tracking.service";
import { resolvePaymentMethods } from "@/modules/payments/payment-method-resolver";
import type { PaymentService } from "@/modules/payments/payment.service";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { CheckoutConfigRepository } from "./checkout-config.repository";
import { checkoutConfigSchema, type CheckoutConfig } from "./checkout-config.schema";
import type { AffiliateService } from "@/modules/affiliates/affiliate.service";
import type { SubscriptionService } from "@/modules/subscriptions/subscription.service";
import { CouponNotUsableError, type CouponService } from "@/modules/coupons/coupon.service";
import type { CheckoutBuilderInput, StartCheckoutInput } from "./checkout.schemas";

export interface StartCheckoutResult {
  orderId: string;
  paymentId: string;
  provider: PaymentProviderType;
  clientSecret: string | null;
}

/**
 * PostgreSQL configures business (checkout row → offer → official price).
 * MongoDB configures presentation (versioned checkout_configs).
 */
export class CheckoutService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly configs: CheckoutConfigRepository,
    private readonly payments: PaymentService,
    private readonly tracking: TrackingService,
    private readonly idempotency: IdempotencyService,
    private readonly coupons: CouponService,
    private readonly affiliates: AffiliateService,
    private readonly subscriptions: SubscriptionService,
    private readonly providerType: PaymentProviderType,
  ) {}

  list(organizationId: string) {
    return this.uow.repos.checkouts.list(organizationId);
  }

  async getForEdit(organizationId: string, id: string) {
    const checkout = await this.uow.repos.checkouts.findById(organizationId, id);
    if (!checkout) throw new NotFoundError("Checkout", id);
    const config = await this.configs.getVersion(checkout.id, checkout.currentVersion);
    return { checkout, config: config?.config ?? null };
  }

  async create(organizationId: string, userId: string, input: CheckoutBuilderInput) {
    const offer = await this.uow.repos.offers.findById(organizationId, input.offerId);
    if (!offer) throw new NotFoundError("Offer", input.offerId);
    if (await this.uow.repos.checkouts.slugExists(input.slug)) throw new ConflictError("Este link já está em uso", { field: "slug" });

    const checkoutId = `chk_${randomUUID().replace(/-/g, "")}`;
    // Mongo first: if Postgres fails afterwards the orphan version is harmless (never referenced).
    await this.configs.createVersion({ checkoutId, organizationId, version: 1, config: this.toConfig(input) });
    return this.uow.transaction(async (repos) => {
      const checkout = await repos.checkouts.create({ id: checkoutId, organizationId, offerId: offer.id, slug: input.slug, name: input.name });
      await repos.audit.record({ organizationId, userId, action: "checkout.created", entity: "Checkout", entityId: checkout.id });
      return checkout;
    });
  }

  /** Every change produces a NEW version; orders keep pointing at the version the buyer saw. */
  async updateConfig(organizationId: string, userId: string, id: string, input: CheckoutBuilderInput) {
    const checkout = await this.uow.repos.checkouts.findById(organizationId, id);
    if (!checkout) throw new NotFoundError("Checkout", id);
    const offer = await this.uow.repos.offers.findById(organizationId, input.offerId);
    if (!offer) throw new NotFoundError("Offer", input.offerId);
    if (offer.id !== checkout.offerId) throw new ValidationError("A oferta de um checkout não pode ser trocada; crie um novo checkout");

    const latest = await this.configs.latest(checkout.id);
    const version = (latest?.version ?? checkout.currentVersion) + 1;
    await this.configs.createVersion({ checkoutId: checkout.id, organizationId, version, config: this.toConfig(input) });
    await this.uow.transaction(async (repos) => {
      await repos.checkouts.setVersion(organizationId, checkout.id, version);
      await repos.audit.record({ organizationId, userId, action: "checkout.updated", entity: "Checkout", entityId: checkout.id, metadata: { version } });
    });
    return { version };
  }

  async getPublic(slug: string) {
    const checkout = await this.uow.repos.checkouts.findPublicBySlug(slug);
    if (!checkout || checkout.status !== "ACTIVE" || !checkout.offer.active || checkout.offer.product.status !== "ACTIVE") {
      return null;
    }
    const stored = await this.configs.getVersion(checkout.id, checkout.currentVersion);
    const config: CheckoutConfig = stored ? checkoutConfigSchema.parse(stored.config) : checkoutConfigSchema.parse({ theme: {}, headline: checkout.offer.product.name, fields: {} });
    const paymentMethods: PaymentMethodType[] = resolvePaymentMethods({
      provider: this.providerType,
      currency: checkout.offer.currency,
      merchantCountry: checkout.organization.country,
      checkoutEnabledMethods: config.enabledPaymentMethods,
    });
    return {
      checkoutId: checkout.id,
      version: checkout.currentVersion,
      provider: this.providerType,
      organization: { id: checkout.organization.id, name: checkout.organization.name, slug: checkout.organization.slug, country: checkout.organization.country, supportEmail: checkout.organization.supportEmail },
      product: { id: checkout.offer.product.id, name: checkout.offer.product.name, description: checkout.offer.product.description, type: checkout.offer.product.type, thumbnailUrl: checkout.offer.product.thumbnailUrl },
      // Official price: ALWAYS from the Offer in PostgreSQL.
      offer: {
        id: checkout.offer.id,
        name: checkout.offer.name,
        amount: checkout.offer.amount,
        currency: checkout.offer.currency,
        billingType: checkout.offer.billingType,
        billingInterval: checkout.offer.billingInterval,
        trialDays: checkout.offer.trialDays,
        installments: checkout.offer.installments,
      },
      config,
      paymentMethods,
    };
  }

  /** Idempotent per checkout attempt: double-clicks/retries never create two orders. */
  async start(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    // The client secret is never persisted: only ids are stored for replays, and the secret
    // is re-fetched from the provider when the same attempt is retried.
    let freshSecret: string | null = null;
    const stored = await this.idempotency.run("checkout.start", input.attemptId, { ...input, tracking: undefined }, async () => {
      const result = await this.createOrderAndPayment(input);
      freshSecret = result.clientSecret;
      return { orderId: result.orderId, paymentId: result.paymentId, provider: result.provider };
    });
    const clientSecret = freshSecret ?? (await this.payments.resumeClientSecret(stored.paymentId));
    return { orderId: stored.orderId, paymentId: stored.paymentId, provider: stored.provider, clientSecret };
  }

  /**
   * Validates a code against the public checkout so the buyer sees the discount
   * before paying. Nothing is reserved: the redemption is only claimed on submit.
   */
  async previewCoupon(slug: string, code: string) {
    const checkout = await this.getPublic(slug);
    if (!checkout) throw new NotFoundError("Checkout", slug);
    const { coupon, discount, total } = await this.coupons.check(checkout.organization.id, code, {
      amount: checkout.offer.amount,
      currency: checkout.offer.currency,
      productId: checkout.product.id,
    });
    return { code: coupon.code, discount, total, currency: checkout.offer.currency };
  }

  private async createOrderAndPayment(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    const checkout = await this.getPublic(input.slug);
    if (!checkout) throw new NotFoundError("Checkout", input.slug);
    const { organization, offer } = checkout;

    const { customer, order, total, subscription } = await this.uow.transaction(async (repos) => {
      const customer = await repos.customers.upsertByEmail(organization.id, {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        country: input.country ?? null,
      });

      // The discount is recomputed here from the offer price: whatever the browser
      // sent is only a code, never an amount.
      const applied = input.couponCode
        ? await this.coupons.check(organization.id, input.couponCode, {
            amount: offer.amount,
            currency: offer.currency,
            productId: checkout.product.id,
            customerId: customer.id,
          })
        : null;

      if (applied) {
        const claimed = await repos.coupons.claimRedemption(applied.coupon.id);
        if (!claimed) throw new CouponNotUsableError("Este cupom atingiu o limite de usos");
      }

      const discount = applied?.discount ?? 0n;
      const total = offer.amount - discount;

      // Attribution is resolved now and frozen on the order: changing the
      // affiliate's rate later must not rewrite what an old sale owed.
      const attribution = input.referralCode
        ? await this.affiliates.resolveAttribution(organization.id, input.referralCode)
        : null;

      const order = await repos.orders.create({
        organizationId: organization.id,
        customerId: customer.id,
        checkoutId: checkout.checkoutId,
        checkoutVersion: checkout.version,
        currency: offer.currency,
        subtotalAmount: offer.amount,
        discountAmount: discount,
        couponId: applied?.coupon.id ?? null,
        couponCode: applied?.coupon.code ?? null,
        affiliateId: attribution?.affiliateId ?? null,
        affiliateLinkId: attribution?.linkId ?? null,
        taxAmount: 0n,
        totalAmount: total,
        tracking: { ...input.tracking, sessionId: input.sessionId },
        items: [{ offerId: offer.id, productName: checkout.product.name, offerName: offer.name, quantity: 1, unitAmount: offer.amount, totalAmount: total }],
      });

      if (applied) {
        await repos.coupons.recordRedemption({
          couponId: applied.coupon.id,
          orderId: order.id,
          customerId: customer.id,
          amount: discount,
        });
      }

      // A recurring offer starts a subscription right here; the payment created
      // below is its first cycle, and the provider drives the ones after that.
      const subscription =
        offer.billingType === "SUBSCRIPTION" && offer.billingInterval
          ? await this.subscriptions.createFromCheckout(repos, {
              organizationId: organization.id,
              customerId: customer.id,
              offerId: offer.id,
              amount: total,
              currency: offer.currency,
              billingInterval: offer.billingInterval,
              trialDays: offer.trialDays ?? null,
              startedAt: new Date(),
            })
          : null;

      await repos.outbox.add(createDomainEvent("order.created", order.id, organization.id, { total, currency: offer.currency }));
      return { customer, order, total, subscription };
    });

    const base = { organizationId: organization.id, checkoutId: checkout.checkoutId, sessionId: input.sessionId, tracking: input.tracking };
    await this.tracking.trackCheckout({ ...base, eventType: "checkout.customer_created", customerId: customer.id, orderId: order.id });

    const payment = await this.payments.start({
      organizationId: organization.id,
      orderId: order.id,
      subscriptionId: subscription?.id ?? null,
      customer: { id: customer.id, email: customer.email, name: customer.name, country: customer.country },
      amount: total,
      currency: offer.currency,
      paymentMethods: checkout.paymentMethods,
      description: `${checkout.product.name} — ${offer.name}`,
      offerId: offer.id,
    });
    await this.tracking.trackCheckout({ ...base, eventType: "checkout.payment_started", customerId: customer.id, orderId: order.id });

    return { orderId: order.id, paymentId: payment.paymentId, provider: payment.provider, clientSecret: payment.clientSecret };
  }

  private toConfig(input: CheckoutBuilderInput): CheckoutConfig {
    return checkoutConfigSchema.parse({
      theme: { mode: "light", accentColor: input.accentColor },
      logoUrl: input.logoUrl || null,
      headline: input.headline,
      description: input.description ?? "",
      fields: { phone: input.collectPhone, country: true },
      enabledPaymentMethods: input.enabledPaymentMethods,
      guaranteeDays: input.guaranteeDays,
    });
  }
}
