"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { BADGE_DEFS, gatherMetrics, levelInfo } from "@/lib/gamification";
import { toISODate } from "@/lib/format";
import { cx } from "@/components/ui";
import { AwardIcon } from "@/components/icons";

export default function BadgesPage() {
  const data = useLiveQuery(async () => {
    const [ledger, categories, streaks, xpLog, goals, unlocked] = await Promise.all([
      db.ledger.toArray(),
      db.categories.toArray(),
      db.streaks.toArray(),
      db.xpLog.toArray(),
      db.goals.toArray(),
      db.badges.toArray(),
    ]);
    const xpTotal = xpLog.reduce((s, x) => s + x.amount, 0);
    const metrics = gatherMetrics(
      ledger,
      categories,
      streaks.map(({ key, count, lastDate }) => ({ key, count, lastDate })),
      xpTotal,
      goals,
      toISODate(),
    );
    const have = new Map(unlocked.map((b) => [b.code, b.unlockedAt]));
    return {
      earned: have.size,
      total: BADGE_DEFS.length,
      level: levelInfo(xpTotal).level,
      rows: BADGE_DEFS.map((def) => ({
        def,
        unlockedAt: have.get(def.code),
        near: !have.has(def.code) && def.check(metrics),
      })),
    };
  }, []);

  if (!data) return <section className="min-h-40" />;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Badges</h1>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-bold text-stone-500">
          {data.earned}/{data.total}
        </span>
      </div>
      <p className="mb-4 mt-1 text-sm text-stone-500">
        Little trophies for turning saving into a habit.
      </p>

      {data.earned === 0 && (
        <div className="mb-4 flex flex-col items-center gap-2 rounded-3xl border border-dashed border-stone-300 py-8 text-center">
          <AwardIcon className="h-7 w-7 text-stone-300" />
          <p className="px-6 text-sm text-stone-500">
            None yet. Check in daily, set money aside, and skip the treats — badges
            follow automatically.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {data.rows.map(({ def, unlockedAt, near }) => {
          const unlocked = unlockedAt != null;
          return (
            <div
              key={def.code}
              className={cx(
                "rounded-3xl border p-3 transition-colors",
                unlocked
                  ? "border-emerald-200 bg-emerald-50/60"
                  : near
                    ? "border-violet-200 bg-violet-50/50"
                    : "border-stone-200/70 bg-white opacity-70",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl" aria-hidden>
                  {def.emoji}
                </span>
                {unlocked ? (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    ✓
                  </span>
                ) : near ? (
                  <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                    close
                  </span>
                ) : null}
              </div>
              <p
                className={cx(
                  "mt-1.5 text-sm font-bold leading-tight",
                  unlocked ? "text-emerald-900" : "text-stone-600",
                )}
              >
                {def.name}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-stone-400">
                {def.desc}
              </p>
              {unlockedAt && (
                <p className="mt-1 text-[10px] font-semibold text-emerald-500">
                  {new Date(unlockedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
