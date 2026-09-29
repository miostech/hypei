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
