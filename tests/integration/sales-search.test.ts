import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

describe("Sales search", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  async function sell(seller: Awaited<ReturnType<typeof createSeller>>, email: string) {
    const { payment } = await startPurchase(app, seller.checkout.slug, email);
    await confirmPayment(app, payment);
    return app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  }

  it("finds a sale by customer e-mail, by name and by product", async () => {
    const seller = await createSeller(app);
    await sell(seller, "marina.souza@example.com");
    await sell(seller, "outro@example.com");

    const { repos } = app.services.uow;
    expect(await repos.orders.search(seller.organization.id, "marina.souza@example.com", 50)).toHaveLength(1);
    // Every buyer created by the test helper is named "Comprador".
    expect(await repos.orders.search(seller.organization.id, "comprador", 50)).toHaveLength(2);
    expect(await repos.orders.search(seller.organization.id, "Curso Teste", 50)).toHaveLength(2);
  });

  it("finds a sale by the reference printed on the receipt", async () => {
    const seller = await createSeller(app);
    const payment = await sell(seller, "referencia@example.com");
    const reference = payment.orderId.slice(-8).toUpperCase();

    const found = await app.services.uow.repos.orders.search(seller.organization.id, reference, 50);
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(payment.orderId);
  });

  it("finds a sale by the id the provider reported", async () => {
    const seller = await createSeller(app);
    const payment = await sell(seller, "provedor@example.com");

    const found = await app.services.uow.repos.orders.search(seller.organization.id, payment.providerPaymentId!, 50);
    expect(found[0].id).toBe(payment.orderId);
  });

  it("ignores case and surrounding spaces", async () => {
    const seller = await createSeller(app);
    await sell(seller, "Maiuscula@Example.com");

    const found = await app.services.uow.repos.orders.search(seller.organization.id, "  MAIUSCULA@example.COM  ", 50);
    expect(found).toHaveLength(1);
  });

  it("returns nothing for a term that matches no sale", async () => {
    const seller = await createSeller(app);
    await sell(seller, "existe@example.com");

    expect(await app.services.uow.repos.orders.search(seller.organization.id, "naoexiste@example.com", 50)).toHaveLength(0);
  });

  it("never finds a sale from another organization", async () => {
    const a = await createSeller(app, { slug: "org-a" });
    const b = await createSeller(app, { slug: "org-b" });
    const payment = await sell(b, "cliente-do-b@example.com");
    const reference = payment.orderId.slice(-8).toUpperCase();

    const { repos } = app.services.uow;
    expect(await repos.orders.search(a.organization.id, "cliente-do-b@example.com", 50)).toHaveLength(0);
    expect(await repos.orders.search(a.organization.id, reference, 50)).toHaveLength(0);
    expect(await repos.orders.search(a.organization.id, payment.providerPaymentId!, 50)).toHaveLength(0);
    expect(await repos.orders.search(b.organization.id, "cliente-do-b@example.com", 50)).toHaveLength(1);
  });
});

describe("New students today", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("counts people, not orders: a second purchase does not add a student", async () => {
    const seller = await createSeller(app);
    const from = new Date(Date.now() - 3_600_000);
    const to = new Date(Date.now() + 3_600_000);

    const first = await startPurchase(app, seller.checkout.slug, "recorrente@example.com");
    await confirmPayment(app, first.payment);
    const second = await startPurchase(app, seller.checkout.slug, "recorrente@example.com");
    await confirmPayment(app, second.payment);

    const { repos } = app.services.uow;
    expect(await repos.orders.newCustomersBetween(seller.organization.id, from, to)).toBe(1);

    const paid = await repos.orders.paidBetween(seller.organization.id, from, to);
    expect(paid[0].count).toBe(2);
  });

  it("counts each first-time buyer once and ignores other organizations", async () => {
    const a = await createSeller(app, { slug: "org-a" });
    const b = await createSeller(app, { slug: "org-b" });
    const from = new Date(Date.now() - 3_600_000);
    const to = new Date(Date.now() + 3_600_000);

    for (const email of ["ana@example.com", "bia@example.com"]) {
      const { payment } = await startPurchase(app, a.checkout.slug, email);
      await confirmPayment(app, payment);
    }
    const other = await startPurchase(app, b.checkout.slug, "carlos@example.com");
    await confirmPayment(app, other.payment);

    const { repos } = app.services.uow;
    expect(await repos.orders.newCustomersBetween(a.organization.id, from, to)).toBe(2);
    expect(await repos.orders.newCustomersBetween(b.organization.id, from, to)).toBe(1);
  });

  it("does not count someone whose first purchase was before the window", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "antiga@example.com");
    await confirmPayment(app, payment);

    // Window starting after the purchase: nobody is new in it.
    const later = new Date(Date.now() + 60_000);
    expect(await app.services.uow.repos.orders.newCustomersBetween(seller.organization.id, later, new Date(Date.now() + 3_600_000))).toBe(0);
  });
});
