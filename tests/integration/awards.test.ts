import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

/** Sells `amount` (minor units) and confirms it, returning the stored payment. */
async function sell(app: TestApp, seller: Awaited<ReturnType<typeof createSeller>>, email: string) {
  const { payment } = await startPurchase(app, seller.checkout.slug, email);
  await confirmPayment(app, payment);
  return app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
}

describe("Revenue awards", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("grants the bronze plaque when net revenue crosses the milestone", async () => {
    // Each sale nets the producer R$ 86,00 after fees; 117 of them pass R$ 10.000,00.
    const seller = await createSeller(app, { amount: 1_000_000n });
    await sell(app, seller, "grande@example.com");

    const progress = await app.services.awards.progress(seller.organization.id);
    expect(progress.netRevenue).toBe(860_000n);
    expect(progress.earnedCount).toBe(0);
    expect(progress.next?.tier).toBe("BRONZE");

    await sell(app, seller, "outra@example.com");
    const after = await app.services.awards.progress(seller.organization.id);
    expect(after.netRevenue).toBe(1_720_000n);
    expect(after.earnedCount).toBe(1);
    expect(after.awards.find((entry) => entry.tier === "BRONZE")?.award?.status).toBe("ACHIEVED");
    expect(after.next?.tier).toBe("SILVER");
  });

  it("measures what the producer kept, not what was sold", async () => {
    const seller = await createSeller(app, { amount: 1_000_000n });
    const payment = await sell(app, seller, "reembolsada@example.com");

    const refund = await app.services.refunds.request({
      organizationId: seller.organization.id,
      paymentId: payment.id,
      amount: 500_000n,
      idempotencyKey: "r-award",
    });
    const stored = await app.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    await app.deliver({
      type: "refund.succeeded",
      providerRefundId: stored.providerRefundId!,
      providerPaymentId: payment.providerPaymentId!,
      amount: "500000",
      currency: payment.currency,
    });

    // Half the sale came back, so half the producer's net went with it.
    expect((await app.services.awards.progress(seller.organization.id)).netRevenue).toBe(430_000n);
  });

  it("counts a charged back sale as nothing", async () => {
    const seller = await createSeller(app, { amount: 1_000_000n });
    const payment = await sell(app, seller, "contestada@example.com");

    const dispute = {
      type: "dispute.updated" as const,
      providerDisputeId: "dp_award",
      providerPaymentId: payment.providerPaymentId!,
      amount: payment.amount.toString(),
      currency: payment.currency,
    };
    await app.deliver({ ...dispute, status: "open" });
    await app.deliver({ ...dispute, status: "lost" });

    expect((await app.services.awards.progress(seller.organization.id)).netRevenue).toBe(0n);
  });

  it("never grants the same tier twice, even if the event is replayed", async () => {
    const seller = await createSeller(app, { amount: 2_000_000n });
    await sell(app, seller, "repetida@example.com");

    expect((await app.services.awards.progress(seller.organization.id)).earnedCount).toBe(1);
    // Replaying the grant is what a retried webhook would do.
    await app.services.awards.grantReachedTiers(seller.organization.id);
    await app.services.awards.grantReachedTiers(seller.organization.id);

    expect(await app.prisma.organizationAward.count({ where: { organizationId: seller.organization.id } })).toBe(1);
  });

  it("grants every tier passed at once when a single sale jumps the ladder", async () => {
    const seller = await createSeller(app, { amount: 20_000_000n });
    await sell(app, seller, "gigante@example.com");

    const progress = await app.services.awards.progress(seller.organization.id);
    expect(progress.netRevenue).toBe(17_200_000n);
    expect(progress.earnedCount).toBe(2); // bronze and silver
    expect(progress.next?.tier).toBe("GOLD");
  });

  it("reports progress towards the next tier", async () => {
    const seller = await createSeller(app, { amount: 500_000n });
    await sell(app, seller, "progresso@example.com");

    const progress = await app.services.awards.progress(seller.organization.id);
    // R$ 4.300,00 of the R$ 10.000,00 milestone.
    expect(progress.netRevenue).toBe(430_000n);
    expect(progress.percentage).toBe(43);
  });

  it("registers the shipping once and refuses to repeat it", async () => {
    const seller = await createSeller(app, { amount: 2_000_000n });
    await sell(app, seller, "premiada@example.com");
    const [award] = await app.services.awards.listAll();

    const shipped = await app.services.awards.registerShipping(award.id, " BR123456789BR ");
    expect(shipped).toMatchObject({ status: "SHIPPED", trackingCode: "BR123456789BR" });
    expect(shipped.shippedAt).not.toBeNull();

    await expect(app.services.awards.registerShipping(award.id, "OUTRO")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("keeps each organization's awards to itself", async () => {
    const a = await createSeller(app, { slug: "org-a", amount: 2_000_000n });
    const b = await createSeller(app, { slug: "org-b", amount: 1000n });
    await sell(app, a, "cliente-a@example.com");
    await sell(app, b, "cliente-b@example.com");

    expect((await app.services.awards.progress(a.organization.id)).earnedCount).toBe(1);
    expect((await app.services.awards.progress(b.organization.id)).earnedCount).toBe(0);
  });
});
