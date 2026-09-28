import type { LedgerAccount, LedgerDirection } from "@/generated/prisma/enums";

/**
 * Chart of accounts. `normal` is the side that INCREASES the account.
 *
 * - PLATFORM_CASH       asset     gross funds captured through the processor
 * - PRODUCER_PENDING    liability owed to producers, still inside the settlement window
 * - PRODUCER_AVAILABLE  liability owed to producers, withdrawable
 * - PLATFORM_REVENUE    revenue   Ripay platform fees
 * - PROCESSOR_FEES      liability fees withheld/owed to the payment processor
 * - REFUNDS             expense   refund losses absorbed by the platform (non-returned processor fees)
 * - CHARGEBACKS         expense   chargeback losses absorbed by the platform
 * - RESERVES            liability producer funds held (disputes, risk)
 * - TAXES               liability taxes collected on behalf of authorities
 * - PAYOUTS             liability producer funds in transit to their bank
 */
export const ACCOUNT_NORMAL_SIDE: Record<LedgerAccount, LedgerDirection> = {
  PLATFORM_CASH: "DEBIT",
  PRODUCER_PENDING: "CREDIT",
  PRODUCER_AVAILABLE: "CREDIT",
  PLATFORM_REVENUE: "CREDIT",
  PROCESSOR_FEES: "CREDIT",
  REFUNDS: "DEBIT",
  CHARGEBACKS: "DEBIT",
  RESERVES: "CREDIT",
  TAXES: "CREDIT",
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
