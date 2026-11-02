import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

describe("Checkout", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  it("uses the official Offer price from PostgreSQL (MongoDB only configures presentation)", async () => {
    const { checkout } = await createSeller(app, { amount: 19_700n });
    const view = await app.services.checkouts.getPublic(checkout.slug);
    expect(view?.offer.amount).toBe(19_700n);
    expect(view?.config).not.toHaveProperty("amount");
    expect(view?.paymentMethods).toContain("CREDIT_CARD");
  });

  it("creates Order + Payment (CREATED → PENDING) and returns a client secret", async () => {
    const { checkout, organization } = await createSeller(app);
    const result = await app.services.checkouts.start({
      slug: checkout.slug,
      attemptId: randomUUID(),
      sessionId: "session-12345",
      name: "Ana",
      email: "ana@example.com",
      tracking: { utm_source: "instagram", utm_campaign: "launch" },
    });
    expect(result.clientSecret).toBeTruthy();
    const order = await app.prisma.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: true } });
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.organizationId).toBe(organization.id);
    expect(order.checkoutVersion).toBe(1);
    expect(order.items[0].unitAmount).toBe(10_000n);
    expect((order.tracking as Record<string, string>).utm_source).toBe("instagram");
    const payment = await app.prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    expect(payment.status).toBe("PENDING");
    expect(payment.providerPaymentId).toMatch(/^mock_pi_/);
  });

  it("is idempotent per checkout attempt (double submit ⇒ one order)", async () => {
    const { checkout } = await createSeller(app);
    const input = { slug: checkout.slug, attemptId: randomUUID(), sessionId: "session-12345", name: "Ana", email: "ana@example.com", tracking: {} };
    const a = await app.services.checkouts.start(input);
    const b = await app.services.checkouts.start(input);
    expect(b.orderId).toBe(a.orderId);
    expect(b.clientSecret).toBe(a.clientSecret);
    expect(await app.prisma.order.count()).toBe(1);
    expect(await app.prisma.payment.count()).toBe(1);
    // The client secret is never persisted in the idempotency store.
    const stored = await app.prisma.idempotencyKey.findFirstOrThrow();
    expect(JSON.stringify(stored.responseData)).not.toContain("secret");
  });

  it("versions checkout configuration; orders keep the version the buyer saw", async () => {
    const { checkout, organization, user, offer } = await createSeller(app);
    const { version } = await app.services.checkouts.updateConfig(organization.id, user.id, checkout.id, {
      offerId: offer.id,
      name: "Checkout",
      slug: checkout.slug,
      headline: "Nova headline",
      accentColor: "#111111",
      collectPhone: true,
      guaranteeDays: 30,
      enabledPaymentMethods: [],
    });
    expect(version).toBe(2);
    const view = await app.services.checkouts.getPublic(checkout.slug);
    expect(view?.config.headline).toBe("Nova headline");
    expect(view?.version).toBe(2);
  });

  it("hides checkouts of inactive offers", async () => {
    const { checkout, organization, user, offer } = await createSeller(app);
    await app.services.offers.setActive(organization.id, user.id, offer.id, false);
    expect(await app.services.checkouts.getPublic(checkout.slug)).toBeNull();
  });

  /**
   * A tela de Verificação promete ao produtor que o checkout não cobra antes de ele
   * verificar. Esta é a trava que torna a promessa verdadeira — sem ela o comprador é
   * cobrado e o dinheiro fica preso, porque o saque também é bloqueado.
   */
  it("recusa a venda enquanto o provedor não liberou cobranças", async () => {
    const { checkout, organization } = await createSeller(app);
    await app.prisma.merchantAccount.updateMany({
      where: { organizationId: organization.id },
      data: { status: "REQUIRES_ACTION", chargesEnabled: false, requirementsDue: ["individual.verification.document"] },
    });

    expect(await app.services.checkouts.getPublic(checkout.slug)).toMatchObject({ acceptsPayments: false });
    await expect(startPurchase(app, checkout.slug)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await app.prisma.order.count({ where: { organizationId: organization.id } })).toBe(0);
    expect(await app.prisma.payment.count({ where: { organizationId: organization.id } })).toBe(0);
  });
});

