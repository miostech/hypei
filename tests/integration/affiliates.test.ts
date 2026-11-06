import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  accountTotals,
  expectAffiliateTransfersPaired,
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
    productId: seller.product.id,
  });
  const detail = await app.services.affiliates.get(seller.organization.id, affiliate.id);
  return { seller, affiliate, code: detail.affiliations[0].code };
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

  it("takes the commission out of the producer's share, never out of the Kabrun fee", async () => {
    const { seller, affiliate, code } = await sellerWithAffiliate(app);
    const { payment } = await startPurchase(app, seller.checkout.slug, "indicada@example.com", { referralCode: code });
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    // R$ 100,00: Kabrun 10%, afiliada 30% da venda. Os 400 do adquirente são despesa da
    // Kabrun, não da produtora: por isso 10000 − 1000 − 3000, e não menos 400 (ADR 011).
    expect(paid.processorFeeAmount).toBe(400n);
    expect(paid.platformFeeAmount).toBe(1000n);
    expect(paid.affiliateCommissionAmount).toBe(3000n);
    expect(paid.producerNetAmount).toBe(6000n);

    const totals = await accountTotals(app.prisma, seller.organization.id);
    expect(totals.AFFILIATE_PAYABLE).toBe(-3000n); // credit balance: owed to the affiliate
    expect(totals.PRODUCER_PENDING).toBe(-6000n);
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
    expect(paid.producerNetAmount).toBe(9000n);
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
    // A taxa da Kabrun (1000) deixa 9000 para a produtora; a comissão de 90% para exatamente aí.
    expect(paid.affiliateCommissionAmount).toBe(9000n);
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

  /**
   * A afiliação é por produto, e o order bump cobra outro produto no mesmo pedido. Antes a
   * comissão incidia sobre o pedido inteiro: quem indicou o curso ganhava também sobre a
   * planilha que o comprador levou por impulso, e que o afiliado nunca divulgou.
   */
  it("pays commission only on the affiliated product, not on a bump of another one", async () => {
    const { seller, code } = await sellerWithAffiliate(app);

    const bump = await app.services.products.create(seller.organization.id, seller.user.id, {
      name: "Planilhas",
      slug: "planilhas",
      type: "DIGITAL_PRODUCT",
      status: "ACTIVE",
    });
    const bumpOffer = await app.services.offers.create(seller.organization.id, seller.user.id, {
      productId: bump.id,
      name: "Oferta avulsa",
      price: "40,00",
      currency: "BRL",
      billingType: "ONE_TIME",
      active: true,
    });
    await app.services.checkouts.updateConfig(seller.organization.id, seller.user.id, seller.checkout.id, {
      offerId: seller.offer.id,
      name: seller.checkout.name,
      slug: seller.checkout.slug,
      headline: "Compre agora",
      accentColor: "#5B3DF5",
      collectPhone: false,
      guaranteeDays: 7,
      enabledPaymentMethods: [],
      orderBumps: [{ offerId: bumpOffer.id, headline: "Leve as planilhas", price: "40,00" }],
    });

    const { payment } = await startPurchase(app, seller.checkout.slug, "ana-compradora@example.com", {
      referralCode: code,
      bumpOfferIds: [bumpOffer.id],
    });
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    // Curso 100,00 + planilhas 40,00 = 140,00 cobrados; 30% só sobre os 100,00 do curso.
    expect(paid.amount).toBe(14_000n);
    expect(paid.affiliateCommissionAmount).toBe(3_000n);
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

/**
 * O programa aberto: o produtor habilita afiliação no produto, distribui um link de convite, e
 * quem quiser se afilia sozinha. A comissão cai na conta Kabrun que a pessoa já tem — a mesma
 * de onde ela vende os produtos dela, se vender.
 */
describe("Programa aberto de afiliados", () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  /** Produtor com afiliação habilitada no produto, e o código do convite que ele distribui. */
  async function openProgram(options: { bps?: number } = {}) {
    const producer = await createSeller(app);
    const { inviteCode } = await app.services.affiliates.enableAffiliation(
      producer.organization.id,
      producer.user.id,
      producer.product.id,
      options.bps ?? 3000,
    );
    return { producer, inviteCode };
  }

  /** Ana já vende na Kabrun: a comissão dela cai no saldo da própria organização. */
  async function anaAffiliates(inviteCode: string) {
    const ana = await createSeller(app, { slug: `ana-${randomUUID().slice(0, 6)}` });
    const accepted = await app.services.affiliates.acceptInvitation({
      code: inviteCode,
      user: ana.user,
      payeeOrganizationId: ana.organization.id,
    });
    return { ana, ...accepted };
  }

  it("o convite mostra o produto e a comissão oferecida", async () => {
    const { producer, inviteCode } = await openProgram({ bps: 4000 });
    const invitation = await app.services.affiliates.invitation(inviteCode.toLowerCase());
    expect(invitation).toMatchObject({ id: producer.product.id, affiliateCommissionBps: 4000 });
  });

  it("mantém o mesmo código de convite quando o produtor edita a comissão", async () => {
    const { producer, inviteCode } = await openProgram();
    const again = await app.services.affiliates.enableAffiliation(
      producer.organization.id,
      producer.user.id,
      producer.product.id,
      5000,
    );
    // Trocar o código a cada edição invalidaria os convites já distribuídos.
    expect(again.inviteCode).toBe(inviteCode);
  });

  it("quem aceita o convite ganha o próprio link, e aceitar de novo devolve o mesmo", async () => {
    const { inviteCode } = await openProgram();
    const { ana, affiliation } = await anaAffiliates(inviteCode);

    expect(affiliation.code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ23456789]{8}$/);
    expect(affiliation.commissionBps).toBe(3000);

    const again = await app.services.affiliates.acceptInvitation({
      code: inviteCode,
      user: ana.user,
      payeeOrganizationId: ana.organization.id,
    });
    expect(again.affiliation.id).toBe(affiliation.id);
    expect(await app.prisma.affiliation.count()).toBe(1);
  });

  it("o link do afiliado leva ao checkout ativo do produto", async () => {
    const { producer, inviteCode } = await openProgram();
    const { affiliation } = await anaAffiliates(inviteCode);

    const link = await app.services.affiliates.resolveLink(affiliation.code.toLowerCase());
    expect(link?.slug).toBe(producer.checkout.slug);
    expect(link?.target).toMatchObject({ productId: producer.product.id, commissionBps: 3000 });
  });

  it("não manda para lugar nenhum quando a afiliação foi encerrada", async () => {
    const { inviteCode } = await openProgram();
    const { affiliation } = await anaAffiliates(inviteCode);

    await app.services.uow.repos.affiliates.setAffiliationStatus(affiliation.id, "REVOKED");
    expect(await app.services.affiliates.resolveLink(affiliation.code)).toBeNull();
  });

  it("fechar o convite não derruba quem já se afiliou", async () => {
    const { producer, inviteCode } = await openProgram();
    const { affiliation } = await anaAffiliates(inviteCode);
    await app.services.affiliates.disableAffiliation(producer.organization.id, producer.user.id, producer.product.id);

    expect(await app.services.affiliates.invitation(inviteCode)).toBeNull();
    expect((await app.services.affiliates.resolveLink(affiliation.code))?.slug).toBe(producer.checkout.slug);
  });

  it("não manda para lugar nenhum quando o produtor desativou o checkout", async () => {
    const { producer, inviteCode } = await openProgram();
    const { affiliation } = await anaAffiliates(inviteCode);

    // Sem página para receber a venda o link não vale, ainda que a afiliação continue de pé.
    await app.services.uow.repos.checkouts.setStatus(producer.organization.id, producer.checkout.id, "INACTIVE");
    expect(await app.services.affiliates.resolveLink(affiliation.code)).toBeNull();
  });

  it("recusa afiliação a um produto da própria conta", async () => {
    const { producer, inviteCode } = await openProgram();
    await expect(
      app.services.affiliates.acceptInvitation({
        code: inviteCode,
        user: producer.user,
        payeeOrganizationId: producer.organization.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("a venda pelo link paga a comissão, e ela aparece na conta de quem se afiliou", async () => {
    const { producer, inviteCode } = await openProgram();
    const { ana, affiliation } = await anaAffiliates(inviteCode);

    const { payment } = await startPurchase(app, producer.checkout.slug, "indicada-pela-ana@example.com", {
      referralCode: affiliation.code,
    });
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paid.affiliateCommissionAmount).toBe(3000n);

    // O extrato da Ana é lido pela conta que recebe, não pela que paga: ela não tem acesso
    // nenhum à organização do produtor.
    const earnings = await app.services.affiliates.earningsForUser(ana.organization.id);
    expect(earnings).toHaveLength(1);
    expect(earnings[0]).toMatchObject({ amount: 3000n, status: "PENDING" });
    await expectLedgerBalanced(app.prisma);
  });

  it("lista as afiliações da pessoa com o nome de quem produz cada produto", async () => {
    const { producer, inviteCode } = await openProgram();
    const { ana, affiliation } = await anaAffiliates(inviteCode);

    const mine = await app.services.affiliates.listForUser(ana.user.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: affiliation.id, productId: producer.product.id });
    expect(mine[0].product.organization.slug).toBe(producer.organization.slug);
  });

  /**
   * A fase 2: a comissão não fica devida na conta do produtor esperando um pagamento manual.
   * Ela entra no saldo da afiliada na hora da venda e sai de lá pelo saque de sempre.
   */
  it("põe a comissão no saldo pendente da afiliada assim que a venda é aprovada", async () => {
    const { producer, inviteCode } = await openProgram();
    const { ana, affiliation } = await anaAffiliates(inviteCode);
    const { payment } = await startPurchase(app, producer.checkout.slug, "recem-comprada@example.com", {
      referralCode: affiliation.code,
    });
    await confirmPayment(app, payment);

    // Antes de qualquer liberação: o dinheiro já é dela, e já aparece — como pendente.
    const balance = await app.prisma.balance.findFirstOrThrow({ where: { organizationId: ana.organization.id, currency: "BRL" } });
    expect(balance.pendingAmount).toBe(3000n);
    expect(balance.availableAmount).toBe(0n);

    // E a dívida do produtor com ela nasce e se extingue na mesma transação da venda.
    expect((await accountTotals(app.prisma, producer.organization.id)).AFFILIATE_PAYABLE).toBe(0n);
    expect((await app.prisma.affiliateCommission.findFirstOrThrow()).status).toBe("PENDING");

    await expectAffiliateTransfersPaired(app.prisma);
    await expectLedgerBalanced(app.prisma);
  });

  it("libera a comissão para saque junto com o saldo do produtor", async () => {
    const { producer, inviteCode } = await openProgram();
    const { ana, affiliation } = await anaAffiliates(inviteCode);
    const { payment } = await startPurchase(app, producer.checkout.slug, "indicada@example.com", {
      referralCode: affiliation.code,
    });
    await confirmPayment(app, payment);

    app.clock.advanceDays(10);
    await app.services.settlements.releaseDue({ now: app.clock.now });

    const commission = await app.prisma.affiliateCommission.findFirstOrThrow();
    expect(commission.status).toBe("PAID");
    expect(commission.paidAt).not.toBeNull();

    // Na conta do produtor não sobrou dívida com ela, e o líquido dele continua sendo o dele.
    const producerTotals = await accountTotals(app.prisma, producer.organization.id);
    expect(producerTotals.AFFILIATE_PAYABLE).toBe(0n);
    expect(-producerTotals.PRODUCER_AVAILABLE).toBe(6000n);

    // E na dela o dinheiro está disponível, no mesmo saldo das vendas dela.
    expect(-(await accountTotals(app.prisma, ana.organization.id)).PRODUCER_AVAILABLE).toBe(3000n);
    const balance = await app.prisma.balance.findFirstOrThrow({ where: { organizationId: ana.organization.id, currency: "BRL" } });
    expect(balance.availableAmount).toBe(3000n);

    await expectAffiliateTransfersPaired(app.prisma);
    await expectLedgerBalanced(app.prisma);
  });

  it("deixa a afiliada sacar a comissão pelo mesmo fluxo de saque do produtor", async () => {
    const { producer, inviteCode } = await openProgram();
    const { ana, affiliation } = await anaAffiliates(inviteCode);
    const { payment } = await startPurchase(app, producer.checkout.slug, "saque@example.com", { referralCode: affiliation.code });
    await confirmPayment(app, payment);
    app.clock.advanceDays(10);
    await app.services.settlements.releaseDue({ now: app.clock.now });

    const payout = await app.services.payouts.request({
      organizationId: ana.organization.id,
      amount: 3000n,
      currency: "BRL",
      idempotencyKey: "saque-da-ana",
    });
    expect(payout.amount).toBe(3000n);

    const totals = await accountTotals(app.prisma, ana.organization.id);
    expect(totals.PRODUCER_AVAILABLE).toBe(0n);
    expect(-totals.PAYOUTS).toBe(3000n - 367n); // o banco recebe os 3000 menos a taxa de saque

    // Mais do que isso ela não tem: a comissão é o único dinheiro dela nesta conta.
    await expect(
      app.services.payouts.request({ organizationId: ana.organization.id, amount: 1000n, currency: "BRL", idempotencyKey: "a-mais" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    await expectLedgerBalanced(app.prisma);
  });

  it("tira do saldo da afiliada a comissão de uma venda estornada depois da transferência", async () => {
    const { producer, inviteCode } = await openProgram();
    const { ana, affiliation } = await anaAffiliates(inviteCode);
    const { payment } = await startPurchase(app, producer.checkout.slug, "arrependida@example.com", {
      referralCode: affiliation.code,
    });
    await confirmPayment(app, payment);
    app.clock.advanceDays(10);
    await app.services.settlements.releaseDue({ now: app.clock.now });

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const refund = await app.services.refunds.request({
      organizationId: producer.organization.id,
      paymentId: paid.id,
      amount: paid.amount,
      idempotencyKey: "estorno-pos-transferencia",
    });
    const stored = await app.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    await app.deliver({
      type: "refund.succeeded",
      providerRefundId: stored.providerRefundId!,
      providerPaymentId: paid.providerPaymentId!,
      amount: paid.amount.toString(),
      currency: paid.currency,
    });

    // A comissão volta de onde foi: do saldo dela, e não da conta de quem vendeu.
    expect(-(await accountTotals(app.prisma, ana.organization.id)).PRODUCER_AVAILABLE).toBe(0n);
    expect((await accountTotals(app.prisma, producer.organization.id)).AFFILIATE_PAYABLE).toBe(0n);
    expect(await app.prisma.affiliateCommission.findFirstOrThrow()).toMatchObject({ status: "CANCELED", reversedAmount: 3000n });

    await expectAffiliateTransfersPaired(app.prisma);
    await expectLedgerBalanced(app.prisma);
  });

  it("recusa o pagamento manual de quem já recebe pelo saldo da conta", async () => {
    const { producer, inviteCode } = await openProgram();
    const { affiliation } = await anaAffiliates(inviteCode);
    const { payment } = await startPurchase(app, producer.checkout.slug, "duplicada@example.com", { referralCode: affiliation.code });
    await confirmPayment(app, payment);
    app.clock.advanceDays(10);
    await app.services.settlements.releaseDue({ now: app.clock.now });

    // Pagar de novo seria pagar a mesma comissão duas vezes, a segunda do bolso do produtor.
    const affiliate = await app.prisma.affiliate.findFirstOrThrow();
    await expect(
      app.services.affiliates.payCommissions(producer.organization.id, producer.user.id, affiliate.id),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("tira a comissão do pendente dela quando a venda é estornada antes de liberar", async () => {
    const { producer, inviteCode } = await openProgram();
    const { ana, affiliation } = await anaAffiliates(inviteCode);
    const { payment } = await startPurchase(app, producer.checkout.slug, "desistiu@example.com", { referralCode: affiliation.code });
    await confirmPayment(app, payment);

    const paid = await app.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const refund = await app.services.refunds.request({
      organizationId: producer.organization.id,
      paymentId: paid.id,
      amount: paid.amount,
      idempotencyKey: "estorno-antes-de-liberar",
    });
    const stored = await app.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    await app.deliver({
      type: "refund.succeeded",
      providerRefundId: stored.providerRefundId!,
      providerPaymentId: paid.providerPaymentId!,
      amount: paid.amount.toString(),
      currency: paid.currency,
    });

    // Sai de onde estava — do pendente, que é onde a comissão de uma venda nova fica.
    const balance = await app.prisma.balance.findFirstOrThrow({ where: { organizationId: ana.organization.id, currency: "BRL" } });
    expect(balance.pendingAmount).toBe(0n);
    expect(balance.availableAmount).toBe(0n);
    await expectAffiliateTransfersPaired(app.prisma);
    await expectLedgerBalanced(app.prisma);
  });

  /**
   * O caminho torto: o produtor cadastrou a pessoa à mão antes de existir convite, vendeu, e
   * só depois ela abriu conta e aceitou. A comissão não pode ficar presa no meio.
   */
  it("leva para o saldo dela a comissão que o produtor ainda devia por fora", async () => {
    const { producer, inviteCode } = await openProgram();

    // Cadastro manual: sem conta na Kabrun, a comissão é dívida do produtor.
    const manual = await app.services.affiliates.create(producer.organization.id, producer.user.id, {
      name: "Ana",
      email: "ana-manual@example.com",
      commissionBps: 3000,
      active: true,
      productId: producer.product.id,
    });
    const detail = await app.services.affiliates.get(producer.organization.id, manual.id);
    const { payment } = await startPurchase(app, producer.checkout.slug, "antes-da-conta@example.com", {
      referralCode: detail.affiliations[0].code,
    });
    await confirmPayment(app, payment);
    app.clock.advanceDays(10);
    await app.services.settlements.releaseDue({ now: app.clock.now });

    expect((await app.prisma.affiliateCommission.findFirstOrThrow()).status).toBe("AVAILABLE");
    expect((await accountTotals(app.prisma, producer.organization.id)).AFFILIATE_PAYABLE).toBe(-3000n);

    // Agora ela abre a conta e aceita o convite com o mesmo e-mail.
    const ana = await createSeller(app, { slug: `ana-${randomUUID().slice(0, 6)}` });
    await app.prisma.user.update({ where: { id: ana.user.id }, data: { email: "ana-manual@example.com" } });
    await app.services.affiliates.acceptInvitation({
      code: inviteCode,
      user: { ...ana.user, email: "ana-manual@example.com" },
      payeeOrganizationId: ana.organization.id,
    });

    expect((await accountTotals(app.prisma, producer.organization.id)).AFFILIATE_PAYABLE).toBe(0n);
    expect(-(await accountTotals(app.prisma, ana.organization.id)).PRODUCER_AVAILABLE).toBe(3000n);
    expect((await app.prisma.affiliateCommission.findFirstOrThrow()).status).toBe("PAID");
    await expectAffiliateTransfersPaired(app.prisma);
    await expectLedgerBalanced(app.prisma);
  });

  it("não deixa o saldo dela negativo quando a conta é ligada só depois da venda", async () => {
    const { producer, inviteCode } = await openProgram();
    const manual = await app.services.affiliates.create(producer.organization.id, producer.user.id, {
      name: "Bia",
      email: "bia@example.com",
      commissionBps: 3000,
      active: true,
      productId: producer.product.id,
    });
    const detail = await app.services.affiliates.get(producer.organization.id, manual.id);
    const { payment } = await startPurchase(app, producer.checkout.slug, "no-meio@example.com", {
      referralCode: detail.affiliations[0].code,
    });
    await confirmPayment(app, payment);

    // A conta é ligada com a venda ainda no prazo: nada foi transferido na captura.
    const bia = await createSeller(app, { slug: `bia-${randomUUID().slice(0, 6)}` });
    await app.prisma.user.update({ where: { id: bia.user.id }, data: { email: "bia@example.com" } });
    await app.services.affiliates.acceptInvitation({
      code: inviteCode,
      user: { ...bia.user, email: "bia@example.com" },
      payeeOrganizationId: bia.organization.id,
    });

    app.clock.advanceDays(10);
    await app.services.settlements.releaseDue({ now: app.clock.now });

    // A liberação não pode debitar um pendente que nunca existiu na conta dela.
    // `?? 0n` porque conta sem lançamento nenhum naquele account não aparece no agrupamento —
    // e é justamente isso que se espera aqui: nada entrou no pendente dela, nem para baixar.
    const totals = await accountTotals(app.prisma, bia.organization.id);
    expect(totals.PRODUCER_PENDING ?? 0n).toBe(0n);
    expect(-totals.PRODUCER_AVAILABLE).toBe(3000n);
    await expectLedgerBalanced(app.prisma);
  });

  it("conta o clique no link, sem depender da venda", async () => {
    const { inviteCode } = await openProgram();
    const { affiliation } = await anaAffiliates(inviteCode);

    await app.services.affiliates.registerClick(affiliation.code.toLowerCase());
    await app.services.affiliates.registerClick(affiliation.code);
    expect((await app.prisma.affiliation.findUniqueOrThrow({ where: { id: affiliation.id } })).clicks).toBe(2);
  });
});
