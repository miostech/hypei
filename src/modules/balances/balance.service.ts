import { accountBalance } from "@/modules/ledger/ledger.accounts";
import type { LedgerProjection } from "@/modules/ledger/ledger.service";
import type { AccountTotalsMap } from "@/modules/ledger/ledger.types";
import type { Repositories } from "@/server/repositories";
import type { BalanceRecord } from "./balance.repository";

export interface BalanceView {
  currency: string;
  pending: bigint;
  available: bigint;
  reserved: bigint;
}

export function balanceFromTotals(currency: string, totals: AccountTotalsMap): BalanceView {
  return {
    currency,
    pending: accountBalance("PRODUCER_PENDING", totals.PRODUCER_PENDING),
    available: accountBalance("PRODUCER_AVAILABLE", totals.PRODUCER_AVAILABLE),
    reserved: accountBalance("RESERVES", totals.RESERVES),
  };
}

/**
 * Balance is a PROJECTION (cache) of the ledger per organization + currency.
 * It is always recomputed from ledger entries — never incremented/decremented directly.
 */
export class BalanceService implements LedgerProjection {
  async refresh(repos: Repositories, organizationId: string, currency: string): Promise<void> {
    const view = balanceFromTotals(currency, await repos.ledger.totalsByAccount(organizationId, currency));
    await repos.balances.save({
      organizationId,
      currency,
      pendingAmount: view.pending,
      availableAmount: view.available,
      reservedAmount: view.reserved,
    });
  }

  /** Authoritative figure straight from the ledger (used before moving money out). */
  async computeFromLedger(repos: Repositories, organizationId: string, currency: string): Promise<BalanceView> {
    return balanceFromTotals(currency, await repos.ledger.totalsByAccount(organizationId, currency));
  }

  async list(repos: Repositories, organizationId: string): Promise<BalanceRecord[]> {
    return repos.balances.listByOrganization(organizationId);
  }
}
