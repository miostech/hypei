import { UnbalancedJournalError, ValidationError } from "@/lib/errors";
import { isSupportedCurrency } from "@/lib/money";
import type { Repositories } from "@/server/repositories";
import type { JournalLine, PostJournalInput, PostJournalResult } from "./ledger.types";

/** Anything that must be kept in sync with the ledger inside the same DB transaction. */
export interface LedgerProjection {
  refresh(repos: Repositories, organizationId: string, currency: string): Promise<void>;
}

export function assertBalanced(lines: JournalLine[]): void {
  if (lines.length < 2) throw new ValidationError("A journal needs at least two lines");
  let debits = 0n;
  let credits = 0n;
  for (const line of lines) {
    if (line.amount <= 0n) throw new ValidationError("Ledger line amounts must be positive", { account: line.account });
    if (line.direction === "DEBIT") debits += line.amount;
    else credits += line.amount;
  }
  if (debits !== credits) throw new UnbalancedJournalError(debits, credits);
}

/**
 * The ONLY entry point for money movements. Journals are:
 * - balanced (double entry: debits == credits),
 * - immutable (append-only repository),
 * - idempotent (unique idempotencyKey per logical financial event).
 *
 * Must be called with transaction-scoped repositories so the journal, the business
 * state change and the balance projection commit atomically.
 */
export class LedgerService {
  constructor(private readonly projection: LedgerProjection) {}

  async post(repos: Repositories, input: PostJournalInput): Promise<PostJournalResult> {
    if (!isSupportedCurrency(input.currency)) throw new ValidationError(`Unsupported currency ${input.currency}`);
    const lines = input.lines.filter((l) => l.amount !== 0n);
    assertBalanced(lines);

    const existing = await repos.ledger.findJournalByKey(input.idempotencyKey);
    if (existing) return { journal: existing, created: false };

    const journal = await repos.ledger.insertJournal({ ...input, lines });
    await this.projection.refresh(repos, input.organizationId, input.currency);
    return { journal, created: true };
  }
}
