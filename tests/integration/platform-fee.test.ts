import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

/**
 * A taxa é a mesma para todo mundo até a Kabrun negociar com alguém. Estes testes garantem as
 * duas pontas: que a condição negociada chega na venda, e que ela não vaza para quem não
 * negociou nada.
 */
describe("Taxa negociada por produtor", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("começa na taxa que vale para todas, e diz que não é negociada", async () => {
    const seller = await createSeller(app);
    const fees = await app.services.platformFees.effective(seller.organization.id);

    const brl = fees.find((fee) => fee.currency === "BRL");
    expect(brl).toMatchObject({ negotiated: false, rule: { percentageBps: 1000, fixedAmount: 0n } });
    // Sem linha nenhuma no banco, a moeda cai no padrão publicado.
    expect(fees.find((fee) => fee.currency === "USD")).toMatchObject({
      negotiated: false,
      rule: { percentageBps: 999, fixedAmount: 80n },
    });
  });

  it("cobra a taxa negociada na venda seguinte, e deixa a anterior como estava", async () => {
    const seller = await createSeller(app, { amount: 10_000n });

    const antes = await startPurchase(app, seller.checkout.slug, "antes@example.com");
    await confirmPayment(app, antes.payment);

    await app.services.platformFees.setForOrganization({
      organizationId: seller.organization.id,
      currency: "BRL",
      percentageBps: 500,
      fixedAmount: 100n,
      userId: seller.user.id,
    });

    const depois = await startPurchase(app, seller.checkout.slug, "depois@example.com");
    await confirmPayment(app, depois.payment);

    const [primeira, segunda] = await Promise.all([
      app.prisma.payment.findUniqueOrThrow({ where: { id: antes.payment.id } }),
      app.prisma.payment.findUniqueOrThrow({ where: { id: depois.payment.id } }),
    ]);

    // A venda já paga guarda a taxa que foi cobrada nela: mudar condição não mexe no passado.
    expect(primeira.platformFeeAmount).toBe(1000n);
    expect(primeira.producerNetAmount).toBe(9000n);
    // 5% + R$ 1,00 na nova.
    expect(segunda.platformFeeAmount).toBe(600n);
    expect(segunda.producerNetAmount).toBe(9400n);
  });

  it("não encosta na taxa de quem não negociou nada", async () => {
    const negociou = await createSeller(app, { slug: "com-desconto" });
    const naoNegociou = await createSeller(app, { slug: "sem-desconto" });

    await app.services.platformFees.setForOrganization({
      organizationId: negociou.organization.id,
      currency: "BRL",
      percentageBps: 200,
      fixedAmount: 0n,
    });

    const outra = await startPurchase(app, naoNegociou.checkout.slug, "normal@example.com");
    await confirmPayment(app, outra.payment);
    expect((await app.prisma.payment.findUniqueOrThrow({ where: { id: outra.payment.id } })).platformFeeAmount).toBe(1000n);

    expect((await app.services.platformFees.effective(naoNegociou.organization.id)).find((f) => f.currency === "BRL")?.negotiated).toBe(false);
  });

  it("volta para a taxa padrão quando a condição é desfeita", async () => {
    const seller = await createSeller(app, { amount: 10_000n });
    await app.services.platformFees.setForOrganization({
      organizationId: seller.organization.id,
      currency: "BRL",
      percentageBps: 200,
      fixedAmount: 0n,
    });
    const depois = await app.services.platformFees.clearForOrganization({
      organizationId: seller.organization.id,
      currency: "BRL",
    });
    expect(depois.find((fee) => fee.currency === "BRL")).toMatchObject({ negotiated: false, rule: { percentageBps: 1000 } });

    const venda = await startPurchase(app, seller.checkout.slug, "de-volta@example.com");
    await confirmPayment(app, venda.payment);
    expect((await app.prisma.payment.findUniqueOrThrow({ where: { id: venda.payment.id } })).platformFeeAmount).toBe(1000n);
  });

  it("recusa taxa acima de 100%, que fecharia a loja do produtor", async () => {
    const seller = await createSeller(app);
    await expect(
      app.services.platformFees.setForOrganization({
        organizationId: seller.organization.id,
        currency: "BRL",
        percentageBps: 10_001,
        fixedAmount: 0n,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(
      app.services.platformFees.setForOrganization({
        organizationId: seller.organization.id,
        currency: "BRL",
        percentageBps: 500,
        fixedAmount: -1n,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    // Nada gravado: a recusa é antes de escrever.
    expect((await app.services.platformFees.effective(seller.organization.id)).find((f) => f.currency === "BRL")?.negotiated).toBe(false);
  });

  it("registra no log de auditoria quem mudou a taxa de quem", async () => {
    const seller = await createSeller(app);
    await app.services.platformFees.setForOrganization({
      organizationId: seller.organization.id,
      currency: "BRL",
      percentageBps: 700,
      fixedAmount: 50n,
      userId: seller.user.id,
    });

    const entry = await app.prisma.auditLog.findFirstOrThrow({ where: { action: "platform_fee.negotiated" } });
    expect(entry).toMatchObject({ organizationId: seller.organization.id, userId: seller.user.id, entity: "PlatformFeePolicy" });
    expect(entry.metadata).toMatchObject({ currency: "BRL", percentageBps: 700, fixedAmount: "50" });
  });
});
