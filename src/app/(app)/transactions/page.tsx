"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db, type Category, type LedgerEntry, type LedgerType } from "@/lib/db";
import { deleteEntryCascade } from "@/lib/gamification";
import { dayLabel, fmtMoney } from "@/lib/format";
import { cx } from "@/components/ui";
import { ListIcon } from "@/components/icons";

type Filter = "all" | "expense" | "income" | "saved";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "expense", label: "Spent" },
  { value: "income", label: "Earned" },
  { value: "saved", label: "Saved" },
];

function matches(e: LedgerEntry, f: Filter): boolean {
  switch (f) {
    case "expense":
      return e.type === "expense";
    case "income":
      return e.type === "income";
    case "saved":
      return e.type === "setAside";
    default:
      return true;
  }
}

function matchesVisible(e: LedgerEntry, f: Filter): boolean {
  if (e.type === "rewardEarned") return false; // internal accrual rows
  return matches(e, f);
}

function glyphFor(e: LedgerEntry, cat?: Category) {
  if (cat) return { icon: cat.icon, color: cat.color };
  switch (e.type) {
    case "expense":
      return { icon: "💸", color: "#e4e4e7" };
    case "income":
      return { icon: "💵", color: "#e4e4e7" };
    case "setAside":
      return { icon: "🐷", color: "#e4e4e7" };
    case "rewardEarned":
      return { icon: "🎁", color: "#e4e4e7" };
    case "rewardSpend":
      return { icon: "🎁", color: "#e4e4e7" };
  }
}

const TYPE_WORD: Record<LedgerType, string> = {
  expense: "Expense",
  income: "Income",
  setAside: "Set aside",
  rewardEarned: "Reward earned",
  rewardSpend: "Reward",
};

export default function TransactionsPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const catById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const entries = useLiveQuery(
    () => db.ledger.orderBy("date").reverse().toArray(),
    [],
  );

  const filtered = useMemo(
    () =>
      (entries ?? [])
        .filter((e) => matchesVisible(e, filter))
        .sort(
          (a, b) =>
            a.date === b.date
              ? (b.createdAt ?? 0) - (a.createdAt ?? 0)
              : a.date < b.date
                ? 1
                : -1,
        ),
    [entries, filter],
  );

  const groups = useMemo(() => {
    const out: Array<{ date: string; rows: LedgerEntry[] }> = [];
    for (const e of filtered) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.rows.push(e);
      else out.push({ date: e.date, rows: [e] });
    }
    return out;
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <section>
        <h1 className="mb-1 text-xl font-bold">Activity</h1>
        <p className="mb-6 text-sm text-stone-500">
          Every expense, saving, and reward you log shows up here.
        </p>
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-stone-300 py-14 text-center">
          <ListIcon className="h-8 w-8 text-stone-300" />
          <div>
            <p className="font-semibold text-stone-600">Nothing here yet</p>
            <p className="mt-1 text-sm text-stone-400">
              {filter === "all"
                ? "Log your first entry to start a habit."
                : "No entries match this filter."}
            </p>
          </div>
          {filter === "all" && (
            <Link
              href="/add"
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white active:bg-emerald-700"
            >
              Add an entry
            </Link>
          )}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1 className="mb-1 text-xl font-bold">Activity</h1>
      <p className="mb-4 text-sm text-stone-500">
        Every expense, saving, and reward you log shows up here.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cx(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              filter === f.value
                ? "bg-emerald-600 text-white"
                : "bg-white text-stone-500 ring-1 ring-stone-200 active:bg-stone-50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {groups.map((g) => {
        const daySpent = g.rows.reduce(
          (sum, e) => (e.type === "expense" ? sum + e.amountCents : sum),
          0,
        );
        return (
          <div key={g.date} className="mb-4">
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wide text-stone-400">
                {dayLabel(g.date)}
              </h2>
              {daySpent > 0 && (
                <span className="text-xs font-semibold text-stone-400">
                  −{fmtMoney(daySpent)}
                </span>
              )}
            </div>
            <div className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-sm">
              {g.rows.map((e) => {
                const cat = e.categoryId ? catById.get(e.categoryId) : undefined;
                const glyph = glyphFor(e, cat);
                const title =
                  e.merchant || cat?.name || TYPE_WORD[e.type];
                const sub =
                  cat && e.merchant
                    ? cat.name
                    : e.type === "rewardSpend"
                      ? "Guilt-free spend"
                      : cat
                        ? e.type === "expense"
                          ? "Expense"
                          : "Income"
                        : e.type === "setAside"
                          ? "Savings"
                          : TYPE_WORD[e.type];
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 border-b border-stone-100 px-3 py-2.5 last:border-b-0"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg"
                      style={{ backgroundColor: `${glyph.color}26` }}
                      aria-hidden
                    >
                      {glyph.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-800">
                        {title}
                      </p>
                      <p className="truncate text-xs text-stone-400">{sub}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cx(
                          "text-sm font-bold tabular-nums",
                          e.type === "expense"
                            ? "text-rose-600"
                            : e.type === "rewardSpend"
                              ? "text-amber-600"
                              : e.type === "income"
                                ? "text-emerald-700"
                                : "text-emerald-600",
                        )}
                      >
                        {e.type === "expense" || e.type === "rewardSpend"
                          ? "−"
                          : "+"}
                        {fmtMoney(e.amountCents)}
                      </span>
                      <button
                        type="button"
                        aria-label="Delete entry"
                        onClick={() => {
                          if (window.confirm("Delete this entry?")) {
                            void deleteEntryCascade(e.id as number);
                          }
                        }}
                        className="ml-1 rounded-lg p-1.5 text-stone-300 active:bg-rose-50 active:text-rose-500"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          className="h-4 w-4"
                          aria-hidden
                        >
                          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
