import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

/**
 * Cria um segundo produto na mesma organização, com oferta própria, para servir de bump.
 * O preço da oferta é de propósito diferente do preço do bump: é exatamente essa divergência
 * que os testes abaixo precisam enxergar.
 */
async function bumpProduct(
  app: TestApp,
  seller: Seller,
  options: { slug?: string; offerPrice?: string; billingType?: "ONE_TIME" | "SUBSCRIPTION" } = {},
) {
  const slug = options.slug ?? "planilhas";
  const product = await app.services.products.create(seller.organization.id, seller.user.id, {
    name: `Produto ${slug}`,
    slug,
    type: "DIGITAL_PRODUCT",
    status: "ACTIVE",
  });
  const offer = await app.services.offers.create(seller.organization.id, seller.user.id, {
    productId: product.id,
    name: "Oferta avulsa",
    price: options.offerPrice ?? "97,00",
    currency: "BRL",
    billingType: options.billingType ?? "ONE_TIME",
    billingInterval: options.billingType === "SUBSCRIPTION" ? "MONTH" : undefined,
    active: true,
  });
  return { product, offer };
}

type BumpInput = { offerId: string; headline: string; price: string; description?: string; compareAtPrice?: string };
type Seller = Awaited<ReturnType<typeof createSeller>>;

/** O formulário do checkout, com os bumps pedidos e o resto nos valores de sempre. */
function builder(seller: Seller, orderBumps: BumpInput[] = []) {
  return {
    offerId: seller.offer.id,
    name: seller.checkout.name,
    slug: seller.checkout.slug,
    headline: "Compre agora",
    accentColor: "#5B3DF5",
    collectPhone: false,
    guaranteeDays: 7,
    enabledPaymentMethods: [],
    orderBumps,
  };
}

/** Salva uma versão nova do checkout do vendedor com estes bumps. */
function saveBumps(app: TestApp, seller: Seller, orderBumps: BumpInput[]) {
  return app.services.checkouts.updateConfig(seller.organization.id, seller.user.id, seller.checkout.id, builder(seller, orderBumps));
}

