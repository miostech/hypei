import { beforeEach, describe, expect, it } from "vitest";
import { accountTotals, confirmPayment, createSeller, createTestApp, expectLedgerBalanced, startPurchase, type TestApp } from "../support/test-app";

/**
 * Reference scenario: price 10000 BRL, processor fee 400, Ripay fee 1000, producer net 8600.
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
    expect(paid.producerNetAmount).toBe(8600n);
    expect((await app.prisma.order.findUniqueOrThrow({ where: { id: paid.orderId } })).status).toBe("PAID");

    let totals = await accountTotals(app.prisma, organization.id);
    expect(totals.PLATFORM_CASH).toBe(10_000n); // gross payment
    expect(-totals.PROCESSOR_FEES).toBe(400n); // processor fee
    expect(-totals.PLATFORM_REVENUE).toBe(1000n); // Ripay revenue
    expect(-totals.PRODUCER_PENDING).toBe(8600n); // producer pending
    expect(totals.PRODUCER_AVAILABLE ?? 0n).toBe(0n);
    await expectLedgerBalanced(app.prisma);

    let balance = await app.prisma.balance.findUniqueOrThrow({ where: { organizationId_currency: { organizationId: organization.id, currency: "BRL" } } });
    expect(balance.pendingAmount).toBe(8600n);
    expect(balance.availableAmount).toBe(0n);

    // ── Payout from pending is NOT allowed ───────────────────────
    await expect(
      app.services.payouts.request({ organizationId: organization.id, amount: 8600n, currency: "BRL", idempotencyKey: "early" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });

    // ── Settlement before the window does nothing ─────────────────
    expect((await app.services.settlements.releaseDue({ now: app.clock.now })).processed).toBe(0);

    // ── Settlement after D+7 ─────────────────────────────────────
    app.clock.advanceDays(8);
    const run = await app.services.settlements.releaseDue({ now: app.clock.now });
    expect(run.released).toBe(8600n);
    totals = await accountTotals(app.prisma, organization.id);
    expect(totals.PRODUCER_PENDING).toBe(0n); // pending decreased by 8600
    expect(-totals.PRODUCER_AVAILABLE).toBe(8600n); // available increased by 8600
    await expectLedgerBalanced(app.prisma);

    // Settlement is idempotent.
    expect((await app.services.settlements.releaseDue({ now: app.clock.now })).processed).toBe(0);

    // ── Payout ───────────────────────────────────────────────────
    const payout = await app.services.payouts.request({ organizationId: organization.id, amount: 8600n, currency: "BRL", idempotencyKey: "payout-1" });
    expect(payout.status).toBe("PENDING"); // never PAID before the provider confirms
    totals = await accountTotals(app.prisma, organization.id);
    expect(totals.PRODUCER_AVAILABLE).toBe(0n); // available decreased by 8600
    expect(-totals.PAYOUTS).toBe(8600n); // in transit

    await app.deliver({ type: "payout.updated", providerPayoutId: payout.providerPayoutId!, payoutId: payout.id, status: "paid" });
    const paidPayout = await app.prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(paidPayout.status).toBe("PAID");
    expect(paidPayout.amount).toBe(8600n);

    totals = await accountTotals(app.prisma, organization.id);
    expect(totals.PAYOUTS).toBe(0n);
    expect(totals.PLATFORM_CASH).toBe(1400n); // 10000 in − 8600 out
    // Accounting equation: cash = processor fees owed + Ripay revenue + producer balances.
    expect(totals.PLATFORM_CASH).toBe(-totals.PROCESSOR_FEES + -totals.PLATFORM_REVENUE + -(totals.PRODUCER_PENDING ?? 0n) + -(totals.PRODUCER_AVAILABLE ?? 0n));
    await expectLedgerBalanced(app.prisma);

    balance = await app.prisma.balance.findUniqueOrThrow({ where: { organizationId_currency: { organizationId: organization.id, currency: "BRL" } } });
    expect(balance).toMatchObject({ pendingAmount: 0n, availableAmount: 0n, reservedAmount: 0n });
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
