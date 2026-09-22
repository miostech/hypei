import type { DbClient } from "@/lib/database/postgres/client";
import type { LedgerAccount } from "@/generated/prisma/enums";
import type {
  AccountTotalsMap,
  LedgerEntryRecord,
  LedgerJournalRecord,
  PostJournalInput,
} from "./ledger.types";

/**
 * Append-only by design: there is intentionally NO update/delete method.
 */
export interface LedgerRepository {
  findJournalByKey(idempotencyKey: string): Promise<LedgerJournalRecord | null>;
  insertJournal(input: PostJournalInput): Promise<LedgerJournalRecord>;
  totalsByAccount(organizationId: string, currency: string): Promise<AccountTotalsMap>;
  totalsByAccountForPayment(paymentId: string): Promise<AccountTotalsMap>;
  listEntries(organizationId: string, options: { currency?: string; limit: number }): Promise<LedgerEntryRecord[]>;
  totalsByJournalType(organizationId: string, currency: string): Promise<JournalTypeTotals[]>;
  listJournals(organizationId: string, currency: string, limit: number): Promise<(LedgerJournalRecord & { entries: LedgerEntryRecord[] })[]>;
  /** Global debit/credit totals — used by invariant checks and tests. */
  globalTotals(): Promise<{ debit: bigint; credit: bigint }>;
}

export interface JournalTypeTotals {
  type: string;
  account: LedgerAccount;
  direction: "DEBIT" | "CREDIT";
  amount: bigint;
}

type TotalsRow = { account: LedgerAccount; direction: "DEBIT" | "CREDIT"; _sum: { amount: bigint | null } };

function toTotalsMap(rows: TotalsRow[]): AccountTotalsMap {
  const map: AccountTotalsMap = {};
  for (const row of rows) {
    const totals = (map[row.account] ??= { debit: 0n, credit: 0n });
    if (row.direction === "DEBIT") totals.debit += row._sum.amount ?? 0n;
    else totals.credit += row._sum.amount ?? 0n;
  }
  return map;
}

export class PrismaLedgerRepository implements LedgerRepository {
  constructor(private readonly db: DbClient) {}

  findJournalByKey(idempotencyKey: string) {
    return this.db.ledgerJournal.findUnique({ where: { idempotencyKey } });
  }

  insertJournal(input: PostJournalInput) {
    return this.db.ledgerJournal.create({
      data: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
        type: input.type,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        paymentId: input.paymentId ?? null,
        currency: input.currency,
        description: input.description,
        entries: {
          create: input.lines.map((line) => ({
            organizationId: input.organizationId,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            account: line.account,
            direction: line.direction,
            amount: line.amount,
            currency: input.currency,
            description: line.description ?? input.description,
          })),
        },
      },
    });
  }

  async totalsByAccount(organizationId: string, currency: string) {
    const rows = await this.db.ledgerEntry.groupBy({
      by: ["account", "direction"],
      where: { organizationId, currency },
      _sum: { amount: true },
    });
    return toTotalsMap(rows);
  }

  async totalsByAccountForPayment(paymentId: string) {
    const rows = await this.db.ledgerEntry.groupBy({
      by: ["account", "direction"],
      where: { journal: { paymentId } },
      _sum: { amount: true },
    });
    return toTotalsMap(rows);
  }

  listEntries(organizationId: string, options: { currency?: string; limit: number }) {
    return this.db.ledgerEntry.findMany({
      where: { organizationId, ...(options.currency ? { currency: options.currency } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: options.limit,
    });
  }

  async totalsByJournalType(organizationId: string, currency: string) {
    return this.db.$queryRaw<JournalTypeTotals[]>`
      SELECT j.type, e.account, e.direction, SUM(e.amount)::bigint AS amount
      FROM "LedgerEntry" e JOIN "LedgerJournal" j ON j.id = e."journalId"
      WHERE e."organizationId" = ${organizationId} AND e.currency = ${currency}
      GROUP BY 1, 2, 3`;
  }

  listJournals(organizationId: string, currency: string, limit: number) {
    return this.db.ledgerJournal.findMany({
      where: { organizationId, currency },
      include: { entries: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
  }

  async globalTotals() {
    const rows = await this.db.ledgerEntry.groupBy({ by: ["direction"], _sum: { amount: true } });
    let debit = 0n;
    let credit = 0n;
    for (const r of rows) {
      if (r.direction === "DEBIT") debit += r._sum.amount ?? 0n;
      else credit += r._sum.amount ?? 0n;
    }
    return { debit, credit };
  }
}
