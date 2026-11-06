import { beforeEach, describe, expect, it } from "vitest";
import { accountTotals, confirmPayment, createSeller, createTestApp, expectLedgerBalanced, startPurchase, type TestApp } from "../support/test-app";

/**
 * Reference scenario: price 10000 BRL, Kabrun fee 1000, producer net 9000.
 *
 * O adquirente cobra 400 e fica com eles antes de o dinheiro chegar: entra 9600 em caixa, e
 * os 400 são despesa da Kabrun, paga com a taxa dela (ADR 011). O produtor não vê esse número.
 *
 * Payment → Ledger → Balance → Settlement → Payout, checking that money is never created or lost.
 */
describe("Financial flow: payment → ledger → balance → settlement → payout", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp({ platformFeeBps: 1000, processorFeeBps: 400, settlementDays: 7 });
  });

  it("follows the full lifecycle and the ledger always closes", async () => {
    const { organization, checkout } = await createSeller(app, { amount: 10_000n });
    const { payment } = await startPurchase(app, checkout.slug);
    expect(payment.status).toBe("PENDING");
    expect(payment.amount).toBe(10_000n);

    // Nothing is ledgered before the provider confirms.
    expect(await app.prisma.ledgerEntry.count()).toBe(0);

    // ── Payment confirmed by webhook ──────────────────────────────
    await confirmPayment(app, payment);
    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paid.status).toBe("PAID");
    expect(paid.processorFeeAmount).toBe(400n);
    expect(paid.platformFeeAmount).toBe(1000n);
    expect(paid.producerNetAmount).toBe(9000n);
    expect((await app.prisma.order.findUniqueOrThrow({ where: { id: paid.orderId } })).status).toBe("PAID");

    let totals = await accountTotals(app.prisma, organization.id);
    expect(totals.PLATFORM_CASH).toBe(9600n); // o que o adquirente repassou
    expect(totals.PROCESSOR_FEES).toBe(400n); // despesa da Kabrun, não desconto do produtor
    expect(-totals.PLATFORM_REVENUE).toBe(1000n); // Kabrun revenue
    expect(-totals.PRODUCER_PENDING).toBe(9000n); // producer pending
    expect(totals.PRODUCER_AVAILABLE ?? 0n).toBe(0n);
    await expectLedgerBalanced(app.prisma);

    let balance = await app.prisma.balance.findUniqueOrThrow({ where: { organizationId_currency: { organizationId: organization.id, currency: "BRL" } } });
    expect(balance.pendingAmount).toBe(9000n);
    expect(balance.availableAmount).toBe(0n);

    // ── Payout from pending is NOT allowed ───────────────────────
    await expect(
      app.services.payouts.request({ organizationId: organization.id, amount: 9000n, currency: "BRL", idempotencyKey: "early" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });

    // ── Settlement before the window does nothing ─────────────────
    expect((await app.services.settlements.releaseDue({ now: app.clock.now })).processed).toBe(0);

    // ── Settlement after D+7 ─────────────────────────────────────
    app.clock.advanceDays(8);
    const run = await app.services.settlements.releaseDue({ now: app.clock.now });
    expect(run.released).toBe(9000n);
    totals = await accountTotals(app.prisma, organization.id);
    expect(totals.PRODUCER_PENDING).toBe(0n); // pending decreased by 9000
    expect(-totals.PRODUCER_AVAILABLE).toBe(9000n); // available increased by 9000
    await expectLedgerBalanced(app.prisma);

    // Settlement is idempotent.
    expect((await app.services.settlements.releaseDue({ now: app.clock.now })).processed).toBe(0);

    // ── Payout ───────────────────────────────────────────────────
    const payout = await app.services.payouts.request({ organizationId: organization.id, amount: 9000n, currency: "BRL", idempotencyKey: "payout-1" });
    expect(payout.status).toBe("PENDING"); // never PAID before the provider confirms
    totals = await accountTotals(app.prisma, organization.id);
    expect(totals.PRODUCER_AVAILABLE).toBe(0n); // available decreased by 9000
    expect(-totals.PAYOUTS).toBe(9000n - 367n); // in transit: the full amount left her balance, minus the payout fee

    await app.deliver({ type: "payout.updated", providerPayoutId: payout.providerPayoutId!, payoutId: payout.id, status: "paid" });
    const paidPayout = await app.prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(paidPayout.status).toBe("PAID");
    expect(paidPayout.amount).toBe(9000n);

    totals = await accountTotals(app.prisma, organization.id);
    expect(totals.PAYOUTS).toBe(0n);
    expect(totals.PLATFORM_CASH).toBe(967n); // 9600 entraram, 8633 saíram (a taxa de saque não saiu)
    // A equação ganhou a despesa, com o sinal de quem consome caixa: o que a Kabrun cobrou,
    // menos o que ela pagou ao adquirente, mais o que ainda deve aos produtores.
    expect(totals.PLATFORM_CASH).toBe(
      -totals.PLATFORM_REVENUE - totals.PROCESSOR_FEES + -(totals.PRODUCER_PENDING ?? 0n) + -(totals.PRODUCER_AVAILABLE ?? 0n),
    );
    await expectLedgerBalanced(app.prisma);

    balance = await app.prisma.balance.findUniqueOrThrow({ where: { organizationId_currency: { organizationId: organization.id, currency: "BRL" } } });
    expect(balance).toMatchObject({ pendingAmount: 0n, availableAmount: 0n, reservedAmount: 0n });
  });

  /**
   * O banco de produção nasce sem nenhuma PlatformFeePolicy, e o default antigo era zero:
   * toda venda passava sem taxa, sem erro e sem log. O harness sempre cria uma política,
   * então este caminho nunca era exercitado — era preciso apagá-la para enxergar o furo.
   */
  it("charges the published fee when no policy is registered, instead of nothing", async () => {
    await app.prisma.platformFeePolicy.deleteMany({});
    const { checkout } = await createSeller(app, { amount: 10_000n });
    const { payment } = await startPurchase(app, checkout.slug);
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    // 8,99% de 10000 = 899, mais o fixo de 249.
    expect(paid.platformFeeAmount).toBe(1148n);
    expect(paid.producerNetAmount).toBe(10_000n - 1148n);
    await expectLedgerBalanced(app.prisma);
  });

  it("keeps the Balance projection identical to the ledger", async () => {
    const { organization, checkout } = await createSeller(app, { amount: 4990n });
    for (let i = 0; i < 3; i++) {
      const { payment } = await startPurchase(app, checkout.slug);
      await confirmPayment(app, payment);
    }
    const fromLedger = await app.services.balances.computeFromLedger(app.services.uow.repos, organization.id, "BRL");
    const projection = await app.prisma.balance.findUniqueOrThrow({ where: { organizationId_currency: { organizationId: organization.id, currency: "BRL" } } });
    expect(projection.pendingAmount).toBe(fromLedger.pending);
    expect(projection.availableAmount).toBe(fromLedger.available);
    // Balance is NOT the sum of orders: fees are excluded.
    const orders = await app.prisma.order.aggregate({ where: { organizationId: organization.id, status: "PAID" }, _sum: { totalAmount: true } });
    expect(projection.pendingAmount).toBeLessThan(orders._sum.totalAmount!);
    await expectLedgerBalanced(app.prisma);
  });

  it("ledger entries are append-only (no update/delete API)", () => {
    const repo = app.services.uow.repos.ledger as unknown as Record<string, unknown>;
    expect(repo.update).toBeUndefined();
    expect(repo.delete).toBeUndefined();
    expect(repo.updateEntry).toBeUndefined();
  });

  it("rejects unbalanced journals", async () => {
    const { organization } = await createSeller(app);
    await expect(
      app.services.uow.transaction((repos) =>
        app.services.ledger.post(repos, {
          organizationId: organization.id,
          idempotencyKey: "bad",
          type: "test",
          referenceType: "Test",
          referenceId: "1",
          currency: "BRL",
          description: "unbalanced",
          lines: [
            { account: "PLATFORM_CASH", direction: "DEBIT", amount: 100n },
            { account: "PRODUCER_PENDING", direction: "CREDIT", amount: 99n },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: "LEDGER_UNBALANCED" });
    expect(await app.prisma.ledgerEntry.count()).toBe(0);
  });

  it("re-posting the same idempotency key is a no-op", async () => {
    const { organization } = await createSeller(app);
    const input = {
      organizationId: organization.id,
      idempotencyKey: "same-key",
      type: "test",
      referenceType: "Test",
      referenceId: "1",
      currency: "BRL" as const,
      description: "adjust",
      lines: [
        { account: "PLATFORM_CASH" as const, direction: "DEBIT" as const, amount: 100n },
        { account: "PLATFORM_REVENUE" as const, direction: "CREDIT" as const, amount: 100n },
      ],
    };
    const first = await app.services.uow.transaction((repos) => app.services.ledger.post(repos, input));
    const second = await app.services.uow.transaction((repos) => app.services.ledger.post(repos, input));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.journal.id).toBe(first.journal.id);
    expect(await app.prisma.ledgerEntry.count()).toBe(2);
  });
});
