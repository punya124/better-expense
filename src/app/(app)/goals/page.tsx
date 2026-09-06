"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type Goal } from "@/lib/db";
import { recordSave } from "@/lib/gamification";
import { fmtMoney, inputToCents, todayISO } from "@/lib/format";
import { Button, Card, cx } from "@/components/ui";
import { TargetIcon } from "@/components/icons";

const EMOJIS = ["🎯", "🏝️", "🚗", "💍", "🏠", "💻", "📚", "🎮", "✈️", "🐷"];

interface Row {
  goal: Goal;
  savedCents: number;
  done: boolean;
  pct: number;
}

export default function GoalsPage() {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🎯");
  const [newTarget, setNewTarget] = useState("");
  const [newError, setNewError] = useState("");
  const [quickFor, setQuickFor] = useState<number | null>(null);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickError, setQuickError] = useState("");
  const [flash, setFlash] = useState("");

  const rows = useLiveQuery(async (): Promise<Row[]> => {
    const [goals, ledger] = await Promise.all([
      db.goals.toArray(),
      db.ledger.where("type").equals("setAside").toArray(),
    ]);
    const byGoal = new Map<number, number>();
    for (const s of ledger) {
      if (s.goalId != null) {
        byGoal.set(s.goalId, (byGoal.get(s.goalId) ?? 0) + s.amountCents);
      }
    }
    return goals
      .filter((g) => !g.archivedAt)
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      .map((goal) => {
        const savedCents = byGoal.get(goal.id as number) ?? 0;
        const pct =
          goal.targetCents > 0
            ? Math.min(100, Math.round((savedCents / goal.targetCents) * 100))
            : 0;
        return { goal, savedCents, done: savedCents >= goal.targetCents, pct };
      });
  }, []);

  async function createGoal() {
    const cents = inputToCents(newTarget);
    if (!newName.trim()) return setNewError("Give it a name.");
    if (!Number.isFinite(cents)) return setNewError("Enter a target amount.");
    setNewError("");
    await db.goals.add({
      name: newName.trim(),
      emoji: newEmoji,
      targetCents: cents as number,
      createdAt: Date.now(),
    });
    setNewName("");
    setNewTarget("");
    setNewEmoji("🎯");
    setCreating(false);
  }

  async function quickSave() {
    const cents = inputToCents(quickAmount);
    if (!Number.isFinite(cents)) return setQuickError("Enter an amount.");
    if (quickFor == null) return;
    setQuickError("");
    try {
      const res = await recordSave({
        goalId: quickFor,
        amountCents: cents as number,
        date: todayISO(),
      });
      setFlash(
        `+${res.xpAwarded} XP${res.rewardCents ? ` · +${fmtMoney(res.rewardCents)} reward` : ""}`,
      );
      window.setTimeout(() => setFlash(""), 2600);
      setQuickAmount("");
      setQuickFor(null);
    } catch (e) {
      setQuickError(e instanceof Error ? e.message : "Couldn't save that.");
    }
  }

  const totalSaved = (rows ?? []).reduce((s, r) => s + r.savedCents, 0);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Goals</h1>
        <Button variant="secondary" className="h-9" onClick={() => setCreating(!creating)}>
          {creating ? "Cancel" : "+ New goal"}
        </Button>
      </div>
      <p className="mb-4 mt-1 text-sm text-stone-500">
        Every dollar tucked toward a goal earns XP and reward credit.
      </p>

      {flash && (
        <div className="animate-pop-in mb-3 rounded-2xl bg-violet-100 px-3 py-2 text-center text-sm font-bold text-violet-700">
          {flash}
        </div>
      )}

      {creating && (
        <Card className="animate-pop-in mb-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Goal name
          </label>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Japan trip 2027"
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-medium outline-none focus:border-emerald-400"
          />
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-stone-400">
            Icon
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setNewEmoji(e)}
                className={cx(
                  "flex h-9 w-9 items-center justify-center rounded-xl text-lg",
                  newEmoji === e ? "bg-emerald-100 ring-2 ring-emerald-400" : "bg-stone-50",
                )}
                aria-label={`icon ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-stone-400">
            Target amount
          </label>
          <div className="mt-1 flex items-baseline">
            <span className="text-lg font-semibold text-stone-400">$</span>
            <input
              inputMode="decimal"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="500.00"
              className="w-full bg-transparent px-2 py-1 text-xl font-bold tabular-nums outline-none placeholder:text-stone-300"
            />
          </div>
          {newError && <p className="mt-1 text-sm font-medium text-rose-600">{newError}</p>}
          <Button className="mt-3 w-full" onClick={() => void createGoal()}>
            Create goal
          </Button>
        </Card>
      )}

      {rows && rows.length === 0 && !creating ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-stone-300 py-12 text-center">
          <TargetIcon className="h-8 w-8 text-stone-300" />
          <p className="font-semibold text-stone-600">No goals yet</p>
          <p className="max-w-52 text-sm text-stone-400">
            Give your saving a target and the habit gets much easier.
          </p>
          <Button className="mt-2" onClick={() => setCreating(true)}>
            Create your first goal
          </Button>
        </div>
      ) : (
        rows && (
          <>
            {rows.length > 1 && (
              <p className="mb-2 px-1 text-xs font-semibold text-stone-400">
                {fmtMoney(totalSaved)} tucked away across {rows.length} goals
              </p>
            )}
            {rows.map(({ goal, savedCents, done, pct }) => (
              <Card key={goal.id} className="mb-3">
                {quickFor === goal.id ? (
                  <div className="animate-pop-in">
                    <p className="text-sm font-semibold text-stone-600">
                      Save to {goal.emoji ?? ""} {goal.name}
                    </p>
                    <div className="mt-2 flex items-baseline">
                      <span className="text-xl font-semibold text-stone-400">$</span>
                      <input
                        inputMode="decimal"
                        autoFocus
                        value={quickAmount}
                        onChange={(e) => setQuickAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-transparent px-2 py-1 text-2xl font-bold tabular-nums outline-none placeholder:text-stone-300"
                      />
                    </div>
                    {quickError && (
                      <p className="text-sm font-medium text-rose-600">{quickError}</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Button
                        className="flex-1"
                        variant="secondary"
                        onClick={() => {
                          setQuickFor(null);
                          setQuickAmount("");
                          setQuickError("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={!Number.isFinite(inputToCents(quickAmount))}
                        onClick={() => void quickSave()}
                      >
                        Save it
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span
                        className={cx(
                          "flex h-12 w-12 items-center justify-center rounded-2xl text-2xl",
                          done ? "bg-emerald-100" : "bg-stone-100",
                        )}
                        aria-hidden
                      >
                        {goal.emoji ?? "🎯"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-extrabold text-stone-900">{goal.name}</p>
                        <p className="text-sm text-stone-400">
                          <span className="font-bold text-stone-700 tabular-nums">
                            {fmtMoney(savedCents)}
                          </span>{" "}
                          of {fmtMoney(goal.targetCents)}
                        </p>
                      </div>
                      {done ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          Reached 🎉
                        </span>
                      ) : (
                        <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">
                          {pct}%
                        </span>
                      )}
                    </div>

                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={cx(
                          "h-full rounded-full transition-all",
                          done
                            ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                            : "bg-gradient-to-r from-emerald-500 to-teal-500",
                        )}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>

                    {!done && goal.targetCents > 0 && (
                      <p className="mt-1.5 text-xs text-stone-400">
                        {fmtMoney(Math.max(0, goal.targetCents - savedCents))} to go
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <Button
                        variant="secondary"
                        className="h-9 flex-1 justify-center"
                        onClick={() => {
                          setQuickFor(goal.id as number);
                          setQuickAmount("");
                        }}
                      >
                        + Save money
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-9"
                        onClick={() =>
                          void db.goals.update(goal.id as number, {
                            archivedAt: Date.now(),
                          })
                        }
                      >
                        Archive
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ))}
          </>
        )
      )}

    </section>
  );
}
