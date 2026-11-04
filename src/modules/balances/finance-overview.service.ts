import type { LedgerAccount, PaymentMethodType } from "@/generated/prisma/enums";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { JournalTypeTotals } from "@/modules/ledger/ledger.repository";
import { publishedPlatformFee, type PlatformFeeRule } from "@/modules/fees/fee.calculator";
import { FAST_CARD_SETTLEMENT_DAYS } from "./settlement-terms";

const PRODUCER_ACCOUNTS: LedgerAccount[] = ["PRODUCER_PENDING", "PRODUCER_AVAILABLE", "RESERVES"];

export interface FinanceSummary {
  currency: string;
  available: bigint;
  pending: bigint;
  reserved: bigint;
  grossRevenue: bigint;
  platformFees: bigint;
  processorFees: bigint;
  refunds: bigint;
  chargebacks: bigint;
}

export interface MovementRow {
  id: string;
  date: Date;
  description: string;
  /** O código cru do lançamento; quem mostra escolhe o nome, no idioma de quem lê. */
  type: string;
  /** Net effect on the producer's total (pending + available + reserved). */
  amount: bigint;
  /** Producer total right after this movement. */
  balanceAfter: bigint;
}

function sum(rows: JournalTypeTotals[], type: string, account: LedgerAccount, direction: "DEBIT" | "CREDIT") {
  return rows.filter((r) => r.type === type && r.account === account && r.direction === direction).reduce((a, r) => a + BigInt(r.amount), 0n);
}

/** As condições que valem para esta conta: o que ela paga e em quanto tempo recebe. */
export interface FinanceTerms {
  currency: string;
  platformFee: PlatformFeeRule;
  /** Dias até o dinheiro ficar disponível, por meio de pagamento. */
  settlementDays: Record<"card" | "pix" | "boleto", number>;
  /** O prazo de cartão já está no mínimo possível — não há recebimento rápido a pedir. */
  fastCardSettlement: boolean;
}

/** Read models for the producer finance pages. Everything is derived from the ledger. */
export class FinanceOverviewService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly config: { defaultSettlementDelayDays: number },
  ) {}

  async currencies(organizationId: string, fallback: string): Promise<string[]> {
    const balances = await this.uow.repos.balances.listByOrganization(organizationId);
    const set = new Set([fallback, ...balances.map((b) => b.currency)]);
    return [...set];
  }

  async summary(organizationId: string, currency: string): Promise<FinanceSummary> {
    const [balance, byType] = await Promise.all([
      this.uow.repos.balances.find(organizationId, currency),
      this.uow.repos.ledger.totalsByJournalType(organizationId, currency),
    ]);
    return {
      currency,
      available: balance?.availableAmount ?? 0n,
      pending: balance?.pendingAmount ?? 0n,
      reserved: balance?.reservedAmount ?? 0n,
      grossRevenue: sum(byType, "payment.captured", "PLATFORM_CASH", "DEBIT"),
      platformFees:
        sum(byType, "payment.captured", "PLATFORM_REVENUE", "CREDIT") -
        sum(byType, "refund.completed", "PLATFORM_REVENUE", "DEBIT") -
        sum(byType, "dispute.lost", "PLATFORM_REVENUE", "DEBIT"),
      processorFees: sum(byType, "payment.captured", "PROCESSOR_FEES", "CREDIT"),
      refunds: sum(byType, "refund.completed", "PLATFORM_CASH", "CREDIT"),
      chargebacks: sum(byType, "dispute.lost", "PLATFORM_CASH", "CREDIT"),
    };
  }

  async movements(organizationId: string, currency: string, limit = 25): Promise<MovementRow[]> {
    const [journals, balance] = await Promise.all([
      this.uow.repos.ledger.listJournals(organizationId, currency, limit),
      this.uow.repos.balances.find(organizationId, currency),
    ]);
    let running = (balance?.pendingAmount ?? 0n) + (balance?.availableAmount ?? 0n) + (balance?.reservedAmount ?? 0n);
    const rows: MovementRow[] = [];
    for (const journal of journals) {
      const net = journal.entries
        .filter((e) => PRODUCER_ACCOUNTS.includes(e.account))
        .reduce((acc, e) => acc + (e.direction === "CREDIT" ? e.amount : -e.amount), 0n);
      rows.push({
        id: journal.id,
        date: journal.createdAt,
        description: journal.description,
        type: journal.type,
        amount: net,
        balanceAfter: running,
      });
      running -= net;
    }
    return rows;
  }

  nextAvailableDate(organizationId: string, currency: string) {
    return this.uow.repos.payments.nextSettlementDate(organizationId, currency);
  }

  /**
   * Taxa e prazos desta conta, resolvidos como o checkout resolve na hora da venda.
   *
   * Lê das mesmas políticas que o pagamento usa, com a mesma precedência, para que a tela não
   * possa anunciar uma condição e o ledger cobrar outra — inclusive quando a organização tem
   * condição negociada.
   */
  async terms(organizationId: string, country: string, currency: string): Promise<FinanceTerms> {
    const scope = { organizationId, country, currency };
    const days = async (method: PaymentMethodType) =>
      (await this.uow.repos.policies.findSettlementDelayDays({ ...scope, method })) ?? this.config.defaultSettlementDelayDays;

    const [fee, card, pix, boleto] = await Promise.all([
      this.uow.repos.policies.findPlatformFeeRule(scope),
      days("CREDIT_CARD"),
      days("PIX"),
      days("BOLETO"),
    ]);

    return {
      currency,
      platformFee: fee ?? publishedPlatformFee(currency),
      settlementDays: { card, pix, boleto },
      fastCardSettlement: card <= FAST_CARD_SETTLEMENT_DAYS,
    };
  }
}
