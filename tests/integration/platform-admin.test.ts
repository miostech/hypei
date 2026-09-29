import { beforeEach, describe, expect, it } from "vitest";
import { confirmPayment, createSeller, createTestApp, startPurchase, type TestApp } from "../support/test-app";

describe("Platform admin", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("reports volume and platform revenue across every organization", async () => {
    const a = await createSeller(app, { slug: "org-a" });
    const b = await createSeller(app, { slug: "org-b" });
    for (const seller of [a, b]) {
      const { payment } = await startPurchase(app, seller.checkout.slug, `cliente-${seller.organization.slug}@example.com`);
      await confirmPayment(app, payment);
    }

    const overview = await app.services.platformAdmin.overview();
    expect(overview.organizations.total).toBe(2);
    expect(overview.volume[0]).toMatchObject({ currency: "BRL", total: 20_000n, count: 2 });
    // 10% of each R$ 100,00 sale.
    expect(overview.revenue[0]).toMatchObject({ currency: "BRL", net: 2000n });
    expect(overview.processorFees[0]?.net).toBe(800n);
  });

  it("discounts a refund from the platform revenue it reports", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "devolvida@example.com");
    await confirmPayment(app, payment);
    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });

    const refund = await app.services.refunds.request({
      organizationId: seller.organization.id,
      paymentId: paid.id,
      amount: paid.amount,
      idempotencyKey: "r-admin",
    });
    const stored = await app.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    await app.deliver({
      type: "refund.succeeded",
      providerRefundId: stored.providerRefundId!,
      providerPaymentId: paid.providerPaymentId!,
      amount: paid.amount.toString(),
      currency: paid.currency,
    });

    // The fee was given back, so the platform kept nothing.
    expect((await app.services.platformAdmin.overview()).revenue[0]?.net ?? 0n).toBe(0n);
  });

  it("lists organizations with their verification and payout state", async () => {
    const seller = await createSeller(app);
    await app.prisma.merchantAccount.updateMany({
      where: { organizationId: seller.organization.id },
      data: { payoutsEnabled: false, requirementsDue: ["external_account"] },
    });
    await app.prisma.organizationVerification.updateMany({
      where: { organizationId: seller.organization.id },
      data: { status: "REQUIRES_ACTION" },
    });

    const [organization] = await app.services.platformAdmin.listOrganizations();
    expect(organization).toMatchObject({
      name: seller.organization.name,
      payoutsEnabled: false,
      verificationStatus: "REQUIRES_ACTION",
      products: 1,
    });
  });

  it("finds an organization by name and ignores the ones that do not match", async () => {
    await createSeller(app, { slug: "estudio-aurora" });
    await createSeller(app, { slug: "loja-do-joao" });

    const found = await app.services.platformAdmin.listOrganizations("aurora");
    expect(found).toHaveLength(1);
    expect(found[0].slug).toBe("estudio-aurora");
  });

  it("searches payments by customer e-mail and by provider id", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "procurada@example.com");
    await confirmPayment(app, payment);
    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });

    expect(await app.services.platformAdmin.searchPayments("procurada@example.com")).toHaveLength(1);
    expect(await app.services.platformAdmin.searchPayments(paid.providerPaymentId!)).toHaveLength(1);
    expect(await app.services.platformAdmin.searchPayments("ninguem@example.com")).toHaveLength(0);

    const [row] = await app.services.platformAdmin.searchPayments("procurada@example.com");
    expect(row).toMatchObject({ organizationName: seller.organization.name, status: "PAID", amount: 10_000n });
  });

  it("opens an organization with balances, team and recent payments", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "detalhe@example.com");
    await confirmPayment(app, payment);

    const detail = await app.services.platformAdmin.organization(seller.organization.id);
    expect(detail.members[0]).toMatchObject({ email: seller.user.email, role: "OWNER" });
    expect(detail.taxIdentities[0].type).toBe("CPF");
    expect(detail.balances[0]).toMatchObject({ currency: "BRL", pending: 8600n });
    expect(detail.recentPayments[0]).toMatchObject({ customerEmail: "detalhe@example.com", status: "PAID" });
  });

  it("refuses to open an organization that does not exist", async () => {
    await expect(app.services.platformAdmin.organization("nao-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("counts open disputes and pending verifications for the work queue", async () => {
    const seller = await createSeller(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "contestou@example.com");
    await confirmPayment(app, payment);
    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });

    await app.deliver({
      type: "dispute.updated",
      providerDisputeId: "dp_admin",
      providerPaymentId: paid.providerPaymentId!,
      amount: paid.amount.toString(),
      currency: paid.currency,
      status: "open",
    });
    await app.prisma.organizationVerification.updateMany({ data: { status: "PENDING" } });

    const overview = await app.services.platformAdmin.overview();
    expect(overview.openDisputes).toBe(1);
    expect(overview.verificationPending).toBe(1);
    expect(await app.services.platformAdmin.listDisputes()).toHaveLength(1);
  });
});
