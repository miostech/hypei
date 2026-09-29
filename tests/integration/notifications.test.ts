import { beforeEach, describe, expect, it } from "vitest";
import { formatMoney, money } from "@/lib/money";
import { confirmPayment, createSeller, createTestApp, flushEvents, startPurchase, type TestApp } from "../support/test-app";

const BRL_100 = formatMoney(money(10_000n, "BRL"));

describe("Transactional e-mail", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("sends the receipt to the buyer and the sale to the producer", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "compradora@example.com");
    await confirmPayment(app, payment);

    const receipt = app.email.to("compradora@example.com");
    expect(receipt).toHaveLength(1);
    expect(receipt[0].subject).toContain("Curso Teste");
    expect(receipt[0].html).toContain(BRL_100);
    expect(receipt[0].text).toContain("Pagamento confirmado");

    const sale = app.email.withTemplate("sale.completed");
    expect(sale).toHaveLength(1);
    expect(sale[0].to).toBe(seller.organization.supportEmail);
    expect(sale[0].html).toContain("compradora@example.com");
  });

  it("links to the course when the product has one published", async () => {
    const seller = await createSeller(app);
    const course = await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Curso",
      slug: "meu-curso",
      description: "",
    });
    const courseModule = await app.services.courses.addModule(seller.organization.id, course.id, "Módulo");
    await app.services.courses.addLesson(seller.organization.id, courseModule.id, {
      title: "Aula",
      type: "VIDEO",
      externalUrl: "https://video.example.com/a.mp4",
    });
    await app.services.courses.setPublished(seller.organization.id, seller.user.id, course.id, true);

    const { payment } = await startPurchase(app, seller.checkout.slug, "aluna@example.com");
    await confirmPayment(app, payment);

    const receipt = app.email.to("aluna@example.com")[0];
    expect(receipt.html).toContain(`https://app.ripay.test/members/${seller.organization.slug}/courses/meu-curso`);
    expect(receipt.html).toContain("Acessar o conteúdo");
  });

  it("omits the access button when the course is still a draft", async () => {
    const seller = await createSeller(app);
    await app.services.courses.create(seller.organization.id, seller.user.id, {
      productId: seller.product.id,
      title: "Rascunho",
      slug: "rascunho",
      description: "",
    });

    const { payment } = await startPurchase(app, seller.checkout.slug, "curiosa@example.com");
    await confirmPayment(app, payment);

    const receipt = app.email.to("curiosa@example.com")[0];
    expect(receipt.html).not.toContain("Acessar o conteúdo");
    expect(receipt.html).toContain("próximos passos");
  });

  it("never mails the same person twice for one event", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "unica@example.com");
    await confirmPayment(app, payment);
    expect(app.email.to("unica@example.com")).toHaveLength(1);

    // At-least-once delivery: the same event reaching the bus again must be a no-op.
    const events = await app.prisma.outboxEvent.findMany({ where: { type: "payment.paid" } });
    await app.prisma.outboxEvent.updateMany({
      where: { id: { in: events.map((event) => event.id) } },
      data: { processedAt: null, status: "PENDING", attempts: 0 },
    });
    await flushEvents(app);

    expect(app.email.to("unica@example.com")).toHaveLength(1);
    const deliveries = await app.prisma.emailDelivery.findMany({ where: { recipient: "unica@example.com" } });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("SENT");
  });

  it("records a failure and delivers on the retry", async () => {
    const seller = await createSeller(app);
    app.email.failNext = true;

    const { payment } = await startPurchase(app, seller.checkout.slug, "falha@example.com");
    await confirmPayment(app, payment);

    const failed = await app.prisma.emailDelivery.findFirst({ where: { recipient: "falha@example.com" } });
    expect(failed).toMatchObject({ status: "FAILED", template: "purchase.confirmed" });
    expect(failed?.error).toContain("provider unavailable");
    expect(app.email.to("falha@example.com")).toHaveLength(0);

    // The next relay pass picks the failed event up again and the send goes through.
    await flushEvents(app);

    expect(app.email.to("falha@example.com")).toHaveLength(1);
    const retried = await app.prisma.emailDelivery.findFirst({ where: { recipient: "falha@example.com" } });
    expect(retried).toMatchObject({ status: "SENT", error: null });
  });

  it("tells the buyer when a refund is processed", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "reembolso@example.com");
    await confirmPayment(app, payment);
    app.email.clear();

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const refund = await app.services.refunds.request({
      organizationId: seller.organization.id,
      paymentId: paid.id,
      amount: paid.amount,
      reason: "Pedido da cliente",
      idempotencyKey: `refund-${paid.id}`,
      userId: seller.user.id,
    });
    await app.deliver({
      type: "refund.succeeded",
      providerRefundId: (await app.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).providerRefundId!,
      providerPaymentId: paid.providerPaymentId!,
      amount: paid.amount.toString(),
      currency: paid.currency,
    });

    const refundEmail = app.email.to("reembolso@example.com");
    expect(refundEmail).toHaveLength(1);
    expect(refundEmail[0].subject).toContain("Reembolso");
    expect(refundEmail[0].html).toContain(BRL_100);
  });
});
