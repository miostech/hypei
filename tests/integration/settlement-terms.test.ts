import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

/** Quantos dias o pagamento esperou entre ser pago e ficar disponível. */
function delayDays(payment: { paidAt: Date | null; settleAt: Date | null }) {
  return Math.round((payment.settleAt!.getTime() - payment.paidAt!.getTime()) / 86_400_000);
}

describe("Settlement terms", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
    // O harness cria uma política genérica de 7 dias; aqui valem as por meio, como no seed.
    await app.prisma.settlementPolicy.createMany({
      data: [
        { country: "BR", currency: "BRL", method: "CREDIT_CARD", delayDays: 15 },
        { country: "BR", currency: "BRL", method: "PIX", delayDays: 2 },
      ],
    });
  });

  it("dá ao Pix o prazo do Pix e ao cartão o do cartão", async () => {
    const seller = await createSeller(app, { amount: 10_000n });
    const card = await startPurchase(app, seller.checkout.slug, "cartao@example.com");
    await confirmPayment(app, card.payment);
    const pix = await startPurchase(app, seller.checkout.slug, "pix@example.com");
    await confirmPayment(app, pix.payment, undefined, "PIX");

    const [paidCard, paidPix] = await Promise.all([
      app.prisma.payment.findUniqueOrThrow({ where: { id: card.payment.id } }),
      app.prisma.payment.findUniqueOrThrow({ where: { id: pix.payment.id } }),
    ]);
    expect(delayDays(paidCard)).toBe(15);
    expect(delayDays(paidPix)).toBe(2);
  });

  it("recusa o recebimento em 2 dias de quem ainda não vendeu o bastante, sem mudar nada", async () => {
    const seller = await createSeller(app, { amount: 10_000n });
    const { payment } = await startPurchase(app, seller.checkout.slug);
    await confirmPayment(app, payment);

    const decision = await app.services.settlements.requestFastCardSettlement({
      organizationId: seller.organization.id,
      currency: "BRL",
    });
    expect(decision.granted).toBe(false);
    expect(decision.revenue).toBeLessThan(decision.minimumRevenue);
    expect(await app.prisma.settlementPolicy.count({ where: { organizationId: seller.organization.id } })).toBe(0);
  });

  it("libera o cartão em 2 dias acima do mínimo, e a venda seguinte já cai nesse prazo", async () => {
    // Uma venda sozinha acima do mínimo: o que importa é o faturamento, não quantas vendas.
    const seller = await createSeller(app, { amount: 100_000_100n });
    const first = await startPurchase(app, seller.checkout.slug, "milionaria@example.com");
    await confirmPayment(app, first.payment);

    const decision = await app.services.settlements.requestFastCardSettlement({
      organizationId: seller.organization.id,
      currency: "BRL",
      userId: seller.user.id,
    });
    expect(decision.granted).toBe(true);

    // A venda que já tinha acontecido fica com o prazo antigo: condição nova não é retroativa.
    const before = await app.prisma.payment.findUniqueOrThrow({ where: { id: first.payment.id } });
    expect(delayDays(before)).toBe(15);

    const next = await startPurchase(app, seller.checkout.slug, "depois@example.com");
    await confirmPayment(app, next.payment);
    const after = await app.prisma.payment.findUniqueOrThrow({ where: { id: next.payment.id } });
    expect(delayDays(after)).toBe(2);

    // Pix não muda: já caía em dois dias, e a liberação é só do cartão.
    const pix = await startPurchase(app, seller.checkout.slug, "pix-depois@example.com");
    await confirmPayment(app, pix.payment, undefined, "PIX");
    expect(delayDays(await app.prisma.payment.findUniqueOrThrow({ where: { id: pix.payment.id } }))).toBe(2);
  });
});
