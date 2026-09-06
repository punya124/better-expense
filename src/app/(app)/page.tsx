"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getSettings, type Category, type LedgerEntry } from "@/lib/db";
import { totalsOf } from "@/lib/ledger";
import { levelInfo, PET_STAGES, petStageForXp, gatherMetrics } from "@/lib/gamification";
import { dayLabel, fmtMoney, monthLabel, monthStartISO, todayISO } from "@/lib/format";
import { Card, cx } from "@/components/ui";
import { AwardIcon, GearIcon } from "@/components/icons";

function glyphFor(e: LedgerEntry, cat?: Category) {
  if (cat) return { icon: cat.icon, color: cat.color };
  const map: Record<LedgerEntry["type"], string> = {
    expense: "💸",
    income: "💵",
    setAside: "🐷",
    rewardEarned: "🎁",
    rewardSpend: "🎁",
  };
  return { icon: map[e.type], color: "#e4e4e7" };
}

export default function DashboardPage() {
  const stats = useLiveQuery(async () => {
    const today = todayISO();
    const monthStart = monthStartISO(today);
    const [ledger, categories, streaks, xpLog, goals, settings] = await Promise.all([
      db.ledger.toArray(),
      db.categories.toArray(),
      db.streaks.toArray(),
      db.xpLog.toArray(),
      db.goals.toArray(),
      getSettings(),
    ]);
    const xpTotal = xpLog.reduce((s, x) => s + x.amount, 0);
    const m = gatherMetrics(
      ledger,
      categories,
      streaks.map(({ key, count, lastDate }) => ({ key, count, lastDate })),
      xpTotal,
      goals,
      today,
    );
    const monthRows = ledger.filter((e) => e.date >= monthStart);
    const t = totalsOf(monthRows);
    const spentToday = monthRows
      .filter((r) => r.type === "expense" && r.date === today)
      .reduce((sum, r) => sum + r.amountCents, 0);
    const cats = new Map(categories.map((c) => [c.id, c]));
    const recent = ledger
      .filter((e) => e.type !== "rewardEarned")
      .sort(
        (a, b) =>
          a.date === b.date
            ? (b.createdAt ?? 0) - (a.createdAt ?? 0)
            : a.date < b.date
              ? 1
              : -1,
      )
      .slice(0, 5);
    const reward = ledger.reduce(
      (acc, e) => {
        if (e.type === "rewardEarned") acc.earned += e.amountCents;
        if (e.type === "rewardSpend") acc.spent += e.amountCents;
        return acc;
      },
      { earned: 0, spent: 0 },
    );
    return {
      today,
      monthStart,
      monthRows,
      spentToday,
      spentMonth: t.spentCents,
      savedMonth: t.savedCents,
      recent,
      cats,
      m,
      xpTotal,
      level: levelInfo(xpTotal),
      petStage: petStageForXp(xpTotal),
      petName: settings?.petName ?? "Peanut",
      rewardBalance: reward.earned - reward.spent,
    };
  }, []);

  const data = stats;
  if (!data) return <section className="min-h-40" />;

  const { m, level } = data;
  const stage = PET_STAGES.find((s) => s.stage === data.petStage) ?? PET_STAGES[0];
  const levelPct =
    level.toNext > 0 ? Math.min(100, (level.intoLevel / level.toNext) * 100) : 100;

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            {dayLabel(data.today)}
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

      {/* Pet + progress */}
      <Card className="mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-4xl">
            <span className="animate-bob" aria-hidden>
              {stage.emoji}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-stone-900">
              {data.petName} · {stage.label}
            </p>
            <p className="text-xs text-stone-400">
              {xpTotalToWords(m.totalXp)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
              🔥 {m.loginStreak}
            </span>
            <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-700">
              🧘 {m.noSpendStreak} day{m.noSpendStreak === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="font-bold text-stone-500">Level {level.level}</span>
            <span className="text-stone-400">
              {level.intoLevel}/{level.toNext} XP to level {level.level + 1}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
              style={{ width: `${levelPct}%` }}
            />
          </div>
        </div>

        {data.rewardBalance > 0 && (
          <Link
            href="/rewards"
            className="mt-4 flex items-center justify-between rounded-2xl bg-amber-50 px-3 py-2.5 text-sm active:bg-amber-100"
          >
            <span className="font-semibold text-amber-800">
              🎁 Guilt-free budget
            </span>
            <span className="font-extrabold text-amber-700 tabular-nums">
              {fmtMoney(data.rewardBalance)}
            </span>
          </Link>
        )}
      </Card>

      {/* Money this month */}
      {data.monthRows.length > 0 ? (
        <Card className="mb-3 border-0 bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
            Saved {monthLabel(data.monthStart)}
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
      ) : (
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

      {/* Recent */}
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-stone-600">Recent activity</h2>
        {data.recent.length > 0 && (
          <Link href="/transactions" className="text-xs font-semibold text-emerald-700">
            See all
          </Link>
        )}
      </div>

      {data.recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-stone-300 py-10 text-center">
          <p className="text-sm font-medium text-stone-500">
            Your latest entries will show up here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-sm">
          {data.recent.map((e, i) => {
            const cat = e.categoryId ? data.cats.get(e.categoryId) : undefined;
            const glyph = glyphFor(e, cat);
            const title =
              e.merchant || cat?.name || (e.type === "setAside" ? "Saved" : e.type);
            return (
              <Link
                key={e.id}
                href="/transactions"
                className={cx(
                  "flex items-center gap-3 px-3 py-2.5 active:bg-stone-50",
                  i < data.recent.length - 1 && "border-b border-stone-100",
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

function xpTotalToWords(totalXp: number): string {
  if (totalXp === 0) return "Check in to wake your egg 🥚";
  if (totalXp < 260) return "Just getting going — keep saving!";
  if (totalXp < 700) return "You're building real momentum.";
  if (totalXp < 1600) return "A serious saver in the making.";
  return "Legendary saver. Your pig is proud.";
}
