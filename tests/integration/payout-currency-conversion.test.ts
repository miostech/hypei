import { beforeEach, describe, expect, it } from "vitest";
import { ratePair } from "@/lib/providers/exchange";
import {
  accountTotals,
  confirmPayment,
  createSeller,
  createTestApp,
  expectLedgerBalanced,
  startPurchase,
  type TestApp,
} from "../support/test-app";

/** R$ 5,00 por dólar: cotação redonda para a conta do teste ser conferível na mão. */
const RATE = 500_000_000n;

/**
 * Venda de $100,00 com a taxa publicada do dólar (9,99% + $0,80) e 4% de processamento:
 * 10000 − 400 − (999 + 80) = 8521 para a produtora, que não tem reserva nestes testes.
 */
const USD_NET = 8521n;

/** Uma conta brasileira que vende em dólar: recebe em real, convertido no saque. */
async function sellInDollars(app: TestApp) {
  const seller = await createSeller(app, { amount: 10_000n });
  const offer = await app.services.offers.create(seller.organization.id, seller.user.id, {
    productId: seller.product.id,
    name: "Oferta em dólar",
    price: "100,00",
    currency: "USD",
    billingType: "ONE_TIME",
    active: true,
  });
  const checkout = await app.services.checkouts.create(seller.organization.id, seller.user.id, {
    offerId: offer.id,
    name: "Checkout USD",
    slug: `co-usd-${seller.organization.slug}`,
    headline: "Buy now",
    accentColor: "#5B3DF5",
    collectPhone: false,
    guaranteeDays: 7,
    enabledPaymentMethods: [],
    orderBumps: [],
  });

  const { payment } = await startPurchase(app, checkout.slug);
  await confirmPayment(app, payment);
  app.clock.advanceDays(8);
  await app.services.settlements.releaseDue({ now: app.clock.now });
  return seller;
}

describe("Payout with currency conversion", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp({ rates: { [ratePair("USD", "BRL")]: RATE } });
  });

  it("converte o saldo em dólar para a moeda da conta e congela a cotação no saque", async () => {
    const { organization } = await sellInDollars(app);

    const payout = await app.services.payouts.request({
      organizationId: organization.id,
      amount: USD_NET,
      currency: "USD",
      idempotencyKey: "saque-em-dolar",
    });

    // O saque é em real: é o que sai para o banco, e é sobre ele que a taxa foi cobrada.
    expect(payout).toMatchObject({
      amount: USD_NET * 5n,
      currency: "BRL",
      sourceAmount: USD_NET,
      sourceCurrency: "USD",
      exchangeRate: RATE,
    });
    expect(payout.feeAmount).toBe(367n);

    // O saldo em dólar zerou, e a conta de câmbio fechou os dois lados.
    const usd = await accountTotals(app.prisma, organization.id, "USD");
    expect(usd.PRODUCER_AVAILABLE ?? 0n).toBe(0n);
    expect(-usd.FX_CONVERSION).toBe(USD_NET);

    const brl = await accountTotals(app.prisma, organization.id, "BRL");
    expect(brl.FX_CONVERSION).toBe(USD_NET * 5n);
    expect(brl.PRODUCER_AVAILABLE ?? 0n).toBe(0n); // entrou convertido e saiu no saque
    expect(-brl.PAYOUTS).toBe(USD_NET * 5n - 367n);
    await expectLedgerBalanced(app.prisma);
  });

  it("cobra a taxa e o mínimo sobre o que chega na conta, não sobre o saldo de origem", async () => {
    const { organization } = await sellInDollars(app);

    // $1,50 passa do mínimo em dólar ($5,00 não), mas vira R$ 7,50 — abaixo do mínimo em real.
    await expect(
      app.services.payouts.request({
        organizationId: organization.id,
        amount: 150n,
        currency: "USD",
        idempotencyKey: "pouco-demais",
      }),
    ).rejects.toMatchObject({ code: "PAYOUT_NOT_ALLOWED" });
    expect(await app.prisma.payout.count()).toBe(0);
  });

  it("não converte quando o saldo já está na moeda da conta", async () => {
    const seller = await createSeller(app, { amount: 10_000n });
    const { payment } = await startPurchase(app, seller.checkout.slug);
    await confirmPayment(app, payment);
    app.clock.advanceDays(8);
    await app.services.settlements.releaseDue({ now: app.clock.now });

    const payout = await app.services.payouts.request({
      organizationId: seller.organization.id,
      amount: 5000n,
      currency: "BRL",
      idempotencyKey: "sem-conversao",
    });

    expect(payout).toMatchObject({ amount: 5000n, currency: "BRL", sourceAmount: null, sourceCurrency: null, exchangeRate: null });
    expect(await app.prisma.ledgerJournal.count({ where: { type: "fx.converted" } })).toBe(0);
  });
});
