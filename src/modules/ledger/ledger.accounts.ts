import type { LedgerAccount, LedgerDirection } from "@/generated/prisma/enums";

/**
 * Chart of accounts. `normal` is the side that INCREASES the account.
 *
 * - PLATFORM_CASH       asset     funds captured, já líquidos do que o adquirente reteve
 * - PRODUCER_PENDING    liability owed to producers, still inside the settlement window
 * - PRODUCER_AVAILABLE  liability owed to producers, withdrawable
 * - PLATFORM_REVENUE    revenue   Kabrun platform fees
 * - PROCESSOR_FEES      expense   o que a Kabrun pagou ao adquirente. Despesa, não passivo:
 *                       quem banca é a plataforma, com a taxa que ela cobra (ADR 011)
 * - REFUNDS             expense   custo de adquirência de venda devolvida: a taxa ficou com o
 *                       adquirente, mas a receita que a cobria foi estornada
 * - CHARGEBACKS         expense   o mesmo, para a venda perdida no chargeback
 * - RESERVES            liability producer funds held (disputes, risk)
 * - AFFILIATE_PAYABLE   liability owed to affiliates for referred sales
 * - TAXES               liability reservada para quando a plataforma for a responsável pelo
 *                       recolhimento. Hoje quem vende é o produtor (ADR 008): o imposto é
 *                       calculado e registrado no pedido, e NÃO gera lançamento aqui.
 * - PAYOUTS             liability producer funds in transit to their bank
 * - FX_CONVERSION       clearing  contrapartida da conversão de moeda: zera quando os dois
 *                       lados do câmbio são lançados, um em cada moeda
 */
export const ACCOUNT_NORMAL_SIDE: Record<LedgerAccount, LedgerDirection> = {
  PLATFORM_CASH: "DEBIT",
  PRODUCER_PENDING: "CREDIT",
  PRODUCER_AVAILABLE: "CREDIT",
  PLATFORM_REVENUE: "CREDIT",
  PROCESSOR_FEES: "DEBIT",
  REFUNDS: "DEBIT",
  CHARGEBACKS: "DEBIT",
  RESERVES: "CREDIT",
  AFFILIATE_PAYABLE: "CREDIT",
  TAXES: "CREDIT",
  FX_CONVERSION: "CREDIT",
  PAYOUTS: "CREDIT",
};

export interface AccountTotals {
  debit: bigint;
  credit: bigint;
}

/** Signed balance of an account on its normal side. */
export function accountBalance(account: LedgerAccount, totals: AccountTotals | undefined): bigint {
  if (!totals) return 0n;
  return ACCOUNT_NORMAL_SIDE[account] === "DEBIT" ? totals.debit - totals.credit : totals.credit - totals.debit;
}
