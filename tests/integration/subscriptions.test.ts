import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, expectLedgerBalanced, startPurchase, type TestApp } from "../support/test-app";

/** Seller whose checkout sells a monthly subscription instead of a one-off. */
async function recurringSeller(app: TestApp, options: { trialDays?: number } = {}) {
  const slug = `sub-${randomUUID().slice(0, 6)}`;
  const seller = await createSeller(app, { slug });
  const offer = await app.services.offers.create(seller.organization.id, seller.user.id, {
    productId: seller.product.id,
    name: "Assinatura mensal",
    price: "100,00",
    currency: "BRL",
    billingType: "SUBSCRIPTION",
    billingInterval: "MONTH",
    trialDays: options.trialDays,
    active: true,
  });
  const checkout = await app.services.checkouts.create(seller.organization.id, seller.user.id, {
    offerId: offer.id,
    name: "Checkout recorrente",
    slug: `rec-${slug}`,
    headline: "Assine agora",
    accentColor: "#5B3DF5",
    collectPhone: false,
    guaranteeDays: 7,
    enabledPaymentMethods: [],
  });
  return { ...seller, offer, checkout };
}

describe("Recurring subscriptions", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("starts a subscription when the offer is recurring", async () => {
    const seller = await recurringSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "assinante@example.com");
    await confirmPayment(app, payment);

    const subscription = await app.prisma.subscription.findFirstOrThrow();
    expect(subscription).toMatchObject({ status: "ACTIVE", amount: 10_000n, billingInterval: "MONTH" });
    expect(subscription.currentPeriodEnd).not.toBeNull();

    // The first charge belongs to the subscription.
    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paid.subscriptionId).toBe(subscription.id);
    expect(paid.status).toBe("PAID");
  });

  it("starts in trial when the offer has trial days", async () => {
    const seller = await recurringSeller(app, { trialDays: 7 });
    const { payment } = await startPurchase(app, seller.checkout.slug, "trial@example.com");
    await confirmPayment(app, payment);

    expect((await app.prisma.subscription.findFirstOrThrow()).status).toBe("TRIALING");
  });

  it("leaves a one-off sale without any subscription", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "avulsa@example.com");
    await confirmPayment(app, payment);

    expect(await app.prisma.subscription.count()).toBe(0);
    expect((await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).subscriptionId).toBeNull();
  });

  it("turns a renewal into a full sale: order, fees, ledger and balance", async () => {
    const seller = await recurringSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "renova@example.com");
    await confirmPayment(app, payment);

    const subscription = await app.prisma.subscription.findFirstOrThrow();
    await app.services.subscriptions.attachProviderId(subscription.id, "mock_sub_1");

    await app.deliver({
      type: "subscription.invoice_paid",
      providerSubscriptionId: "mock_sub_1",
      amount: "10000",
      currency: "BRL",
    });

    const payments = await app.prisma.payment.findMany({ where: { subscriptionId: subscription.id }, orderBy: { createdAt: "asc" } });
    expect(payments).toHaveLength(2);
    const renewal = payments[1];
    expect(renewal.status).toBe("PAID");
    expect(renewal.platformFeeAmount).toBe(1000n);
    expect(renewal.producerNetAmount).toBe(8600n);

    // Two cycles collected, so the producer has two sales worth of balance.
    const balance = await app.prisma.balance.findFirstOrThrow({ where: { organizationId: seller.organization.id } });
    expect(balance.pendingAmount).toBe(17_200n);
    expect((await app.prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).billingCycles).toBe(1);
    await expectLedgerBalanced(app.prisma);
  });

  it("does not charge twice when the same invoice webhook arrives again", async () => {
    const seller = await recurringSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "duplicada@example.com");
    await confirmPayment(app, payment);
    const subscription = await app.prisma.subscription.findFirstOrThrow();
    await app.services.subscriptions.attachProviderId(subscription.id, "mock_sub_2");

    const invoice = {
      type: "subscription.invoice_paid" as const,
      providerSubscriptionId: "mock_sub_2",
      providerPaymentId: "mock_pi_repetido",
      amount: "10000",
      currency: "BRL",
    };
    await app.deliver(invoice, "evt-1");
    await app.deliver(invoice, "evt-2");

    expect(await app.prisma.payment.count({ where: { subscriptionId: subscription.id } })).toBe(2);
    await expectLedgerBalanced(app.prisma);
  });

  it("cuts member area access when the subscription stops being paid, and gives it back on renewal", async () => {
    const seller = await recurringSeller(app);
    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Curso da assinatura",
      slug: "curso-assinatura",
      description: "",
    });
    const courseModule = await app.services.courses.addModule(seller.organization.id, course.id, "Módulo");
    await app.services.courses.addLesson(seller.organization.id, courseModule.id, {
      title: "Aula",
      type: "VIDEO",
      externalUrl: "https://video.example.com/a.mp4",
    });
    await app.services.courses.setPublished(seller.organization.id, seller.user.id, course.id, true);

    const { payment } = await startPurchase(app, seller.checkout.slug, "membro@example.com");
    await confirmPayment(app, payment);
    expect(await app.services.uow.repos.courses.hasEnrollment(course.id, "membro@example.com")).toBe(true);

    const subscription = await app.prisma.subscription.findFirstOrThrow();
    await app.services.subscriptions.attachProviderId(subscription.id, "mock_sub_3");

    await app.deliver({ type: "subscription.updated", providerSubscriptionId: "mock_sub_3", status: "unpaid" });
    expect(await app.services.uow.repos.courses.hasEnrollment(course.id, "membro@example.com")).toBe(false);

    await app.deliver({ type: "subscription.updated", providerSubscriptionId: "mock_sub_3", status: "active" });
    expect(await app.services.uow.repos.courses.hasEnrollment(course.id, "membro@example.com")).toBe(true);
  });

  it("cancels at the end of the period without cutting access, and immediately when asked", async () => {
    const seller = await recurringSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "cancela@example.com");
    await confirmPayment(app, payment);
    const subscription = await app.prisma.subscription.findFirstOrThrow();

    await app.services.subscriptions.cancel(seller.organization.id, seller.user.id, subscription.id, "at_period_end");
    let stored = await app.prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(stored).toMatchObject({ cancelAtPeriodEnd: true, status: "ACTIVE" });

    await app.services.subscriptions.cancel(seller.organization.id, seller.user.id, subscription.id, "now");
    stored = await app.prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(stored.status).toBe("CANCELED");
    expect(stored.canceledAt).not.toBeNull();

    await expect(
      app.services.subscriptions.cancel(seller.organization.id, seller.user.id, subscription.id, "now"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("never touches a subscription from another organization", async () => {
    const a = await createSeller(app, { slug: "org-a" });
    const seller = await recurringSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "alheia@example.com");
    await confirmPayment(app, payment);
    const subscription = await app.prisma.subscription.findFirstOrThrow();

    await expect(app.services.subscriptions.cancel(a.organization.id, a.user.id, subscription.id, "now")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