describe("Order bump", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  it("charges the price typed on the checkout, not the price of the bump offer", async () => {
    const seller = await createSeller(app, { amount: 10_000n });
    const bump = await bumpProduct(app, seller, { offerPrice: "97,00" });
    await saveBumps(app, seller, [{ offerId: bump.offer.id, headline: "Leve as planilhas", price: "29,00" }]);

    const view = await app.services.checkouts.getPublic(seller.checkout.slug);
    expect(view?.orderBumps).toHaveLength(1);
    expect(view?.orderBumps[0]).toMatchObject({ offerId: bump.offer.id, amount: 2_900n, productName: "Produto planilhas" });

    const { result, payment } = await startPurchase(app, seller.checkout.slug, "ana@example.com", { bumpOfferIds: [bump.offer.id] });
    expect(payment.amount).toBe(12_900n);

    const order = await app.prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: { orderBy: { unitAmount: "desc" } } } });
    expect(order.totalAmount).toBe(12_900n);
    expect(order.subtotalAmount).toBe(12_900n);
    expect(order.items.map((item) => [item.productName, item.unitAmount])).toEqual([
      ["Curso Teste", 10_000n],
      ["Produto planilhas", 2_900n],
    ]);
  });

  it("ignores a bump the buyer did not tick", async () => {
    const seller = await createSeller(app, { amount: 10_000n });
    const bump = await bumpProduct(app, seller);
    await saveBumps(app, seller, [{ offerId: bump.offer.id, headline: "Leve as planilhas", price: "29,00" }]);

    const { payment } = await startPurchase(app, seller.checkout.slug, "sem-bump@example.com");
    expect(payment.amount).toBe(10_000n);
    expect(await app.prisma.orderItem.count()).toBe(1);
  });

  it("never trusts a bump id the checkout does not offer", async () => {
    const seller = await createSeller(app, { amount: 10_000n });
    const other = await bumpProduct(app, seller, { slug: "nao-oferecido" });
    // A oferta existe e é vendável, mas não está na versão deste checkout.
    const { payment } = await startPurchase(app, seller.checkout.slug, "espertinho@example.com", { bumpOfferIds: [other.offer.id] });
    expect(payment.amount).toBe(10_000n);
    expect(await app.prisma.orderItem.count()).toBe(1);
  });

  it("grants member-area access to the bump product too", async () => {
    const seller = await createSeller(app, { amount: 10_000n });
    const bump = await bumpProduct(app, seller);
    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: bump.product.id,
      title: "Planilhas",
      slug: "planilhas",
      description: "",
    });
    const courseModule = await app.services.courses.addModule(seller.organization.id, course.id, "Módulo 1");
    await app.services.courses.addLesson(seller.organization.id, courseModule.id, {
      title: "Planilha",
      type: "VIDEO",
      externalUrl: "https://video.example.com/a.mp4",
    });
    await app.services.courses.setPublished(seller.organization.id, seller.user.id, course.id, true);
    await saveBumps(app, seller, [{ offerId: bump.offer.id, headline: "Leve as planilhas", price: "29,00" }]);

    const { payment } = await startPurchase(app, seller.checkout.slug, "aluna@example.com", { bumpOfferIds: [bump.offer.id] });
    await confirmPayment(app, payment);

    const enrollment = await app.prisma.enrollment.findFirstOrThrow({ where: { courseId: course.id } });
    expect(enrollment.status).toBe("ACTIVE");
  });

  it("discounts the coupon off the main offer only, never off the bump", async () => {
    const seller = await createSeller(app, { amount: 10_000n });
    const bump = await bumpProduct(app, seller);
    await saveBumps(app, seller, [{ offerId: bump.offer.id, headline: "Leve as planilhas", price: "29,00" }]);
    await app.services.coupons.create(seller.organization.id, seller.user.id, {
      code: "META50",
      type: "PERCENTAGE",
      percentage: "50",
      currency: "BRL",
      oncePerCustomer: false,
      active: true,
    });

    const { result, payment } = await startPurchase(app, seller.checkout.slug, "cupom@example.com", {
      couponCode: "META50",
      bumpOfferIds: [bump.offer.id],
    });
    // 100,00 − 50% = 50,00, mais os 29,00 do bump cheios.
    expect(payment.amount).toBe(7_900n);
    const order = await app.prisma.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(order.discountAmount).toBe(5_000n);
    expect(order.subtotalAmount).toBe(12_900n);
  });

  /**
   * O bug que o bump cria se ninguém olhar: a assinatura guarda o valor que vai ser cobrado em
   * toda renovação. Somar o bump ali cobraria a planilha de novo todo mês, para sempre.
   */
  it("keeps the bump out of every renewal when the main offer is a subscription", async () => {
    const seller = await createSeller(app);
    const subscriptionOffer = await app.services.offers.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      name: "Mensal",
      price: "49,00",
      currency: "BRL",
      billingType: "SUBSCRIPTION",
      billingInterval: "MONTH",
      active: true,
    });
    const checkout = await app.services.checkouts.create(seller.organization.id, seller.user.id, {
      ...builder(seller),
      offerId: subscriptionOffer.id,
      slug: "assinatura",
      orderBumps: [],
    });
    const bump = await bumpProduct(app, seller);
    await app.services.checkouts.updateConfig(seller.organization.id, seller.user.id, checkout.id, {
      ...builder(seller),
      offerId: subscriptionOffer.id,
      slug: "assinatura",
      orderBumps: [{ offerId: bump.offer.id, headline: "Leve as planilhas", price: "29,00" }],
    });

    const { payment } = await startPurchase(app, checkout.slug, "assinante@example.com", { bumpOfferIds: [bump.offer.id] });
    // A primeira fatura cobra os dois.
    expect(payment.amount).toBe(7_800n);
    const subscription = await app.prisma.subscription.findFirstOrThrow();
    // A renovação cobra só a assinatura.
    expect(subscription.amount).toBe(4_900n);
  });

  it("drops a bump whose product stopped being sellable, keeping the checkout up", async () => {
    const seller = await createSeller(app);
    const bump = await bumpProduct(app, seller);
    await saveBumps(app, seller, [{ offerId: bump.offer.id, headline: "Leve as planilhas", price: "29,00" }]);
    await app.services.products.update(seller.organization.id, seller.user.id, bump.product.id, {
      name: bump.product.name,
      slug: bump.product.slug,
      type: "DIGITAL_PRODUCT",
      status: "ARCHIVED",
    });

    const view = await app.services.checkouts.getPublic(seller.checkout.slug);
    expect(view).not.toBeNull();
    expect(view?.orderBumps).toHaveLength(0);

    // E marcar o id mesmo assim não cobra nada a mais.
    const { payment } = await startPurchase(app, seller.checkout.slug, "tarde@example.com", { bumpOfferIds: [bump.offer.id] });
    expect(payment.amount).toBe(10_000n);
  });

  describe("refuses a bump that cannot be delivered or charged", () => {
    it("rejects a subscription offer as a bump", async () => {
      const seller = await createSeller(app);
      const bump = await bumpProduct(app, seller, { billingType: "SUBSCRIPTION" });
      await expect(saveBumps(app, seller, [{ offerId: bump.offer.id, headline: "Assine também", price: "29,00" }])).rejects.toThrow(
        /cobrança única/,
      );
    });

    it("rejects another offer of the product already being sold", async () => {
      const seller = await createSeller(app);
      const sameProduct = await app.services.offers.create(seller.organization.id, seller.user.id, {
        productId: seller.product.id,
        name: "Outra oferta do mesmo curso",
        price: "50,00",
        currency: "BRL",
        billingType: "ONE_TIME",
        active: true,
      });
      await expect(saveBumps(app, seller, [{ offerId: sameProduct.id, headline: "Leve de novo", price: "29,00" }])).rejects.toThrow(
        /outro produto/,
      );
    });

    it("rejects the same offer twice on one checkout", async () => {
      const seller = await createSeller(app);
      const bump = await bumpProduct(app, seller);
      await expect(
        saveBumps(app, seller, [
          { offerId: bump.offer.id, headline: "Leve as planilhas", price: "29,00" },
          { offerId: bump.offer.id, headline: "Leve de novo", price: "19,00" },
        ]),
      ).rejects.toThrow(/já está em outro bump/);
    });

    it("rejects a struck-through price that is not above the price charged", async () => {
      const seller = await createSeller(app);
      const bump = await bumpProduct(app, seller);
      await expect(
        saveBumps(app, seller, [{ offerId: bump.offer.id, headline: "Leve as planilhas", price: "29,00", compareAtPrice: "29,00" }]),
      ).rejects.toThrow(/preço riscado/);
    });

    it("names the offending bump by index so the form can point at the field", async () => {
      const seller = await createSeller(app);
      const good = await bumpProduct(app, seller, { slug: "boa" });
      const bad = await bumpProduct(app, seller, { slug: "ruim", billingType: "SUBSCRIPTION" });
      await expect(
        saveBumps(app, seller, [
          { offerId: good.offer.id, headline: "Primeira", price: "19,00" },
          { offerId: bad.offer.id, headline: "Segunda", price: "29,00" },
        ]),
      ).rejects.toMatchObject({ details: { field: "orderBumps.1.offerId" } });
    });

    it("rejects an offer from another organization", async () => {
      const seller = await createSeller(app, { slug: "org-a" });
      const stranger = await createSeller(app, { slug: "org-b" });
      await expect(saveBumps(app, seller, [{ offerId: stranger.offer.id, headline: "Alheia", price: "29,00" }])).rejects.toThrow();
    });
  });
});
