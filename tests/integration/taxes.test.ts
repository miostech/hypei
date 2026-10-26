import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

/**
 * Quem vende é o produtor, e o preço anunciado já inclui o imposto. Estes testes
 * garantem as duas consequências: o comprador nunca paga além do preço, e a venda
 * guarda quanto daquilo era tributo.
 */
describe("Imposto na venda", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  async function startSale(amount: bigint) {
    const { checkout } = await createSeller(app, { amount });
    const result = await app.services.checkouts.start({
      slug: checkout.slug,
      attemptId: randomUUID(),
      sessionId: "session-12345",
      name: "Ana",
      email: "ana@example.com",
      tracking: {},
    });
    return app.prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });
  }

  it("não cobra imposto de quem não configurou política", async () => {
    const order = await startSale(10_000n);

    expect(order.taxAmount).toBe(0n);
    expect(order.taxRegime).toBe("NONE");
    expect(order.totalAmount).toBe(10_000n);
  });

  it("extrai a alíquota de dentro do preço, sem aumentar o que o comprador paga", async () => {
    await app.prisma.taxPolicy.create({
      data: { country: "BR", regime: "BR_SIMPLES_NACIONAL", rateBps: 600 },
    });

    const order = await startSale(10_600n);

    // O comprador paga exatamente o preço anunciado.
    expect(order.totalAmount).toBe(10_600n);
    // E R$ 6,00 dele são imposto.
    expect(order.taxAmount).toBe(600n);
    expect(order.taxRegime).toBe("BR_SIMPLES_NACIONAL");
  });

  it("prefere a política da organização à do país", async () => {
    const { checkout, organization } = await createSeller(app, { amount: 10_000n });
    await app.prisma.taxPolicy.create({ data: { country: "BR", regime: "BR_ISS", rateBps: 500 } });
    await app.prisma.taxPolicy.create({
      data: { organizationId: organization.id, regime: "BR_SIMPLES_NACIONAL", rateBps: 1_500 },
    });

    const result = await app.services.checkouts.start({
      slug: checkout.slug,
      attemptId: randomUUID(),
      sessionId: "session-12345",
      name: "Ana",
      email: "ana@example.com",
      tracking: {},
    });
    const order = await app.prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });

    expect(order.taxRegime).toBe("BR_SIMPLES_NACIONAL");
    expect(order.taxAmount).toBe(1_304n); // 10000 × 1500 / 11500
  });

  it("ignora política inativa", async () => {
    await app.prisma.taxPolicy.create({
      data: { country: "BR", regime: "BR_ISS", rateBps: 500, active: false },
    });

    const order = await startSale(10_000n);
    expect(order.taxAmount).toBe(0n);
  });

  it("não lança imposto no ledger: o dinheiro todo continua sendo do produtor", async () => {
    await app.prisma.taxPolicy.create({ data: { country: "BR", regime: "BR_ISS", rateBps: 500 } });

    const { checkout } = await createSeller(app, { amount: 10_500n });
    const { payment } = await startPurchase(app, checkout.slug);
    await confirmPayment(app, payment);

    const entries = await app.prisma.ledgerEntry.findMany({ where: { account: "TAXES" } });
    expect(entries).toEqual([]);

    // E o ledger continua fechando sem o imposto participar.
    const all = await app.prisma.ledgerEntry.findMany();
    const sum = all.reduce((acc, e) => acc + (e.direction === "DEBIT" ? e.amount : -e.amount), 0n);
    expect(sum).toBe(0n);
  });
});
