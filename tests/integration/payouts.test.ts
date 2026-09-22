import { beforeEach, describe, expect, it } from "vitest";
import { accountTotals, confirmPayment, createSeller, createTestApp, expectLedgerBalanced, startPurchase, type TestApp } from "../support/test-app";

async function sellerWithAvailable(app: TestApp) {
  const seller = await createSeller(app, { amount: 10_000n });
  const { payment } = await startPurchase(app, seller.checkout.slug);
  await confirmPayment(app, payment);
  app.clock.advanceDays(8);
  await app.services.settlements.releaseDue({ now: app.clock.now });
  return seller; // 8600 available
}

describe("Payout safety", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  it("never pays out more than the available balance", async () => {
    const { organization } = await sellerWithAvailable(app);
    await expect(
      app.services.payouts.request({ organizationId: organization.id, amount: 8601n, currency: "BRL", idempotencyKey: "too-much" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await app.prisma.payout.count()).toBe(0);
  });

  it("retrying with the same idempotency key never duplicates a payout", async () => {
    const { organization } = await sellerWithAvailable(app);
    const input = { organizationId: organization.id, amount: 5000n, currency: "BRL", idempotencyKey: "retry-me" };
    const [a, b] = await Promise.all([app.services.payouts.request(input), app.services.payouts.request(input)]);
    const c = await app.services.payouts.request(input);
    expect(new Set([a.id, b.id, c.id]).size).toBe(1);
    expect(await app.prisma.payout.count()).toBe(1);
    expect(await app.prisma.ledgerJournal.count({ where: { type: "payout.initiated" } })).toBe(1);
  });

  it("concurrent different payouts cannot overdraw the balance", async () => {
    const { organization } = await sellerWithAvailable(app);
    const results = await Promise.allSettled([
      app.services.payouts.request({ organizationId: organization.id, amount: 6000n, currency: "BRL", idempotencyKey: "c1" }),
      app.services.payouts.request({ organizationId: organization.id, amount: 6000n, currency: "BRL", idempotencyKey: "c2" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const totals = await accountTotals(app.prisma, organization.id);
    expect(-totals.PRODUCER_AVAILABLE).toBe(2600n);
    await expectLedgerBalanced(app.prisma);
  });

  it("blocks payouts when the merchant account is not ready", async () => {
    const { organization } = await sellerWithAvailable(app);
    await app.prisma.merchantAccount.updateMany({ where: { organizationId: organization.id }, data: { payoutsEnabled: false, status: "RESTRICTED" } });
    await expect(
      app.services.payouts.request({ organizationId: organization.id, amount: 1000n, currency: "BRL", idempotencyKey: "blocked" }),
    ).rejects.toMatchObject({ code: "PAYOUT_NOT_ALLOWED" });
  });

  it("enforces the minimum payout", async () => {
    const { organization } = await sellerWithAvailable(app);
    await expect(
      app.services.payouts.request({ organizationId: organization.id, amount: 999n, currency: "BRL", idempotencyKey: "tiny" }),
    ).rejects.toMatchObject({ code: "PAYOUT_NOT_ALLOWED" });
  });

  it("a failed payout returns the funds to AVAILABLE via a compensating journal", async () => {
    const { organization } = await sellerWithAvailable(app);
    const payout = await app.services.payouts.request({ organizationId: organization.id, amount: 8600n, currency: "BRL", idempotencyKey: "will-fail" });
    await app.deliver({ type: "payout.updated", providerPayoutId: payout.providerPayoutId!, payoutId: payout.id, status: "failed", failureReason: "account_closed" });
    await app.deliver({ type: "payout.updated", providerPayoutId: payout.providerPayoutId!, payoutId: payout.id, status: "paid" }); // late/invalid

    const final = await app.prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(final.status).toBe("FAILED");
    const totals = await accountTotals(app.prisma, organization.id);
    expect(-totals.PRODUCER_AVAILABLE).toBe(8600n);
    expect(totals.PAYOUTS).toBe(0n);
    await expectLedgerBalanced(app.prisma);
  });

  it("payout PAID webhook delivered twice settles once", async () => {
    const { organization } = await sellerWithAvailable(app);
    const payout = await app.services.payouts.request({ organizationId: organization.id, amount: 8600n, currency: "BRL", idempotencyKey: "paid-twice" });
    const event = { type: "payout.updated" as const, providerPayoutId: payout.providerPayoutId!, payoutId: payout.id, status: "paid" as const };
    await app.deliver(event, "evt_po_1");
    await app.deliver(event, "evt_po_2");
    expect(await app.prisma.ledgerJournal.count({ where: { type: "payout.paid" } })).toBe(1);
    await expectLedgerBalanced(app.prisma);
  });
});
