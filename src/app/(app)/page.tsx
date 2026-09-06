"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Category, type LedgerEntry } from "@/lib/db";
import { entriesInMonth, totalsOf } from "@/lib/ledger";
import { dayLabel, fmtMoney, monthLabel, monthStartISO, todayISO } from "@/lib/format";
import { Card, cx } from "@/components/ui";
import { AwardIcon, GearIcon, ListIcon } from "@/components/icons";

function glyphFor(e: LedgerEntry, cat?: Category) {
  if (cat) return { icon: cat.icon, color: cat.color };
  const map: Record<LedgerEntry["type"], string> = {
    expense: "💸",
    income: "💵",
    setAside: "🐷",
    rewardSpend: "🎁",
  };
  return { icon: map[e.type], color: "#e4e4e7" };
}

export default function DashboardPage() {
  const data = useLiveQuery(async () => {
    const today = todayISO();
    const monthRows = await entriesInMonth(today);
    const recent = await db.ledger.orderBy("createdAt").reverse().limit(5).toArray();
    const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
    const t = totalsOf(monthRows);
    const spentToday = monthRows
      .filter((r) => r.type === "expense" && r.date === today)
      .reduce((sum, r) => sum + r.amountCents, 0);
    return {
      today,
      savedMonth: t.savedCents,
      spentMonth: t.spentCents,
      spentToday,
      recent,
      cats,
      hasAny: monthRows.length > 0,
    };
  }, []);

  const empty = !data;

  return (
    <section>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            {data?.today ? dayLabel(data.today) : ""}
          </p>
          <h1 className="text-xl font-bold leading-tight">Better Expense</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/badges"
            aria-label="Badges"
            className="rounded-full p-2 text-stone-400 active:bg-stone-200 active:text-stone-700"
          >
            <AwardIcon className="h-5 w-5" />
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="rounded-full p-2 text-stone-400 active:bg-stone-200 active:text-stone-700"
          >
            <GearIcon className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {data && data.hasAny && (
        <Card className="mb-3 border-0 bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
            Saved {monthLabel(monthStartISO(data.today))}
          </p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums">
            {fmtMoney(data.savedMonth)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/20 pt-3">
            <div>
              <p className="text-xs text-emerald-100">Spent this month</p>
              <p className="text-lg font-bold tabular-nums">
                {fmtMoney(data.spentMonth)}
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-100">Spent today</p>
              <p className="text-lg font-bold tabular-nums">
                {fmtMoney(data.spentToday)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {data && !data.hasAny && (
        <Card className="mb-3 border-0 bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-md">
          <p className="text-xl font-extrabold">Start a saving streak 🐷</p>
          <p className="mt-1 text-sm text-emerald-100">
            Log your spending and set money aside toward a goal. You get XP, a
            pet that grows, and a guilt-free reward budget.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/add"
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-700 active:bg-emerald-50"
            >
              Add entry
            </Link>
            <Link
              href="/goals"
              className="rounded-full border border-white/40 px-4 py-2 text-sm font-bold text-white active:bg-white/10"
            >
              Create a goal
            </Link>
          </div>
        </Card>
      )}

      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-stone-600">Recent activity</h2>
        {data && data.recent.length > 0 && (
          <Link href="/transactions" className="text-xs font-semibold text-emerald-700">
            See all
          </Link>
        )}
      </div>

      {empty || data.recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-stone-300 py-10 text-center">
          <ListIcon className="h-7 w-7 text-stone-300" />
          <p className="text-sm font-medium text-stone-500">
            Your latest entries will show up here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-sm">
          {data.recent.map((e, i) => {
            const cat = e.categoryId ? data.cats.get(e.categoryId) : undefined;
            const glyph = glyphFor(e, cat);
            const title = e.merchant || cat?.name || (e.type === "setAside" ? "Saved" : e.type);
            return (
              <Link
                key={e.id}
                href="/transactions"
                className={cx(
                  "flex items-center gap-3 px-3 py-2.5 active:bg-stone-50",
                  i < data.recent.length - 1 &&
                    "border-b border-stone-100",
                )}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                  style={{ backgroundColor: `${glyph.color}26` }}
                  aria-hidden
                >
                  {glyph.icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800">
                  {title}
                </span>
                <span
                  className={cx(
                    "text-sm font-bold tabular-nums",
                    e.type === "expense"
                      ? "text-rose-600"
                      : e.type === "setAside"
                        ? "text-emerald-600"
                        : "text-emerald-700",
                  )}
                >
                  {e.type === "expense" ? "−" : "+"}
                  {fmtMoney(e.amountCents)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
