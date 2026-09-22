import { beforeEach, describe, expect, it } from "vitest";
import { resolveTenant } from "@/modules/organizations/tenant-access";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

describe("Tenant isolation", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  it("never resolves an organization the user is not a member of (even if the client asks for it)", async () => {
    const a = await createSeller(app, { slug: "tenant-a" });
    const b = await createSeller(app, { slug: "tenant-b" });
    const ctx = await resolveTenant(app.services.uow.repos.organizations, a.user.id, b.organization.id);
    expect(ctx?.organization.id).toBe(a.organization.id); // falls back to own org, never B
  });

  it("repositories scope every read/write by organization", async () => {
    const a = await createSeller(app, { slug: "tenant-a" });
    const b = await createSeller(app, { slug: "tenant-b" });

    await expect(app.services.products.get(a.organization.id, b.product.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(app.services.offers.get(a.organization.id, b.offer.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      app.services.products.update(a.organization.id, a.user.id, b.product.id, { name: "hack", slug: "hack", type: "OTHER", status: "ACTIVE" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await app.prisma.product.findUniqueOrThrow({ where: { id: b.product.id } })).name).toBe("Curso Teste");

    const productsOfA = await app.services.products.list(a.organization.id);
    expect(productsOfA.every((p) => p.organizationId === a.organization.id)).toBe(true);
  });

  it("cannot attach another tenant's product to an offer or checkout", async () => {
    const a = await createSeller(app, { slug: "tenant-a" });
    const b = await createSeller(app, { slug: "tenant-b" });
    await expect(
      app.services.offers.create(a.organization.id, a.user.id, {
        productId: b.product.id,
        name: "x",
        price: "10,00",
        currency: "BRL",
        billingType: "ONE_TIME",
        active: true,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      app.services.checkouts.create(a.organization.id, a.user.id, {
        offerId: b.offer.id,
        name: "x",
        slug: "stolen",
        headline: "x",
        accentColor: "#000000",
        collectPhone: false,
        guaranteeDays: 0,
        enabledPaymentMethods: [],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cannot refund or pay out another tenant's money", async () => {
    const a = await createSeller(app, { slug: "tenant-a" });
    const b = await createSeller(app, { slug: "tenant-b" });
    const { payment } = await startPurchase(app, b.checkout.slug);
    await confirmPayment(app, payment);

    await expect(
      app.services.refunds.request({ organizationId: a.organization.id, paymentId: payment.id, amount: 100n, idempotencyKey: "steal" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    app.clock.advanceDays(8);
    await app.services.settlements.releaseDue({ now: app.clock.now });
    await expect(
      app.services.payouts.request({ organizationId: a.organization.id, amount: 1000n, currency: "BRL", idempotencyKey: "steal-payout" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });

  it("balances and ledgers are per organization", async () => {
    const a = await createSeller(app, { slug: "tenant-a" });
    const b = await createSeller(app, { slug: "tenant-b" });
    const { payment } = await startPurchase(app, b.checkout.slug);
    await confirmPayment(app, payment);
    expect(await app.prisma.balance.findFirst({ where: { organizationId: a.organization.id } })).toBeNull();
    expect((await app.prisma.balance.findFirstOrThrow({ where: { organizationId: b.organization.id } })).pendingAmount).toBe(8600n);
  });
});
