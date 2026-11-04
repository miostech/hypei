import type { Payout } from "@/generated/prisma/client";
import type { PaymentProviderType } from "@/generated/prisma/enums";
import type { Clock } from "@/lib/clock";
import { InsufficientFundsError, NotFoundError, PayoutNotAllowedError, ValidationError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import { logger } from "@/lib/logger";
import { assertSupportedCurrency, type CurrencyCode } from "@/lib/money";
import { isMerchantAccountReadyForPayouts } from "@/lib/providers/payment/merchant-status";
import type { NormalizedProviderEvent, PaymentProvider } from "@/lib/providers/payment/types";
import type { BalanceService } from "@/modules/balances/balance.service";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import type { RiskService } from "@/modules/risk/risk.service";
import type { Repositories } from "@/server/repositories";
import type { UnitOfWork } from "@/server/unit-of-work";

type PayoutEvent = Extract<NormalizedProviderEvent, { kind: "payout.updated" }>;

export interface RequestPayoutInput {
  organizationId: string;
  amount: bigint;
  currency: string;
  /** Same key on retry ⇒ same payout (never a duplicate). */
  idempotencyKey: string;
  userId?: string | null;
}

export interface PayoutServiceConfig {
  minimumPayout: Partial<Record<CurrencyCode, bigint>>;
  /**
   * Quanto a Kabrun cobra por saque, em unidades menores da moeda. Sai do valor solicitado:
   * ela pede 100 e recebe 100 menos a taxa, para que um saque nunca possa estourar o saldo.
   */
  payoutFee: Partial<Record<CurrencyCode, bigint>>;
}

const TERMINAL: Payout["status"][] = ["PAID", "FAILED", "CANCELED"];

/**
 * Producer withdrawals. Rules enforced here:
 * - only AVAILABLE balance (never pending/reserved), computed from the ledger under a row lock;
 * - never above available, never below the minimum;
 * - merchant account must be ACTIVE with payouts enabled;
 * - idempotent per request key and per provider call;
 * - PAID only from a provider event, never optimistically.
 */
export class PayoutService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly provider: PaymentProvider,
    private readonly ledger: LedgerService,
    private readonly balances: BalanceService,
    private readonly risk: RiskService,
    private readonly clock: Clock,
    private readonly config: PayoutServiceConfig,
  ) {}

  /** A taxa desta moeda, em unidades menores. Moeda sem taxa configurada não cobra nada. */
  feeFor(currency: string): bigint {
    return this.config.payoutFee[assertSupportedCurrency(currency)] ?? 0n;
  }

  async request(input: RequestPayoutInput): Promise<Payout> {
    const currency = assertSupportedCurrency(input.currency);
    if (input.amount <= 0n) throw new ValidationError("Payout amount must be positive");
    const minimum = this.config.minimumPayout[currency] ?? 0n;
    if (input.amount < minimum) throw new PayoutNotAllowedError(`Minimum payout is ${minimum} (${currency} minor units)`);
    // Saque que não sobra nada depois da taxa é dinheiro saindo do saldo para lugar nenhum.
    const fee = this.feeFor(currency);
    if (input.amount <= fee) throw new PayoutNotAllowedError(`Payout must be above the ${fee} (${currency} minor units) fee`);

    const replay = await this.uow.repos.payouts.findByIdempotencyKey(input.idempotencyKey);
    if (replay) return replay;

    const merchant = await this.uow.repos.merchantAccounts.findByOrganization(input.organizationId, this.provider.type);
    if (!merchant) throw new PayoutNotAllowedError("No merchant account configured for payouts");
    if (!isMerchantAccountReadyForPayouts(merchant)) {
      throw new PayoutNotAllowedError("Merchant account is not verified or payouts are disabled");
    }

    const payout = await this.uow.transaction(async (repos) => {
      // Serialize concurrent money-out requests for this org+currency, THEN re-check the
      // idempotency key: a concurrent retry that committed while we waited must be returned as-is.
      await repos.balances.lock(input.organizationId, currency);
      const again = await repos.payouts.findByIdempotencyKey(input.idempotencyKey);
      if (again) return again;

      const balance = await this.balances.computeFromLedger(repos, input.organizationId, currency);
      if (input.amount > balance.available) {
        throw new InsufficientFundsError(`Requested ${input.amount} but only ${balance.available} is available`);
      }

      const decision = await this.risk.assessPayout({
        organizationId: input.organizationId,
        amount: input.amount,
        currency,
        availableAmount: balance.available,
      });
      if (decision.decision !== "allow") throw new PayoutNotAllowedError(`Payout blocked by risk review: ${decision.reason}`);

      const created = await repos.payouts.create({
        organizationId: input.organizationId,
        amount: input.amount,
        feeAmount: fee,
        currency,
        provider: this.provider.type,
        idempotencyKey: input.idempotencyKey,
        requestedById: input.userId ?? null,
      });
      await this.ledger.post(repos, {
        organizationId: input.organizationId,
        idempotencyKey: `payout:${created.id}:initiated`,
        type: "payout.initiated",
        referenceType: "Payout",
        referenceId: created.id,
        currency,
        description: "Saque solicitado",
        // Sai o valor cheio do saldo dela; só o líquido fica a caminho do banco, e a taxa
        // vira receita da plataforma na mesma hora.
        lines: [
          { account: "PRODUCER_AVAILABLE", direction: "DEBIT", amount: input.amount },
          { account: "PAYOUTS", direction: "CREDIT", amount: input.amount - fee },
          ...(fee > 0n ? [{ account: "PLATFORM_REVENUE" as const, direction: "CREDIT" as const, amount: fee }] : []),
        ],
      });
      await repos.audit.record({
        organizationId: input.organizationId,
        userId: input.userId,
        action: "payout.requested",
        entity: "Payout",
        entityId: created.id,
        metadata: { amount: input.amount, currency },
      });
      await repos.outbox.add(createDomainEvent("payout.requested", created.id, input.organizationId, { amount: input.amount, currency }));
      return created;
    });

    return this.dispatch(payout.id);
  }

  /**
   * Sends the payout to the provider. Safe to retry: the provider call uses a stable
   * idempotency key, and funds already sit in PAYOUTS (in transit) so nothing is double-spent.
   */
  async dispatch(payoutId: string): Promise<Payout> {
    const payout = await this.uow.repos.payouts.findById(payoutId);
    if (!payout) throw new NotFoundError("Payout", payoutId);
    if (payout.status !== "REQUESTED") return payout;

    const merchant = await this.uow.repos.merchantAccounts.findByOrganization(payout.organizationId, this.provider.type);
    if (!merchant) throw new PayoutNotAllowedError("No merchant account configured for payouts");

    const result = await this.provider.createPayout({
      providerAccountId: merchant.providerAccountId,
      // O banco recebe o líquido: a taxa nunca saiu da plataforma.
      amount: payout.amount - payout.feeAmount,
      currency: assertSupportedCurrency(payout.currency),
      metadata: { organizationId: payout.organizationId, payoutId: payout.id },
      idempotencyKey: `payout:${payout.id}`,
    });

    return this.uow.transaction(async (repos) => {
      const locked = await repos.payouts.lock(payout.id);
      if (locked.status !== "REQUESTED") return locked;
      return repos.payouts.update(payout.id, {
        providerPayoutId: result.providerPayoutId,
        status: "PENDING",
        processingAt: this.clock(),
      });
    });
  }

  /** Applies provider payout status updates. Terminal states are final and idempotent. */
  async applyProviderUpdate(provider: PaymentProviderType, event: PayoutEvent): Promise<"applied" | "duplicate" | "ignored"> {
    return this.uow.transaction(async (repos) => {
      const found =
        (await repos.payouts.findByProviderPayoutId(provider, event.providerPayoutId)) ??
        (event.payoutId ? await repos.payouts.findById(event.payoutId) : null);
      if (!found) {
        logger.warn({ providerPayoutId: event.providerPayoutId }, "payout event for unknown payout");
        return "ignored";
      }
      const payout = await repos.payouts.lock(found.id);
      if (TERMINAL.includes(payout.status)) return "duplicate";
      if (!payout.providerPayoutId) await repos.payouts.update(payout.id, { providerPayoutId: event.providerPayoutId });

      switch (event.status) {
        case "pending":
          return "ignored";
        case "in_transit":
          await repos.payouts.update(payout.id, { status: "PROCESSING" });
          return "applied";
        case "paid":
          await this.markPaid(repos, payout, event.occurredAt);
          return "applied";
        case "failed":
        case "canceled":
          await this.reverse(repos, payout, event.status === "failed" ? "FAILED" : "CANCELED", event.failureReason);
          return "applied";
      }
    });
  }

  private async markPaid(repos: Repositories, payout: Payout, paidAt: Date) {
    await this.ledger.post(repos, {
      organizationId: payout.organizationId,
      idempotencyKey: `payout:${payout.id}:paid`,
      type: "payout.paid",
      referenceType: "Payout",
      referenceId: payout.id,
      currency: assertSupportedCurrency(payout.currency),
      description: "Saque pago",
      lines: [
        { account: "PAYOUTS", direction: "DEBIT", amount: payout.amount - payout.feeAmount },
        { account: "PLATFORM_CASH", direction: "CREDIT", amount: payout.amount - payout.feeAmount },
      ],
    });
    await repos.payouts.update(payout.id, { status: "PAID", paidAt });
    await repos.outbox.add(createDomainEvent("payout.paid", payout.id, payout.organizationId, { amount: payout.amount, currency: payout.currency }));
  }

  /** Failed/canceled payouts return the funds to AVAILABLE through a compensating journal. */
  private async reverse(repos: Repositories, payout: Payout, status: "FAILED" | "CANCELED", reason: string | null) {
    await this.ledger.post(repos, {
      organizationId: payout.organizationId,
      idempotencyKey: `payout:${payout.id}:reversed`,
      type: "payout.reversed",
      referenceType: "Payout",
      referenceId: payout.id,
      currency: assertSupportedCurrency(payout.currency),
      description: "Saque não concluído — valor devolvido ao saldo disponível",
      // Saque que não aconteceu não cobra taxa: ela volta com o valor cheio, e a receita
      // que a plataforma tinha reconhecido é desfeita.
      lines: [
        { account: "PAYOUTS", direction: "DEBIT", amount: payout.amount - payout.feeAmount },
        ...(payout.feeAmount > 0n ? [{ account: "PLATFORM_REVENUE" as const, direction: "DEBIT" as const, amount: payout.feeAmount }] : []),
        { account: "PRODUCER_AVAILABLE", direction: "CREDIT", amount: payout.amount },
      ],
    });
    await repos.payouts.update(payout.id, { status, failedAt: this.clock(), failureReason: reason });
    await repos.outbox.add(createDomainEvent("payout.failed", payout.id, payout.organizationId, { reason }));
  }

  list(organizationId: string, limit = 50) {
    return this.uow.repos.payouts.list(organizationId, limit);
  }
}
