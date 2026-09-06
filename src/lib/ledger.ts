import { db, type LedgerEntry, type LedgerType } from "./db";
import { monthStartISO, toISODate } from "./format";

export interface NewEntryInput {
  type: LedgerType;
  amountCents: number;
  date: string;
  categoryId?: string;
  goalId?: number;
  merchant?: string;
  note?: string;
}

/** Pure write: records a ledger entry. Gamification side effects live in gamification.ts. */
export async function addEntry(input: NewEntryInput): Promise<number> {
  const id = await db.ledger.add({
    ...input,
    source: "manual",
    createdAt: Date.now(),
  });
  return id;
}

export async function deleteEntry(id: number): Promise<void> {
  await db.ledger.delete(id);
}

/**
 * Half-open [startISO, endExclusive) date range query. Entries are keyed by
 * local YYYY-MM-DD so ISO strings compare chronologically.
 */
export async function entriesBetween(
  startISO: string,
  endExclusive: string,
): Promise<LedgerEntry[]> {
  return db.ledger.where("date").between(startISO, endExclusive, true, false).toArray();
}

/** All entries within the calendar month that contains `iso`. */
export function entriesInMonth(iso: string): Promise<LedgerEntry[]> {
  return entriesBetween(monthStartISO(iso), monthEndExclusive(iso));
}

function monthEndExclusive(iso: string): string {
  const d = new Date(`${monthStartISO(iso)}T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  return toISODate(d);
}

export function todayISOEntries(): Promise<LedgerEntry[]> {
  const today = toISODate();
  return entriesBetween(today, toISODate(new Date(Date.now() + 86_400_000)));
}

export interface PeriodTotals {
  spentCents: number;
  savedCents: number;
  incomeCents: number;
  rewardSpentCents: number;
}

export function totalsOf(entries: LedgerEntry[]): PeriodTotals {
  let spentCents = 0;
  let savedCents = 0;
  let incomeCents = 0;
  let rewardSpentCents = 0;
  for (const e of entries) {
    switch (e.type) {
      case "expense":
        spentCents += e.amountCents;
        break;
      case "setAside":
        savedCents += e.amountCents;
        break;
      case "income":
        incomeCents += e.amountCents;
        break;
      case "rewardSpend":
        rewardSpentCents += e.amountCents;
        break;
    }
  }
  return { spentCents, savedCents, incomeCents, rewardSpentCents };
}

export function amountSign(e: LedgerEntry): 1 | -1 {
  return e.type === "expense" || e.type === "rewardSpend" ? -1 : 1;
}

/** Optional human tag shown in list rows next to the amount. */
export function typeColor(e: LedgerEntry): string {
  switch (e.type) {
    case "expense":
      return "text-rose-600";
    case "rewardSpend":
      return "text-amber-600";
    case "income":
      return "text-emerald-700";
    case "setAside":
      return "text-emerald-600";
  }
}
