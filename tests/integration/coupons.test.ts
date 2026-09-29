import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, expectLedgerBalanced, startPurchase, type TestApp } from "../support/test-app";

const BASE_COUPON = {
  type: "PERCENTAGE" as const,
  currency: "BRL",
  oncePerCustomer: false,
  active: true,
};

describe("Coupons", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  /** Seller with a R$ 100,00 offer. */
  async function seller(options: { slug?: string } = {}) {
    return createSeller(app, options);
  }

  it("takes a percentage off the order and charges the discounted amount", async () => {
    const s = await seller();
    await app.services.coupons.create(s.organization.id, s.user.id, { ...BASE_COUPON, code: "BEMVINDO", percentage: "10" });

    const { payment } = await startPurchase(app, s.checkout.slug, "compradora@example.com", { couponCode: "bemvindo" });
    const order = await app.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });

    expect(order).toMatchObject({ subtotalAmount: 10_000n, discountAmount: 1000n, totalAmount: 9000n, couponCode: "BEMVINDO" });
    expect(payment.amount).toBe(9000n);

    const redemption = await app.prisma.couponRedemption.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(redemption.amount).toBe(1000n);
    expect((await app.prisma.coupon.findFirstOrThrow()).redemptions).toBe(1);
  });

  it("takes a fixed amount off", async () => {
    const s = await seller();
    await app.services.coupons.create(s.organization.id, s.user.id, {
      ...BASE_COUPON,
      type: "FIXED_AMOUNT",
      code: "MENOS30",
      amount: "30,00",
    });

    const { payment } = await startPurchase(app, s.checkout.slug, "fixa@example.com", { couponCode: "MENOS30" });
    expect(payment.amount).toBe(7000n);
  });

  it("rounds the discount down so a percentage never gives away more than it promises", async () => {
    const s = await createSeller(app, { amount: 9999n });
    await app.services.coupons.create(s.organization.id, s.user.id, { ...BASE_COUPON, code: "DEZ", percentage: "10" });

    const { payment } = await startPurchase(app, s.checkout.slug, "arredonda@example.com", { couponCode: "DEZ" });
    // 10% of R$ 99,99 is R$ 9,999 → R$ 9,99.
    expect(payment.amount).toBe(9000n);
    const order = await app.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    expect(order.discountAmount).toBe(999n);
  });

  it("refuses a coupon that is inactive, expired, or for another product", async () => {
    const s = await seller();
    const org = s.organization.id;
    const other = await app.services.products.create(org, s.user.id, { name: "Outro", slug: "outro", type: "COURSE", status: "ACTIVE" });

    await app.services.coupons.create(org, s.user.id, { ...BASE_COUPON, code: "INATIVO", percentage: "10", active: false });
    await app.services.coupons.create(org, s.user.id, {
      ...BASE_COUPON,
      code: "EXPIRADO",
      percentage: "10",
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    await app.services.coupons.create(org, s.user.id, { ...BASE_COUPON, code: "OUTROPROD", percentage: "10", productId: other.id });
    await app.services.coupons.create(org, s.user.id, { ...BASE_COUPON, code: "MINIMO", percentage: "10", minAmount: "200,00" });

    for (const code of ["INATIVO", "EXPIRADO", "OUTROPROD", "MINIMO", "NAOEXISTE"]) {
      await expect(startPurchase(app, s.checkout.slug, `${code}@example.com`, { couponCode: code })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    }
    expect(await app.prisma.order.count()).toBe(0);
  });

  it("never lets a coupon zero the order", async () => {
    const s = await seller();
    await app.services.coupons.create(s.organization.id, s.user.id, { ...BASE_COUPON, code: "TUDO", percentage: "100" });

    await expect(startPurchase(app, s.checkout.slug, "tudo@example.com", { couponCode: "TUDO" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("stops at the redemption limit even when buyers race for the last one", async () => {
    const s = await seller();
    await app.services.coupons.create(s.organization.id, s.user.id, {
      ...BASE_COUPON,
      code: "PRIMEIROS2",
      percentage: "10",
      maxRedemptions: 2,
    });

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) => startPurchase(app, s.checkout.slug, `corrida${index}@example.com`, { couponCode: "PRIMEIROS2" })),
    );

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(2);
    const coupon = await app.prisma.coupon.findFirstOrThrow();
    expect(coupon.redemptions).toBe(2);
    expect(await app.prisma.couponRedemption.count()).toBe(2);
  });

  it("blocks a second use by the same customer when the coupon says so", async () => {
    const s = await seller();
    await app.services.coupons.create(s.organization.id, s.user.id, {
      ...BASE_COUPON,
      code: "UMAVEZ",
      percentage: "10",
      oncePerCustomer: true,
    });

    await startPurchase(app, s.checkout.slug, "repetida@example.com", { couponCode: "UMAVEZ" });
    await expect(startPurchase(app, s.checkout.slug, "repetida@example.com", { couponCode: "UMAVEZ" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    // Someone else still can.
    await expect(startPurchase(app, s.checkout.slug, "outra@example.com", { couponCode: "UMAVEZ" })).resolves.toBeDefined();
  });

  it("does not accept a code from another organization", async () => {
    const a = await seller({ slug: "org-a" });
    const b = await seller({ slug: "org-b" });
    await app.services.coupons.create(b.organization.id, b.user.id, { ...BASE_COUPON, code: "SODOB", percentage: "50" });

    await expect(startPurchase(app, a.checkout.slug, "curiosa@example.com", { couponCode: "SODOB" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("charges fees on the discounted amount and keeps the ledger balanced", async () => {
    const s = await seller();
    await app.services.coupons.create(s.organization.id, s.user.id, { ...BASE_COUPON, code: "METADE", percentage: "50" });

    const { payment } = await startPurchase(app, s.checkout.slug, "ledger@example.com", { couponCode: "METADE" });
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paid.amount).toBe(5000n);
    // Platform fee is 10% of what was actually charged, not of the list price.
    expect(paid.platformFeeAmount).toBe(500n);
    await expectLedgerBalanced(app.prisma);
  });

  it("refuses duplicate codes and keeps a used coupon from being deleted", async () => {
    const s = await seller();
    const org = s.organization.id;
    await app.services.coupons.create(org, s.user.id, { ...BASE_COUPON, code: "UNICO", percentage: "10" });

    await expect(app.services.coupons.create(org, s.user.id, { ...BASE_COUPON, code: "unico", percentage: "20" })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const coupon = (await app.services.coupons.list(org))[0];
    await startPurchase(app, s.checkout.slug, "usou@example.com", { couponCode: "UNICO" });
    await expect(app.services.coupons.remove(org, s.user.id, coupon.id)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    // Deactivating is the way out.
    await app.services.coupons.setActive(org, s.user.id, coupon.id, false);
    expect((await app.services.coupons.get(org, coupon.id)).active).toBe(false);
  });
});
