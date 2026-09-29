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

/** Seller with an affiliate on 30%, plus that affiliate's referral code. */
async function sellerWithAffiliate(app: TestApp, options: { bps?: string; slug?: string } = {}) {
  const seller = await createSeller(app, { slug: options.slug });
  const affiliate = await app.services.affiliates.create(seller.organization.id, seller.user.id, {
    name: "Parceira Ana",
    email: "ana@example.com",
    commissionBps: Number(options.bps ?? 3000),
    active: true,
  });
  const detail = await app.services.affiliates.get(seller.organization.id, affiliate.id);
  return { seller, affiliate, code: detail.links[0].code };
}

describe("Affiliates", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("gets its own link when created", async () => {
    const { code } = await sellerWithAffiliate(app);
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ23456789]{8}$/);
  });

  it("takes the commission out of the producer's share, never out of the Ripay fee", async () => {
    const { seller, affiliate, code } = await sellerWithAffiliate(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "indicada@example.com", { referralCode: code });
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    // R$ 100,00: processor 4%, Ripay 10%, affiliate 30% of the sale.
    expect(paid.processorFeeAmount).toBe(400n);
    expect(paid.platformFeeAmount).toBe(1000n);
    expect(paid.affiliateCommissionAmount).toBe(3000n);
    expect(paid.producerNetAmount).toBe(5600n);

    const totals = await accountTotals(app.prisma, seller.organization.id);
    expect(totals.AFFILIATE_PAYABLE).toBe(-3000n); // credit balance: owed to the affiliate
    expect(totals.PRODUCER_PENDING).toBe(-5600n);
    await expectLedgerBalanced(app.prisma);

    const commission = await app.prisma.affiliateCommission.findFirstOrThrow();
    expect(commission).toMatchObject({ affiliateId: affiliate.id, amount: 3000n, status: "PENDING" });
  });

  it("pays nothing when the sale came without a referral", async () => {
    const { seller } = await sellerWithAffiliate(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "organica@example.com");
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paid.affiliateCommissionAmount).toBe(0n);
    expect(paid.producerNetAmount).toBe(8600n);
    expect(await app.prisma.affiliateCommission.count()).toBe(0);
  });

  it("ignores the link of a deactivated affiliate", async () => {
    const { seller, affiliate, code } = await sellerWithAffiliate(app);
    await app.services.affiliates.setActive(seller.organization.id, seller.user.id, affiliate.id, false);

    const { payment } = await startPurchase(app, seller.checkout.slug, "tarde@example.com", { referralCode: code });
    await confirmPayment(app, payment);

    const order = await app.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    expect(order.affiliateId).toBeNull();
    expect((await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).affiliateCommissionAmount).toBe(0n);
  });

  it("does not attribute a code that belongs to another organization", async () => {
    const a = await createSeller(app, { slug: "org-a" });
    const { code } = await sellerWithAffiliate(app, { slug: "org-b" });

    const { payment } = await startPurchase(app, a.checkout.slug, "cruzada@example.com", { referralCode: code });
    const order = await app.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    expect(order.affiliateId).toBeNull();
  });

  it("applies the commission over the discounted price when a coupon was used", async () => {
    const { seller, code } = await sellerWithAffiliate(app);
    await app.services.coupons.create(seller.organization.id, seller.user.id, {
      code: "METADE",
      type: "PERCENTAGE",
      percentage: "50",
      currency: "BRL",
      oncePerCustomer: false,
      active: true,
    });

    const { payment } = await startPurchase(app, seller.checkout.slug, "cupom@example.com", { referralCode: code, couponCode: "METADE" });
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paid.amount).toBe(5000n);
    // 30% of what was actually charged, not of the list price.
    expect(paid.affiliateCommissionAmount).toBe(1500n);
    await expectLedgerBalanced(app.prisma);
  });

  it("never lets the commission push the producer below zero", async () => {
    const { seller, code } = await sellerWithAffiliate(app, { bps: "9000" });
    const { payment } = await startPurchase(app, seller.checkout.slug, "limite@example.com", { referralCode: code });
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    // Processor (400) + Ripay (1000) leave 8600; a 90% commission is capped there.
    expect(paid.affiliateCommissionAmount).toBe(8600n);
    expect(paid.producerNetAmount).toBe(0n);
    await expectLedgerBalanced(app.prisma);
  });

  it("takes the commission back when the sale is refunded", async () => {
    const { seller, code } = await sellerWithAffiliate(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "devolvida@example.com", { referralCode: code });
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const refund = await app.services.refunds.request({
      organizationId: seller.organization.id,
      paymentId: paid.id,
      amount: paid.amount,
      idempotencyKey: "refund-total",
    });
    const stored = await app.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    await app.deliver({
      type: "refund.succeeded",
      providerRefundId: stored.providerRefundId!,
      providerPaymentId: paid.providerPaymentId!,
      amount: paid.amount.toString(),
      currency: paid.currency,
    });

    const totals = await accountTotals(app.prisma, seller.organization.id);
    expect(totals.AFFILIATE_PAYABLE).toBe(0n);
    expect(await app.prisma.affiliateCommission.findFirstOrThrow()).toMatchObject({ status: "CANCELED", reversedAmount: 3000n });
    await expectLedgerBalanced(app.prisma);
  });

  it("takes back only the matching slice on a partial refund", async () => {
    const { seller, code } = await sellerWithAffiliate(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "parcial@example.com", { referralCode: code });
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const refund = await app.services.refunds.request({
      organizationId: seller.organization.id,
      paymentId: paid.id,
      amount: 5000n,
      idempotencyKey: "refund-half",
    });
    const stored = await app.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    await app.deliver({
      type: "refund.succeeded",
      providerRefundId: stored.providerRefundId!,
      providerPaymentId: paid.providerPaymentId!,
      amount: "5000",
      currency: paid.currency,
    });

    const commission = await app.prisma.affiliateCommission.findFirstOrThrow();
    expect(commission.reversedAmount).toBe(1500n);
    expect(commission.status).toBe("PENDING");
    expect((await accountTotals(app.prisma, seller.organization.id)).AFFILIATE_PAYABLE).toBe(-1500n);
    await expectLedgerBalanced(app.prisma);
  });

  it("takes the commission back on a lost chargeback", async () => {
    const { seller, code } = await sellerWithAffiliate(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "contestada@example.com", { referralCode: code });
    await confirmPayment(app, payment);
    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });

    const dispute = {
      type: "dispute.updated" as const,
      providerDisputeId: "dp_aff",
      providerPaymentId: paid.providerPaymentId!,
      amount: paid.amount.toString(),
      currency: paid.currency,
    };
    await app.deliver({ ...dispute, status: "open" });
    await app.deliver({ ...dispute, status: "lost" });

    expect((await accountTotals(app.prisma, seller.organization.id)).AFFILIATE_PAYABLE).toBe(0n);
    expect((await app.prisma.affiliateCommission.findFirstOrThrow()).status).toBe("CANCELED");
    await expectLedgerBalanced(app.prisma);
  });

  it("releases the commission for payment once the sale settles, and records the payment", async () => {
    const { seller, affiliate, code } = await sellerWithAffiliate(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "liberada@example.com", { referralCode: code });
    await confirmPayment(app, payment);

    expect((await app.prisma.affiliateCommission.findFirstOrThrow()).status).toBe("PENDING");
    await expect(app.services.affiliates.payCommissions(seller.organization.id, seller.user.id, affiliate.id)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    app.clock.advanceDays(10);
    await app.services.settlements.releaseDue({ now: app.clock.now });
    expect((await app.prisma.affiliateCommission.findFirstOrThrow()).status).toBe("AVAILABLE");

    const result = await app.services.affiliates.payCommissions(seller.organization.id, seller.user.id, affiliate.id);
    expect(result).toMatchObject({ total: 3000n, count: 1 });

    const commission = await app.prisma.affiliateCommission.findFirstOrThrow();
    expect(commission.status).toBe("PAID");
    expect(commission.paidAt).not.toBeNull();
    expect((await accountTotals(app.prisma, seller.organization.id)).AFFILIATE_PAYABLE).toBe(0n);
    await expectLedgerBalanced(app.prisma);
  });

  it("refuses a duplicate e-mail in the same organization", async () => {
    const { seller } = await sellerWithAffiliate(app);
    await expect(
      app.services.affiliates.create(seller.organization.id, seller.user.id, {
        name: "Outra",
        email: "ANA@example.com",
        commissionBps: 1000,
        active: true,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
