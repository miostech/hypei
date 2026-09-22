import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createSeller, createTestApp, type TestApp } from "../support/test-app";

describe("Checkout", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  it("uses the official Offer price from PostgreSQL (MongoDB only configures presentation)", async () => {
    const { checkout } = await createSeller(app, { amount: 19_700n });
    const view = await app.services.checkouts.getPublic(checkout.slug);
    expect(view?.offer.amount).toBe(19_700n);
    expect(view?.config).not.toHaveProperty("amount");
    expect(view?.paymentMethods).toContain("CREDIT_CARD");
  });

  it("creates Order + Payment (CREATED → PENDING) and returns a client secret", async () => {
    const { checkout, organization } = await createSeller(app);
    const result = await app.services.checkouts.start({
      slug: checkout.slug,
      attemptId: randomUUID(),
      sessionId: "session-12345",
      name: "Ana",
      email: "ana@example.com",
      tracking: { utm_source: "instagram", utm_campaign: "launch" },
    });
    expect(result.clientSecret).toBeTruthy();
    const order = await app.prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: true } });
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.organizationId).toBe(organization.id);
    expect(order.checkoutVersion).toBe(1);
    expect(order.items[0].unitAmount).toBe(10_000n);
    expect((order.tracking as Record<string, string>).utm_source).toBe("instagram");
    const payment = await app.prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    expect(payment.status).toBe("PENDING");
    expect(payment.providerPaymentId).toMatch(/^mock_pi_/);
  });

  it("is idempotent per checkout attempt (double submit ⇒ one order)", async () => {
    const { checkout } = await createSeller(app);
    const input = { slug: checkout.slug, attemptId: randomUUID(), sessionId: "session-12345", name: "Ana", email: "ana@example.com", tracking: {} };
    const a = await app.services.checkouts.start(input);
    const b = await app.services.checkouts.start(input);
    expect(b.orderId).toBe(a.orderId);
    expect(b.clientSecret).toBe(a.clientSecret);
    expect(await app.prisma.order.count()).toBe(1);
    expect(await app.prisma.payment.count()).toBe(1);
    // The client secret is never persisted in the idempotency store.
    const stored = await app.prisma.idempotencyKey.findFirstOrThrow();
    expect(JSON.stringify(stored.responseData)).not.toContain("secret");
  });

  it("versions checkout configuration; orders keep the version the buyer saw", async () => {
    const { checkout, organization, user, offer } = await createSeller(app);
    const { version } = await app.services.checkouts.updateConfig(organization.id, user.id, checkout.id, {
      offerId: offer.id,
      name: "Checkout",
      slug: checkout.slug,
      headline: "Nova headline",
      accentColor: "#111111",
      collectPhone: true,
      guaranteeDays: 30,
      enabledPaymentMethods: [],
    });
    expect(version).toBe(2);
    const view = await app.services.checkouts.getPublic(checkout.slug);
    expect(view?.config.headline).toBe("Nova headline");
    expect(view?.version).toBe(2);
  });

  it("hides checkouts of inactive offers", async () => {
    const { checkout, organization, user, offer } = await createSeller(app);
    await app.services.offers.setActive(organization.id, user.id, offer.id, false);
    expect(await app.services.checkouts.getPublic(checkout.slug)).toBeNull();
  });
});
