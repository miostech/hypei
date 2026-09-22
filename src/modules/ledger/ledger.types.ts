import type { LedgerAccount, LedgerDirection } from "@/generated/prisma/enums";
import type { CurrencyCode } from "@/lib/money";
import type { AccountTotals } from "./ledger.accounts";

export interface JournalLine {
  account: LedgerAccount;
  direction: LedgerDirection;
  /** Always positive, in minor units. The direction carries the sign. */
  amount: bigint;
  description?: string;
}

export interface PostJournalInput {
  organizationId: string;
  /** One logical financial event ⇒ one key. Re-posting the same key is a no-op. */
  idempotencyKey: string;
  type: string;
  referenceType: string;
  referenceId: string;
  paymentId?: string | null;
  currency: CurrencyCode;
  description: string;
  lines: JournalLine[];
}

export interface LedgerJournalRecord {
  id: string;
  organizationId: string;
  idempotencyKey: string;
  type: string;
  referenceType: string;
  referenceId: string;
  paymentId: string | null;
  currency: string;
  description: string;
  createdAt: Date;
}

export interface LedgerEntryRecord {
  id: string;
  journalId: string;
  organizationId: string;
  referenceType: string;
  referenceId: string;
  account: LedgerAccount;
  direction: LedgerDirection;
  amount: bigint;
  currency: string;
  description: string;
  createdAt: Date;
}

export type AccountTotalsMap = Partial<Record<LedgerAccount, AccountTotals>>;

export interface PostJournalResult {
  journal: LedgerJournalRecord;
  /** false when the idempotency key had already been posted. */
  created: boolean;
}