/** Arte que o produtor envia. O objeto continua privado: a página assina na hora de mostrar. */
describe("Imagens do produtor", () => {
  let app: TestApp;
  beforeEach(async () => {
    app = await createTestApp();
  });

  const image = { filename: "capa.png", contentType: "image/png", sizeBytes: 300_000 };

  it("autoriza o envio numa chave do próprio checkout", async () => {
    const { organization, checkout } = await createSeller(app);

    const target = await app.services.checkouts.createImageUpload(organization.id, checkout.id, image);

    expect(target.key).toBe(app.storage.uploads[0].key);
    expect(target.key.startsWith(`organizations/${organization.id}/checkouts/${checkout.id}/`)).toBe(true);
    expect(target.key.endsWith(".png")).toBe(true);
  });

  it("autoriza a capa numa chave do próprio produto", async () => {
    const { organization, product } = await createSeller(app);

    const target = await app.services.products.createThumbnailUpload(organization.id, product.id, image);

    expect(target.key).toBe(app.storage.uploads[0].key);
    expect(target.key.startsWith(`organizations/${organization.id}/products/${product.id}/`)).toBe(true);
  });

  it("recusa o que não é imagem e o que é grande demais", async () => {
    const { organization, checkout, product } = await createSeller(app);

    await expect(
      app.services.checkouts.createImageUpload(organization.id, checkout.id, { ...image, filename: "a.pdf", contentType: "application/pdf" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      app.services.checkouts.createImageUpload(organization.id, checkout.id, { ...image, sizeBytes: 9_000_000 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    // Mesma política nas duas telas: a validação é compartilhada, não copiada.
    await expect(
      app.services.products.createThumbnailUpload(organization.id, product.id, { ...image, contentType: "image/heic" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(app.storage.uploads).toHaveLength(0);
  });

  it("não deixa enviar para o checkout nem para o produto de outra organização", async () => {
    const mine = await createSeller(app);
    const theirs = await createSeller(app);

    await expect(app.services.checkouts.createImageUpload(mine.organization.id, theirs.checkout.id, image)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(app.services.products.createThumbnailUpload(mine.organization.id, theirs.product.id, image)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(app.storage.uploads).toHaveLength(0);
  });

  it("guarda banner e logo na versão da configuração e entrega assinados para a página", async () => {
    const { organization, user, checkout, offer } = await createSeller(app);
    const banner = await app.services.checkouts.createImageUpload(organization.id, checkout.id, image);
    const logo = await app.services.checkouts.createImageUpload(organization.id, checkout.id, { ...image, filename: "logo.png" });

    await app.services.checkouts.updateConfig(organization.id, user.id, checkout.id, {
      offerId: offer.id,
      name: "Checkout",
      slug: checkout.slug,
      headline: "Garanta seu acesso",
      accentColor: "#111111",
      bannerKey: banner.key,
      logoKey: logo.key,
      collectPhone: false,
      guaranteeDays: 7,
      enabledPaymentMethods: [],
    });

    const view = await app.services.checkouts.getPublic(checkout.slug);
    expect(view?.config.bannerKey).toBe(banner.key);
    expect(view?.config.logoKey).toBe(logo.key);
    expect(await app.services.checkouts.assetUrl(view!.config.bannerKey)).toContain(encodeURIComponent(banner.key));
    expect(await app.services.checkouts.assetUrl(view!.config.logoKey)).toContain(encodeURIComponent(logo.key));
    // Sem imagem não há URL: a página não deve renderizar um <img> vazio.
    expect(await app.services.checkouts.assetUrl(null)).toBeNull();
  });

  it("leva a capa do produto para o resumo do pedido", async () => {
    const { organization, user, product, checkout } = await createSeller(app);
    const target = await app.services.products.createThumbnailUpload(organization.id, product.id, image);

    await app.services.products.update(organization.id, user.id, product.id, {
      name: product.name,
      slug: product.slug,
      type: product.type,
      status: product.status,
      thumbnailKey: target.key,
    });

    // A capa é do produto, mas quem a mostra é o checkout: tem que atravessar a view pública.
    const view = await app.services.checkouts.getPublic(checkout.slug);
    expect(view?.product.thumbnailKey).toBe(target.key);
    expect(await app.services.products.thumbnailUrl(target.key)).toContain(encodeURIComponent(target.key));
    expect(await app.services.products.thumbnailUrl(null)).toBeNull();
  });
});
