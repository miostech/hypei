import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

/** Sells once and confirms the payment, returning the seller and the paid payment. */
async function paidSale(app: TestApp, options: { slug?: string; email?: string } = {}) {
  const seller = await createSeller(app, { slug: options.slug });
  const { payment } = await startPurchase(app, seller.checkout.slug, options.email ?? "compradora@example.com");
  await confirmPayment(app, payment);
  return { seller, payment: await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }) };
}

describe("Post-sale screens", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("shows the sale with its payment, refunds and disputes", async () => {
    const { seller, payment } = await paidSale(app);
    await app.services.refunds.request({
      organizationId: seller.organization.id,
      paymentId: payment.id,
      amount: 3000n,
      reason: "Aula perdida",
      idempotencyKey: "r-detail",
    });
    await app.deliver({
      type: "dispute.updated",
      providerDisputeId: "dp_detail",
      providerPaymentId: payment.providerPaymentId!,
      amount: "10000",
      currency: "BRL",
      status: "open",
    });

    const detail = await app.services.uow.repos.orders.findDetail(seller.organization.id, payment.orderId);
    expect(detail).not.toBeNull();
    expect(detail!.customer.email).toBe("compradora@example.com");
    expect(detail!.items[0].productName).toBe("Curso Teste");
    expect(detail!.payments[0].refunds).toHaveLength(1);
    expect(detail!.payments[0].refunds[0].reason).toBe("Aula perdida");
    expect(detail!.payments[0].disputes[0].status).toBe("OPEN");
  });

  it("never shows another organization's sale", async () => {
    const a = await createSeller(app, { slug: "tenant-a" });
    const { payment } = await paidSale(app, { slug: "tenant-b" });

    expect(await app.services.uow.repos.orders.findDetail(a.organization.id, payment.orderId)).toBeNull();
  });

  it("lists refunds and disputes only for the organization that owns them", async () => {
    const a = await createSeller(app, { slug: "org-a" });
    const { seller: b, payment } = await paidSale(app, { slug: "org-b", email: "cliente-b@example.com" });

    await app.services.refunds.request({
      organizationId: b.organization.id,
      paymentId: payment.id,
      amount: 2500n,
      idempotencyKey: "r-list",
    });
    await app.deliver({
      type: "dispute.updated",
      providerDisputeId: "dp_list",
      providerPaymentId: payment.providerPaymentId!,
      amount: "10000",
      currency: "BRL",
      status: "open",
    });

    const { repos } = app.services.uow;
    expect(await repos.refunds.listForOrganization(a.organization.id, 50)).toHaveLength(0);
    expect(await repos.disputes.listForOrganization(a.organization.id, 50)).toHaveLength(0);

    const refunds = await repos.refunds.listForOrganization(b.organization.id, 50);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].payment.customer.email).toBe("cliente-b@example.com");
    expect(refunds[0].payment.order.items[0].productName).toBe("Curso Teste");

    const disputes = await repos.disputes.listForOrganization(b.organization.id, 50);
    expect(disputes).toHaveLength(1);
    expect(disputes[0]).toMatchObject({ status: "OPEN", amount: 10_000n });
    expect(disputes[0].payment.orderId).toBe(payment.orderId);
  });

  it("puts open disputes before the ones already resolved", async () => {
    const { seller, payment } = await paidSale(app);
    await app.deliver({
      type: "dispute.updated",
      providerDisputeId: "dp_closed",
      providerPaymentId: payment.providerPaymentId!,
      amount: "10000",
      currency: "BRL",
      status: "open",
    });
    await app.deliver({
      type: "dispute.updated",
      providerDisputeId: "dp_closed",
      providerPaymentId: payment.providerPaymentId!,
      amount: "10000",
      currency: "BRL",
      status: "won",
    });

    const second = await startPurchase(app, seller.checkout.slug, "outra@example.com");
    await confirmPayment(app, second.payment);
    await app.deliver({
      type: "dispute.updated",
      providerDisputeId: "dp_open",
      providerPaymentId: second.payment.providerPaymentId!,
      amount: "10000",
      currency: "BRL",
      status: "open",
    });

    const disputes = await app.services.uow.repos.disputes.listForOrganization(seller.organization.id, 50);
    expect(disputes.map((dispute) => dispute.status)).toEqual(["OPEN", "WON"]);
  });
});
