import { randomBytes } from "node:crypto";
import type { Payment } from "@/generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertSupportedCurrency } from "@/lib/money";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import type { Repositories } from "@/server/repositories";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { AffiliateInput } from "./affiliate.schemas";

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
      // Every affiliate starts with one link, otherwise they have nothing to share.
      await repos.affiliates.createLink({ affiliateId: affiliate.id, code: generateCode(), checkoutId: input.checkoutId || null });
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

  async addLink(organizationId: string, id: string, checkoutId: string | null) {
    await this.get(organizationId, id);
    return this.uow.repos.affiliates.createLink({ affiliateId: id, code: generateCode(), checkoutId });
  }

  /** Resolves a referral code to the affiliate that earns from it, if still active. */
  async resolveAttribution(organizationId: string, code: string) {
    const target = await this.uow.repos.affiliates.findLinkByCode(code.trim().toUpperCase());
    if (!target || target.organizationId !== organizationId) return null;
    return target;
  }

  registerClick(code: string) {
    return this.uow.repos.affiliates.registerClick(code.trim().toUpperCase());
  }

  /**
   * Records the commission for a captured payment and parks the money in
   * AFFILIATE_PAYABLE. Called inside the capture transaction, after the split.
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
  }

  /** Gives back part of a commission when the sale is refunded or charged back. */
  async reverseCommission(repos: Repositories, orderId: string, amount: bigint): Promise<bigint> {
    if (amount <= 0n) return 0n;
    const commission = await repos.affiliates.findCommissionByOrder(orderId);
    if (!commission || commission.status === "CANCELED") return 0n;

    const outstanding = commission.amount - commission.reversedAmount;
    const reversed = amount > outstanding ? outstanding : amount;
    if (reversed <= 0n) return 0n;

    const reversedTotal = commission.reversedAmount + reversed;
    await repos.affiliates.updateCommission(commission.id, {
      reversedAmount: reversedTotal,
      status: reversedTotal >= commission.amount ? "CANCELED" : commission.status,
    });
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
