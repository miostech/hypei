import { randomBytes } from "node:crypto";
import type { Payment } from "@/generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertSupportedCurrency } from "@/lib/money";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import type { Repositories } from "@/server/repositories";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { TransferableCommission } from "./affiliate.repository";
import type { AffiliateInput } from "./affiliate.schemas";
import { normalizeReferralCode } from "./referral";

/** Short, unambiguous code for referral links (no vowels: never spells a word). */
function generateCode(): string {
  const alphabet = "BCDFGHJKLMNPQRSTVWXZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

/**
 * Affiliates sell for the producer and earn a commission on each referred sale.
 *
 * The commission is taken out of the producer's share at capture time and parked in
 * AFFILIATE_PAYABLE: the producer can never withdraw money that is owed to someone
 * else. Paying the affiliate is recorded explicitly and moves it out of that account.
 */
export class AffiliateService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ledger: LedgerService,
  ) {}

  list(organizationId: string) {
    return this.uow.repos.affiliates.list(organizationId);
  }

  totals(organizationId: string) {
    return this.uow.repos.affiliates.totals(organizationId);
  }

  listCommissions(organizationId: string, limit = 100) {
    return this.uow.repos.affiliates.listCommissions(organizationId, limit);
  }

  async get(organizationId: string, id: string) {
    const affiliate = await this.uow.repos.affiliates.findById(organizationId, id);
    if (!affiliate) throw new NotFoundError("Affiliate", id);
    return affiliate;
  }

  async create(organizationId: string, userId: string, input: AffiliateInput) {
    return this.uow.transaction(async (repos) => {
      const email = input.email.toLowerCase();
      if (await repos.affiliates.findByEmail(organizationId, email)) {
        throw new ConflictError(`Já existe um afiliado com o e-mail ${email}`);
      }
      const affiliate = await repos.affiliates.create({
        organizationId,
        name: input.name,
        email,
        commissionBps: input.commissionBps,
        active: input.active,
      });
      // Sem afiliação a pessoa não tem o que divulgar. O produto escolhido manda a comissão
      // quando oferece uma; senão vale a que o produtor digitou para esta pessoa.
      if (input.productId) {
        const product = await repos.products.findById(organizationId, input.productId);
        await repos.affiliates.createAffiliation({
          productId: input.productId,
          affiliateId: affiliate.id,
          commissionBps: product?.affiliateCommissionBps ?? input.commissionBps,
          code: generateCode(),
        });
      }
      await repos.audit.record({
        organizationId,
        userId,
        action: "affiliate.created",
        entity: "Affiliate",
        entityId: affiliate.id,
        metadata: { email, commissionBps: input.commissionBps },
      });
      return affiliate;
    });
  }

  async update(organizationId: string, userId: string, id: string, input: AffiliateInput) {
    return this.uow.transaction(async (repos) => {
      const current = await repos.affiliates.findById(organizationId, id);
      if (!current) throw new NotFoundError("Affiliate", id);

      const email = input.email.toLowerCase();
      const duplicate = await repos.affiliates.findByEmail(organizationId, email);
      if (duplicate && duplicate.id !== id) throw new ConflictError(`Já existe um afiliado com o e-mail ${email}`);

      const affiliate = await repos.affiliates.update(organizationId, id, {
        name: input.name,
        email,
        commissionBps: input.commissionBps,
        active: input.active,
      });
      await repos.audit.record({ organizationId, userId, action: "affiliate.updated", entity: "Affiliate", entityId: id });
      return affiliate;
    });
  }

  async setActive(organizationId: string, userId: string, id: string, active: boolean) {
    await this.uow.transaction(async (repos) => {
      await repos.affiliates.update(organizationId, id, { active });
      await repos.audit.record({
        organizationId,
        userId,
        action: active ? "affiliate.activated" : "affiliate.deactivated",
        entity: "Affiliate",
        entityId: id,
      });
    });
  }

  /**
   * Liga afiliação no produto e devolve o código do convite.
   *
   * O código é gerado uma vez e fica: o produtor manda esse link para muita gente, e trocá-lo
   * a cada edição invalidaria convites que já estão circulando. Desligar a afiliação não o
   * apaga — só fecha a porta, e religar volta a aceitar pelo mesmo link.
   */
  async enableAffiliation(organizationId: string, userId: string, productId: string, commissionBps: number) {
    return this.uow.transaction(async (repos) => {
      const product = await repos.products.findById(organizationId, productId);
      if (!product) throw new NotFoundError("Product", productId);

      const inviteCode = product.affiliateInviteCode ?? generateCode();
      await repos.products.update(organizationId, productId, {
        affiliationEnabled: true,
        affiliateCommissionBps: commissionBps,
        affiliateInviteCode: inviteCode,
      });
      await repos.audit.record({
        organizationId,
        userId,
        action: "product.affiliation_enabled",
        entity: "Product",
        entityId: productId,
        metadata: { commissionBps },
      });
      return { inviteCode };
    });
  }

  /** Fecha o convite. As afiliações que já existem continuam valendo e vendendo. */
  async disableAffiliation(organizationId: string, userId: string, productId: string) {
    await this.uow.transaction(async (repos) => {
      await repos.products.update(organizationId, productId, { affiliationEnabled: false });
      await repos.audit.record({
        organizationId,
        userId,
        action: "product.affiliation_disabled",
        entity: "Product",
        entityId: productId,
      });
    });
  }

  /** O produto que um convite abre, para a página de confirmação mostrar o que está sendo oferecido. */
  invitation(code: string) {
    return this.uow.repos.affiliates.findProductByInviteCode(normalizeReferralCode(code));
  }

  /**
   * A pessoa aceita o convite e passa a ter o link dela para aquele produto.
   *
   * O `payeeOrganizationId` é a conta que vai receber: se ela já vende na Kabrun, a comissão
   * cai no mesmo saldo das vendas dela. Quem nunca vendeu chega aqui sem organização, e a
   * afiliação é criada sem conta de destino — o dinheiro fica devido até ela ter uma.
   *
   * Idempotente de propósito: clicar duas vezes no convite devolve a mesma afiliação, em vez
   * de criar um segundo código para a mesma pessoa no mesmo produto.
   */
  async acceptInvitation(input: { code: string; user: { id: string; name: string | null; email: string }; payeeOrganizationId: string | null }) {
    return this.uow.transaction(async (repos) => {
      const product = await repos.affiliates.findProductByInviteCode(normalizeReferralCode(input.code));
      if (!product) throw new NotFoundError("Convite", input.code);
      if (product.organizationId === input.payeeOrganizationId) {
        throw new ValidationError("Você não pode se afiliar a um produto da sua própria conta");
      }

      const email = input.user.email.toLowerCase();
      const existing =
        (await repos.affiliates.findByUser(product.organizationId, input.user.id)) ??
        (await repos.affiliates.findByEmail(product.organizationId, email));

      const affiliate =
        existing ??
        (await repos.affiliates.create({
          organizationId: product.organizationId,
          name: input.user.name ?? email,
          email,
          commissionBps: product.affiliateCommissionBps ?? 0,
          active: true,
          userId: input.user.id,
          payeeOrganizationId: input.payeeOrganizationId,
        }));

      // Cadastro manual que depois virou conta: liga os dois, senão o dinheiro não tem destino.
      if (existing && (!existing.userId || !existing.payeeOrganizationId)) {
        await repos.affiliates.update(product.organizationId, existing.id, {
          userId: existing.userId ?? input.user.id,
          payeeOrganizationId: existing.payeeOrganizationId ?? input.payeeOrganizationId,
        });
      }

      const already = await repos.affiliates.findAffiliation(product.id, affiliate.id);
      if (already) return { affiliation: already, product };

      const affiliation = await repos.affiliates.createAffiliation({
        productId: product.id,
        affiliateId: affiliate.id,
        commissionBps: product.affiliateCommissionBps ?? affiliate.commissionBps,
        code: generateCode(),
      });
      await repos.audit.record({
        organizationId: product.organizationId,
        userId: input.user.id,
        action: "affiliation.accepted",
        entity: "Affiliation",
        entityId: affiliation.id,
        metadata: { productId: product.id, commissionBps: affiliation.commissionBps },
      });
      return { affiliation, product };
    });
  }

  /** As afiliações de quem está logado, para a área dela. */
  listForUser(userId: string) {
    return this.uow.repos.affiliates.listAffiliationsForUser(userId);
  }

  earningsForUser(payeeOrganizationId: string, limit = 100) {
    return this.uow.repos.affiliates.listCommissionsForPayee(payeeOrganizationId, limit);
  }

  /**
   * O destino de um link de afiliado: a afiliação ativa e o checkout por onde a venda entra.
   *
   * O afiliado divulga um produto, não uma página — é o produtor que decide qual checkout
   * recebe a venda, e pode trocar isso sem invalidar os links já distribuídos. Sem checkout
   * ativo não há para onde mandar: o link não vale, mesmo com a afiliação de pé.
   */
  async resolveLink(code: string) {
    const target = await this.uow.repos.affiliates.findAffiliationByCode(normalizeReferralCode(code));
    if (!target) return null;
    const slug = await this.uow.repos.checkouts.findActiveSlugByProduct(target.productId);
    if (!slug) return null;
    return { target, slug };
  }

  /** Resolves a referral code to the affiliate that earns from it, if still active. */
  async resolveAttribution(organizationId: string, code: string) {
    const target = await this.uow.repos.affiliates.findAffiliationByCode(normalizeReferralCode(code));
    if (!target || target.organizationId !== organizationId) return null;
    return target;
  }

  registerClick(code: string) {
    return this.uow.repos.affiliates.registerClick(normalizeReferralCode(code));
  }

  /**
   * Registra a comissão da venda aprovada e passa o dinheiro para a conta de quem indicou.
   *
   * Entra no saldo PENDENTE dela, não no disponível: a venda acabou de ser aprovada e ainda
   * corre o prazo de liberação, o mesmo que vale para o produtor. Ela vê o valor no saldo
   * desde o primeiro minuto, com a data em que ele libera — e não um nada que vira dinheiro
   * duas semanas depois.
   *
   * Quem não tem conta na Kabrun fica com a comissão parada em AFFILIATE_PAYABLE na conta de
   * quem vendeu, para o produtor pagar por fora.
   */
  async recordCommission(
    repos: Repositories,
    payment: Payment,
    input: { affiliateId: string; orderId: string; amount: bigint },
  ): Promise<void> {
    if (input.amount <= 0n) return;
    const existing = await repos.affiliates.findCommissionByOrder(input.orderId);
    if (existing) return;

    await repos.affiliates.createCommission({
      organizationId: payment.organizationId,
      affiliateId: input.affiliateId,
      orderId: input.orderId,
      amount: input.amount,
      currency: payment.currency,
      status: "PENDING",
    });

    const commission = await repos.affiliates.findCommissionWithPayee(input.orderId);
    if (commission) await this.transferToPayee(repos, commission, "PRODUCER_PENDING");
  }

  /**
   * Passa a comissão da conta de quem vendeu para a conta de quem indicou.
   *
   * Dois lançamentos espelhados, um em cada organização, amarrados pelo id da comissão: o
   * dinheiro não sai da Kabrun, só muda de dono. Na conta do produtor a dívida com o afiliado
   * se extingue e o caixa atribuído a ela diminui; na conta dele o caixa entra e vira saldo.
   *
   * Dois lançamentos e não um porque cada um fecha em si: o `post` exige débito igual a
   * crédito, e um lançamento só nunca poderia pertencer a duas organizações.
   */
  private async transferToPayee(
    repos: Repositories,
    commission: TransferableCommission,
    account: "PRODUCER_PENDING" | "PRODUCER_AVAILABLE",
  ): Promise<bigint> {
    const payee = commission.affiliate.payeeOrganizationId;
    const net = commission.amount - commission.reversedAmount;
    if (!payee || net <= 0n) return 0n;

    const currency = assertSupportedCurrency(commission.currency);
    await this.ledger.post(repos, {
      organizationId: commission.organizationId,
      idempotencyKey: `affiliate-commission:${commission.id}:out`,
      type: "affiliate.commission.transferred",
      referenceType: "AffiliateCommission",
      referenceId: commission.id,
      currency,
      description: `Comissão transferida para ${commission.affiliate.name}`,
      lines: [
        { account: "AFFILIATE_PAYABLE", direction: "DEBIT", amount: net, description: "Baixa da comissão devida" },
        { account: "PLATFORM_CASH", direction: "CREDIT", amount: net, description: "Caixa transferido à conta do afiliado" },
      ],
    });
    await this.ledger.post(repos, {
      organizationId: payee,
      idempotencyKey: `affiliate-commission:${commission.id}:in`,
      type: "affiliate.commission.received",
      referenceType: "AffiliateCommission",
      referenceId: commission.id,
      currency,
      description: "Comissão de afiliado recebida",
      lines: [
        { account: "PLATFORM_CASH", direction: "DEBIT", amount: net, description: "Caixa recebido da conta do produtor" },
        { account, direction: "CREDIT", amount: net, description: "Comissão de venda indicada" },
      ],
    });
    return net;
  }

  /**
   * Libera para saque a comissão que já está no saldo dela.
   *
   * Aqui o dinheiro não muda de conta — ele já é dela desde a venda: só sai do pendente para o
   * disponível, exatamente como o saldo do produtor sai quando o prazo fecha. Por isso um
   * lançamento só, dentro da organização dela.
   */
  async releaseSettledCommissions(repos: Repositories, orderId: string, now: Date): Promise<bigint> {
    const commissions = await repos.affiliates.listTransferableByOrder(orderId);
    let released = 0n;

    for (const commission of commissions) {
      const payee = commission.affiliate.payeeOrganizationId;
      const net = commission.amount - commission.reversedAmount;
      if (!payee || net <= 0n) continue;

      await this.ledger.post(repos, {
        organizationId: payee,
        idempotencyKey: `affiliate-commission:${commission.id}:released`,
        type: "affiliate.commission.released",
        referenceType: "AffiliateCommission",
        referenceId: commission.id,
        currency: assertSupportedCurrency(commission.currency),
        description: "Comissão liberada para saque",
        lines: [
          { account: "PRODUCER_PENDING", direction: "DEBIT", amount: net },
          { account: "PRODUCER_AVAILABLE", direction: "CREDIT", amount: net },
        ],
      });

      // PAID porque, para quem tem conta aqui, a Kabrun já entregou: o dinheiro está no saldo
      // dela, sacável. O que fica AVAILABLE é a comissão de quem o produtor ainda vai pagar.
      await repos.affiliates.updateCommission(commission.id, { status: "PAID", paidAt: now });
      released += net;
    }
    return released;
  }

  /** Gives back part of a commission when the sale is refunded or charged back. */
  async reverseCommission(repos: Repositories, orderId: string, amount: bigint): Promise<bigint> {
    if (amount <= 0n) return 0n;
    const commission = await repos.affiliates.findCommissionWithPayee(orderId);
    if (!commission || commission.status === "CANCELED") return 0n;

    const outstanding = commission.amount - commission.reversedAmount;
    const reversed = amount > outstanding ? outstanding : amount;
    if (reversed <= 0n) return 0n;

    const reversedTotal = commission.reversedAmount + reversed;
    await repos.affiliates.updateCommission(commission.id, {
      reversedAmount: reversedTotal,
      status: reversedTotal >= commission.amount ? "CANCELED" : commission.status,
    });

    // Comissão que está na conta do afiliado volta de lá, não da do produtor.
    //
    // Quem reembolsa debita AFFILIATE_PAYABLE na conta de quem vendeu, e depois da
    // transferência essa dívida não existe mais ali — debitá-la sem isto deixaria a conta do
    // produtor devendo um valor negativo a um afiliado que ficou com o dinheiro.
    //
    // Sai do mesmo lugar onde o dinheiro está: do pendente enquanto a venda não liberou, do
    // disponível depois. Se ele já sacou, o disponível fica negativo, e fica: é o preço de
    // receber antes de a venda ser definitiva, e a próxima comissão cobre. O saque lê o saldo
    // do ledger antes de pagar, então nada sai no vermelho.
    const payee = commission.affiliate.payeeOrganizationId;
    if (payee) {
      const account = commission.status === "PENDING" ? "PRODUCER_PENDING" : "PRODUCER_AVAILABLE";
      const currency = assertSupportedCurrency(commission.currency);
      await this.ledger.post(repos, {
        organizationId: payee,
        idempotencyKey: `affiliate-commission:${commission.id}:clawback:${reversedTotal}:out`,
        type: "affiliate.commission.returned",
        referenceType: "AffiliateCommission",
        referenceId: commission.id,
        currency,
        description: "Comissão devolvida — venda estornada",
        lines: [
          { account, direction: "DEBIT", amount: reversed, description: "Baixa da comissão estornada" },
          { account: "PLATFORM_CASH", direction: "CREDIT", amount: reversed, description: "Caixa devolvido à conta do produtor" },
        ],
      });
      await this.ledger.post(repos, {
        organizationId: commission.organizationId,
        idempotencyKey: `affiliate-commission:${commission.id}:clawback:${reversedTotal}:in`,
        type: "affiliate.commission.reclaimed",
        referenceType: "AffiliateCommission",
        referenceId: commission.id,
        currency,
        description: `Comissão retomada de ${commission.affiliate.name}`,
        lines: [
          { account: "PLATFORM_CASH", direction: "DEBIT", amount: reversed, description: "Caixa recebido de volta" },
          { account: "AFFILIATE_PAYABLE", direction: "CREDIT", amount: reversed, description: "Comissão devida outra vez, para o estorno baixar" },
        ],
      });
    }
    return reversed;
  }

  /**
   * Marks everything currently payable to an affiliate as paid, moving the money
   * out of AFFILIATE_PAYABLE. The transfer itself happens outside the platform
   * for now, so this is the record that it left.
   */
  async payCommissions(organizationId: string, userId: string, affiliateId: string) {
    return this.uow.transaction(async (repos) => {
      const affiliate = await repos.affiliates.findById(organizationId, affiliateId);
      if (!affiliate) throw new NotFoundError("Affiliate", affiliateId);
      // Quem tem conta na Kabrun já recebeu: a comissão caiu no saldo dele na hora da venda.
      // Sem isto o produtor pagaria a mesma comissão duas vezes, e a segunda do bolso dele.
      if (affiliate.payeeOrganizationId) {
        throw new ValidationError("Esta pessoa recebe pelo saldo da conta Kabrun dela, não por fora");
      }

      const payable = await repos.affiliates.listPayable(organizationId, affiliateId);
      const total = payable.reduce((sum, row) => sum + (row.amount - row.reversedAmount), 0n);
      if (total <= 0n) throw new ValidationError("Não há comissão disponível para pagar");

      const currency = assertSupportedCurrency(payable[0].currency);
      const paidAt = new Date();
      for (const commission of payable) {
        await repos.affiliates.updateCommission(commission.id, { status: "PAID", paidAt });
      }

      await this.ledger.post(repos, {
        organizationId,
        idempotencyKey: `affiliate-payout:${affiliateId}:${paidAt.getTime()}`,
        type: "affiliate.paid",
        referenceType: "Affiliate",
        referenceId: affiliateId,
        currency,
        description: `Comissões pagas a ${affiliate.name}`,
        lines: [
          { account: "AFFILIATE_PAYABLE", direction: "DEBIT", amount: total, description: "Baixa da comissão devida" },
          { account: "PAYOUTS", direction: "CREDIT", amount: total, description: "Comissão enviada ao afiliado" },
        ],
      });

      await repos.audit.record({
        organizationId,
        userId,
        action: "affiliate.commissions_paid",
        entity: "Affiliate",
        entityId: affiliateId,
        metadata: { total: total.toString(), commissions: payable.length },
      });
      return { total, count: payable.length };
    });
  }
}
