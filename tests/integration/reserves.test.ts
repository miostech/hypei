import { beforeEach, describe, expect, it } from "vitest";
import {
  accountTotals,
  confirmPayment,
  createSeller,
  createTestApp,
  expectLedgerBalanced,
  startPurchase,
  type TestApp,
} from "../support/test-app";

/**
 * Venda de 100,00 com 10% de taxa, 4% de processamento e 4% de reserva:
 * 10000 bruto − 400 processamento − 1000 Kabrun = 8600 do produtor,
 * dos quais 400 (4% do bruto) ficam retidos e 8200 vão para o pendente.
 */
const SALE = 10_000n;
const PRODUCER_NET = 8600n;
const RESERVED = 400n;

async function sellWithReserve(app: TestApp) {
  const seller = await createSeller(app, { amount: SALE });
  const { payment } = await startPurchase(app, seller.checkout.slug);
  await confirmPayment(app, payment);
  return { ...seller, payment };
}

describe("Security reserve", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp({ reserveBps: 400, reserveHoldDays: 30 });
  });

  it("retém parte da venda fora do saldo pendente, e marca quando ela vence", async () => {
    const { organization, payment } = await sellWithReserve(app);

    const totals = await accountTotals(app.prisma, organization.id);
    expect(-totals.PRODUCER_PENDING).toBe(PRODUCER_NET - RESERVED);
    expect(-totals.RESERVES).toBe(RESERVED);
    await expectLedgerBalanced(app.prisma);

    const reserve = await app.prisma.reserve.findFirstOrThrow({ where: { referenceId: payment.id } });
    expect(reserve).toMatchObject({ amount: RESERVED, consumedAmount: 0n, status: "HELD", reason: "security" });
    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(Math.round((reserve.releaseAt!.getTime() - paid.paidAt!.getTime()) / 86_400_000)).toBe(30);
  });

  it("devolve a reserva ao saldo disponível só quando o prazo vence", async () => {
    const { organization } = await sellWithReserve(app);
    app.clock.advanceDays(8);
    await app.services.settlements.releaseDue({ now: app.clock.now });

    // No dia seguinte à liberação da venda a reserva ainda está retida.
    expect((await app.services.reserves.releaseDue({ now: app.clock.now })).released).toBe(0n);
    expect(-(await accountTotals(app.prisma, organization.id)).RESERVES).toBe(RESERVED);

    app.clock.advanceDays(23);
    const run = await app.services.reserves.releaseDue({ now: app.clock.now });
    expect(run).toMatchObject({ processed: 1, released: RESERVED });

    const totals = await accountTotals(app.prisma, organization.id);
    expect(totals.RESERVES ?? 0n).toBe(0n);
    expect(-totals.PRODUCER_AVAILABLE).toBe(PRODUCER_NET);
    await expectLedgerBalanced(app.prisma);

    // Rodar de novo não devolve duas vezes.
    expect((await app.services.reserves.releaseDue({ now: app.clock.now })).released).toBe(0n);
  });

  it("nunca adianta o prazo de recebimento: espera a venda liberar", async () => {
    app = await createTestApp({ reserveBps: 400, reserveHoldDays: 1, settlementDays: 7 });
    const { organization } = await sellWithReserve(app);

    app.clock.advanceDays(2); // a reserva venceu, a venda não
    expect((await app.services.reserves.releaseDue({ now: app.clock.now })).released).toBe(0n);
    expect((await accountTotals(app.prisma, organization.id)).PRODUCER_AVAILABLE ?? 0n).toBe(0n);

    app.clock.advanceDays(6);
    await app.services.settlements.releaseDue({ now: app.clock.now });
    expect((await app.services.reserves.releaseDue({ now: app.clock.now })).released).toBe(RESERVED);
    expect(-(await accountTotals(app.prisma, organization.id)).PRODUCER_AVAILABLE).toBe(PRODUCER_NET);
  });

  /**
   * É para isto que ela existe: o estorno encontra dinheiro em casa.
   *
   * A reserva não cobre a venda inteira — 4% é 4% —, mas é a parte que não depende de o
   * produtor ter sacado ou não. Sem ela, tudo isso sairia de um saldo que pode estar vazio.
   */
  it("paga o reembolso com a reserva antes de tocar no saldo da produtora", async () => {
    const { organization, payment } = await sellWithReserve(app);
    app.clock.advanceDays(8);
    await app.services.settlements.releaseDue({ now: app.clock.now });

    const refund = await app.services.refunds.request({
      organizationId: organization.id,
      paymentId: payment.id,
      amount: SALE,
      idempotencyKey: "estorno-com-reserva",
    });
    await app.deliver({
      type: "refund.succeeded",
      providerRefundId: (await app.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).providerRefundId!,
      providerPaymentId: payment.providerPaymentId!,
      amount: SALE.toString(),
      currency: "BRL",
    });

    const totals = await accountTotals(app.prisma, organization.id);
    // A reserva pagou os 400 que segurava; só o restante saiu do saldo dela.
    expect(totals.RESERVES ?? 0n).toBe(0n);
    expect(totals.PRODUCER_AVAILABLE ?? 0n).toBe(0n); // o resto saiu do disponível, que zerou
    await expectLedgerBalanced(app.prisma);

    const reserve = await app.prisma.reserve.findFirstOrThrow({ where: { referenceId: payment.id } });
    expect(reserve).toMatchObject({ consumedAmount: RESERVED, status: "USED" });

    // E não volta a ser devolvida depois: o dinheiro já foi para o comprador.
    app.clock.advanceDays(31);
    expect((await app.services.reserves.releaseDue({ now: app.clock.now })).released).toBe(0n);
  });

  it("não segura duas vezes o mesmo dinheiro quando entra uma disputa", async () => {
    const { organization, payment } = await sellWithReserve(app);
    await app.deliver({
      type: "dispute.updated",
      providerDisputeId: "mock_dp_1",
      providerPaymentId: payment.providerPaymentId!,
      amount: SALE.toString(),
      currency: "BRL",
      status: "open",
    });

    const totals = await accountTotals(app.prisma, organization.id);
    // Tudo o que era do produtor nesta venda está retido — uma vez só.
    expect(-totals.RESERVES).toBe(PRODUCER_NET);
    expect(totals.PRODUCER_PENDING ?? 0n).toBe(0n);
    await expectLedgerBalanced(app.prisma);
  });
});

describe("Published reserve", () => {
  /**
   * O banco de produção nasce sem ReservePolicy. O padrão precisa ser a reserva anunciada,
   * não zero: faltar uma linha no banco não pode significar vender sem nenhuma garantia.
   */
  it("retém a reserva publicada quando nenhuma política está cadastrada", async () => {
    const app = await createTestApp();
    await app.prisma.reservePolicy.deleteMany({});
    const { organization } = await sellWithReserve(app);

    const totals = await accountTotals(app.prisma, organization.id);
    expect(-totals.RESERVES).toBe(RESERVED); // 4% do bruto, a condição do Brasil
    await expectLedgerBalanced(app.prisma);
  });
});
