import type { Payout } from "@/generated/prisma/client";
import type { PaymentProviderType } from "@/generated/prisma/enums";
import type { Clock } from "@/lib/clock";
import { InsufficientFundsError, NotFoundError, PayoutNotAllowedError, ValidationError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import { logger } from "@/lib/logger";
import { assertSupportedCurrency, convertMoney, money, type CurrencyCode } from "@/lib/money";
import type { ExchangeRateProvider, ExchangeRateQuote } from "@/lib/providers/exchange";
import { isMerchantAccountReadyForPayouts } from "@/lib/providers/payment/merchant-status";
import type { NormalizedProviderEvent, PaymentProvider } from "@/lib/providers/payment/types";
import type { BalanceService } from "@/modules/balances/balance.service";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import type { RiskService } from "@/modules/risk/risk.service";
import { paysWithPix } from "./payout-destination.service";
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
 * - merchant account must be ACTIVE with payouts enabled, and, no Brasil, com chave Pix;
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
    private readonly rates: ExchangeRateProvider,
    private readonly clock: Clock,
    private readonly config: PayoutServiceConfig,
  ) {}

  /**
   * A cotação que converte este saldo no dinheiro que cai na conta — nula quando não há o que
   * converter. Pública porque a tela mostra o valor estimado antes de a produtora confirmar.
   */
  async quoteFor(from: string, to: string): Promise<ExchangeRateQuote | null> {
    const source = assertSupportedCurrency(from);
    const target = assertSupportedCurrency(to);
    return source === target ? null : this.rates.quote(source, target);
  }

  /** A taxa desta moeda, em unidades menores. Moeda sem taxa configurada não cobra nada. */
  feeFor(currency: string): bigint {
    return this.config.payoutFee[assertSupportedCurrency(currency)] ?? 0n;
  }

  /**
   * O destino do saque, ou `null` quando é a própria conta conectada do provedor. Lança
   * quando o país paga por Pix e a chave ainda não foi cadastrada: um saque sem destino sai
   * do saldo dela e não chega em lugar nenhum.
   */
  private async destinationFor(organizationId: string, country: string) {
    if (!paysWithPix(country)) return null;
    const destination = await this.uow.repos.payoutDestinations.findPix(organizationId);
    if (!destination) throw new PayoutNotAllowedError("No Pix key configured for payouts");
    return destination;
  }

  async request(input: RequestPayoutInput): Promise<Payout> {
    // A moeda do saldo de onde o dinheiro sai — que não é necessariamente a que entra na conta.
    const source = assertSupportedCurrency(input.currency);
    if (input.amount <= 0n) throw new ValidationError("Payout amount must be positive");

    const replay = await this.uow.repos.payouts.findByIdempotencyKey(input.idempotencyKey);
    if (replay) return replay;

    const merchant = await this.uow.repos.merchantAccounts.findByOrganization(input.organizationId, this.provider.type);
    if (!merchant) throw new PayoutNotAllowedError("No merchant account configured for payouts");
    if (!isMerchantAccountReadyForPayouts(merchant)) {
      throw new PayoutNotAllowedError("Merchant account is not verified or payouts are disabled");
    }

    // Fora do Brasil o provedor paga na conta bancária que a produtora cadastrou com ele. No
    // Brasil quem paga é a Kabrun, por Pix, e sem a chave não existe para onde mandar.
    const destination = await this.destinationFor(input.organizationId, merchant.country);

    // A produtora recebe sempre na moeda da conta dela: um saldo em dólar é convertido aqui,
    // pela cotação do momento do saque, e é esse valor convertido que vira a transferência.
    const currency = assertSupportedCurrency(merchant.defaultCurrency);
    const quote = await this.quoteFor(source, currency);
    const amount = quote ? convertMoney(money(input.amount, source), quote.rate, currency).amount : input.amount;

    // Mínimo e taxa valem sobre o que sai de fato para o banco, não sobre o saldo de origem:
    // é esse valor que precisa ser grande o bastante para a transferência fazer sentido.
    const minimum = this.config.minimumPayout[currency] ?? 0n;
    if (amount < minimum) throw new PayoutNotAllowedError(`Minimum payout is ${minimum} (${currency} minor units)`);
    // Saque que não sobra nada depois da taxa é dinheiro saindo do saldo para lugar nenhum.
    const fee = this.feeFor(currency);
    if (amount <= fee) throw new PayoutNotAllowedError(`Payout must be above the ${fee} (${currency} minor units) fee`);

    const payout = await this.uow.transaction(async (repos) => {
      // Serialize concurrent money-out requests for this org+currency, THEN re-check the
      // idempotency key: a concurrent retry that committed while we waited must be returned as-is.
      // Com conversão são dois saldos, travados sempre na mesma ordem para não haver deadlock.
      for (const code of [...new Set([source, currency])].sort()) {
        await repos.balances.lock(input.organizationId, code);
      }
      const again = await repos.payouts.findByIdempotencyKey(input.idempotencyKey);
      if (again) return again;

      const balance = await this.balances.computeFromLedger(repos, input.organizationId, source);
      if (input.amount > balance.available) {
        throw new InsufficientFundsError(`Requested ${input.amount} but only ${balance.available} is available`);
      }

      const decision = await this.risk.assessPayout({
        organizationId: input.organizationId,
        amount: input.amount,
        currency: source,
        availableAmount: balance.available,
      });
      if (decision.decision !== "allow") throw new PayoutNotAllowedError(`Payout blocked by risk review: ${decision.reason}`);

      const created = await repos.payouts.create({
        organizationId: input.organizationId,
        amount,
        feeAmount: fee,
        currency,
        provider: this.provider.type,
        destinationId: destination?.id ?? null,
        idempotencyKey: input.idempotencyKey,
        requestedById: input.userId ?? null,
        ...(quote
          ? {
              sourceAmount: input.amount,
              sourceCurrency: source,
              exchangeRate: quote.rate,
              exchangeRateSource: quote.source,
            }
          : {}),
      });

      // A conversão é um par de lançamentos, um em cada moeda, porque um lançamento fecha
      // numa moeda só: o saldo de origem sai para a conta de câmbio, e dela entra o
      // convertido no saldo da moeda da conta. A cotação usada fica congelada no saque.
      if (quote) {
        await this.ledger.post(repos, {
          organizationId: input.organizationId,
          idempotencyKey: `payout:${created.id}:fx:out`,
          type: "fx.converted",
          referenceType: "Payout",
          referenceId: created.id,
          currency: source,
          description: `Convertido para ${currency}`,
          lines: [
            { account: "PRODUCER_AVAILABLE", direction: "DEBIT", amount: input.amount },
            { account: "FX_CONVERSION", direction: "CREDIT", amount: input.amount },
          ],
        });
        await this.ledger.post(repos, {
          organizationId: input.organizationId,
          idempotencyKey: `payout:${created.id}:fx:in`,
          type: "fx.converted",
          referenceType: "Payout",
          referenceId: created.id,
          currency,
          description: `Convertido de ${source}`,
          lines: [
            { account: "FX_CONVERSION", direction: "DEBIT", amount },
            { account: "PRODUCER_AVAILABLE", direction: "CREDIT", amount },
          ],
        });
      }

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
          { account: "PRODUCER_AVAILABLE", direction: "DEBIT", amount },
          { account: "PAYOUTS", direction: "CREDIT", amount: amount - fee },
          ...(fee > 0n ? [{ account: "PLATFORM_REVENUE" as const, direction: "CREDIT" as const, amount: fee }] : []),
        ],
      });
      await repos.audit.record({
        organizationId: input.organizationId,
        userId: input.userId,
        action: "payout.requested",
        entity: "Payout",
        entityId: created.id,
        metadata: { amount, currency, ...(quote ? { sourceAmount: input.amount, sourceCurrency: source, rate: quote.rate } : {}) },
      });
      await repos.outbox.add(createDomainEvent("payout.requested", created.id, input.organizationId, { amount, currency }));
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

    // O destino congelado no saque, não o cadastrado agora: trocar a chave depois de pedir o
    // saque não muda para onde aquele dinheiro foi.
    const destination = await this.uow.repos.payoutDestinations.findById(payout.destinationId);

    const result = await this.provider.createPayout({
      providerAccountId: merchant.providerAccountId,
      // O banco recebe o líquido: a taxa nunca saiu da plataforma.
      amount: payout.amount - payout.feeAmount,
      currency: assertSupportedCurrency(payout.currency),
      ...(destination?.pixKeyType && destination.pixKey
        ? { destination: { type: "PIX" as const, keyType: destination.pixKeyType, key: destination.pixKey } }
        : {}),
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

  /**
   * Failed/canceled payouts return the funds to AVAILABLE through a compensating journal.
   *
   * O dinheiro volta na moeda da conta, não na de origem: a conversão já aconteceu e desfazê-la
   * exigiria uma segunda cotação, que é outro preço e outro dia. Quem sacou dólar e teve a
   * transferência recusada recebe de volta o real que a conversão gerou.
   */
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
