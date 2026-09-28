import { beforeEach, describe, expect, it } from "vitest";
import { accountTotals, confirmPayment, createSeller, createTestApp, expectLedgerBalanced, startPurchase, type TestApp } from "../support/test-app";

async function paidSale(app: TestApp) {
  const seller = await createSeller(app, { amount: 10_000n });
  const { payment } = await startPurchase(app, seller.checkout.slug);
  await confirmPayment(app, payment);
  return { ...seller, payment: await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }) };
}

async function completeRefund(app: TestApp, refundId: string) {
  const refund = await app.prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
  await app.deliver({
    type: "refund.succeeded",
    providerRefundId: refund.providerRefundId!,
    providerPaymentId: refund.payment.providerPaymentId!,
    amount: refund.amount.toString(),
    currency: refund.currency,
  });
}

describe("Refunds", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  it("full refund reverses producer + Ripay shares and only moves the ledger after provider confirmation", async () => {
    const { organization, payment } = await paidSale(app);
    const refund = await app.services.refunds.request({ organizationId: organization.id, paymentId: payment.id, amount: 10_000n, idempotencyKey: "r1" });
    expect(refund.status).toBe("PROCESSING");
    expect(await app.prisma.ledgerJournal.count({ where: { type: "refund.completed" } })).toBe(0);

    await completeRefund(app, refund.id);
    const totals = await accountTotals(app.prisma, organization.id);
    expect(totals.PRODUCER_PENDING).toBe(0n);
    expect(totals.PLATFORM_REVENUE).toBe(0n);
    expect(totals.REFUNDS).toBe(400n); // non-returned processor fee absorbed by the platform
    expect(totals.PLATFORM_CASH).toBe(0n);
    expect((await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("REFUNDED");
    expect((await app.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } })).status).toBe("REFUNDED");
    await expectLedgerBalanced(app.prisma);
  });

  it("partial refund reverses proportionally", async () => {
    const { organization, payment } = await paidSale(app);
    const refund = await app.services.refunds.request({ organizationId: organization.id, paymentId: payment.id, amount: 5000n, idempotencyKey: "r-half" });
    await completeRefund(app, refund.id);
    const totals = await accountTotals(app.prisma, organization.id);
    expect(-totals.PRODUCER_PENDING).toBe(4300n);
    expect(-totals.PLATFORM_REVENUE).toBe(500n);
    expect(totals.REFUNDS).toBe(200n);
    expect((await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PARTIALLY_REFUNDED");
    await expectLedgerBalanced(app.prisma);
  });

  it("prevents duplicate refunds (same key) and refunding more than paid", async () => {
    const { organization, payment } = await paidSale(app);
    const a = await app.services.refunds.request({ organizationId: organization.id, paymentId: payment.id, amount: 6000n, idempotencyKey: "dup" });
    const b = await app.services.refunds.request({ organizationId: organization.id, paymentId: payment.id, amount: 6000n, idempotencyKey: "dup" });
    expect(b.id).toBe(a.id);
    expect(await app.prisma.refund.count()).toBe(1);

    await expect(
      app.services.refunds.request({ organizationId: organization.id, paymentId: payment.id, amount: 4001n, idempotencyKey: "over" }),
    ).rejects.toMatchObject({ code: "REFUND_NOT_ALLOWED" });

    // Duplicate provider confirmation ledgers once.
    await completeRefund(app, a.id);
    await completeRefund(app, a.id);
    expect(await app.prisma.ledgerJournal.count({ where: { type: "refund.completed" } })).toBe(1);
    await expectLedgerBalanced(app.prisma);
  });

  it("refund after settlement debits the available balance", async () => {
    const { organization, payment } = await paidSale(app);
    app.clock.advanceDays(8);
    await app.services.settlements.releaseDue({ now: app.clock.now });
    const refund = await app.services.refunds.request({ organizationId: organization.id, paymentId: payment.id, amount: 10_000n, idempotencyKey: "late" });
    await completeRefund(app, refund.id);
    const totals = await accountTotals(app.prisma, organization.id);
    expect(totals.PRODUCER_AVAILABLE).toBe(0n);
    await expectLedgerBalanced(app.prisma);
  });

  it("refund before settlement reduces what settlement later releases", async () => {
    const { organization, payment } = await paidSale(app);
    const refund = await app.services.refunds.request({ organizationId: organization.id, paymentId: payment.id, amount: 5000n, idempotencyKey: "pre" });
    await completeRefund(app, refund.id);
    app.clock.advanceDays(8);
    const run = await app.services.settlements.releaseDue({ now: app.clock.now });
    expect(run.released).toBe(4300n);
    await expectLedgerBalanced(app.prisma);
  });
});

describe("Disputes / chargebacks", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  const dispute = (payment: { providerPaymentId: string | null }, status: "open" | "under_review" | "won" | "lost") => ({
    type: "dispute.updated" as const,
    providerDisputeId: "dp_1",
    providerPaymentId: payment.providerPaymentId!,
    amount: "10000",
    currency: "BRL",
    status,
  });

  it("opening a dispute moves the producer share to RESERVES", async () => {
    const { organization, payment } = await paidSale(app);
    await app.deliver(dispute(payment, "open"));
    const balance = await app.prisma.balance.findFirstOrThrow({ where: { organizationId: organization.id } });
    expect(balance.pendingAmount).toBe(0n);
    expect(balance.reservedAmount).toBe(8600n);
    expect((await app.prisma.dispute.findFirstOrThrow()).status).toBe("OPEN");
    await expectLedgerBalanced(app.prisma);
  });

  it("won dispute releases the reserve back to the producer", async () => {
    const { organization, payment } = await paidSale(app);
    await app.deliver(dispute(payment, "open"));
    await app.deliver(dispute(payment, "under_review"));
    await app.deliver(dispute(payment, "won"));
    const balance = await app.prisma.balance.findFirstOrThrow({ where: { organizationId: organization.id } });
    expect(balance.reservedAmount).toBe(0n);
    expect(balance.pendingAmount).toBe(8600n);
    await expectLedgerBalanced(app.prisma);
  });

  it("lost dispute (even if 'lost' arrives first) takes the money out once", async () => {
    const { organization, payment } = await paidSale(app);
    await app.deliver(dispute(payment, "lost"));
    await app.deliver(dispute(payment, "lost"));
    const totals = await accountTotals(app.prisma, organization.id);
    expect(totals.RESERVES).toBe(0n);
    expect(totals.PRODUCER_PENDING).toBe(0n);
    expect(totals.PLATFORM_CASH).toBe(0n);
    expect(totals.CHARGEBACKS).toBe(400n);
    expect((await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("CHARGEBACK");
    expect(await app.prisma.ledgerJournal.count({ where: { type: "dispute.lost" } })).toBe(1);
    await expectLedgerBalanced(app.prisma);
  });
});
