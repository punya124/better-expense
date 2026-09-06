"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, getSettings, type LedgerType } from "@/lib/db";
import { addEntry } from "@/lib/ledger";
import { recordExpense, recordSave, saveXpFor } from "@/lib/gamification";
import { fmtMoney, inputToCents, todayISO } from "@/lib/format";
import { Button, Segmented, cx } from "@/components/ui";

type AddType = Extract<LedgerType, "expense" | "setAside" | "income">;

const TYPE_OPTIONS = [
  { value: "expense" as const, label: "Spent", emoji: "💸" },
  { value: "setAside" as const, label: "Saved", emoji: "🐷" },
  { value: "income" as const, label: "Earned", emoji: "💵" },
];

interface DoneInfo {
  kind: AddType;
  money: string;
  goal?: string;
  xp?: number;
  reward?: number;
}

export default function AddPage() {
  const router = useRouter();
  const [type, setType] = useState<AddType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [goalId, setGoalId] = useState<number | undefined>();
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = useLiveQuery(() => db.categories.orderBy("name").toArray(), []);
  const goals = useLiveQuery(
    () => db.goals.filter((g) => !g.archivedAt).sortBy("createdAt"),
    [],
  );
  const settings = useLiveQuery(() => getSettings(), []);
  const chosenGoal = goals?.find((g) => g.id === goalId);

  const amountCents = inputToCents(amount);
  const canSave = Number.isFinite(amountCents) && (type !== "setAside" || goalId != null);

  function leave() {
    router.replace("/");
  }

  async function save() {
    if (!Number.isFinite(amountCents)) {
      setError("Enter an amount.");
      return;
    }
    if (type === "setAside" && goalId == null) {
      setError("Pick a goal to save toward.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (type === "setAside") {
        const res = await recordSave({
          goalId: goalId as number,
          amountCents: amountCents as number,
          date,
          note: label.trim() || undefined,
        });
        setDone({
          kind: type,
          money: fmtMoney(amountCents as number),
          goal: chosenGoal?.name,
          xp: res.xpAwarded,
          reward: res.rewardCents,
        });
      } else if (type === "expense") {
        await recordExpense({
          amountCents: amountCents as number,
          date,
          categoryId,
          merchant: label.trim() || undefined,
        });
        setDone({ kind: type, money: fmtMoney(amountCents as number) });
      } else {
        await addEntry({
          type: "income",
          amountCents: amountCents as number,
          date,
          merchant: label.trim() || "Income",
        });
        setDone({ kind: type, money: fmtMoney(amountCents as number) });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
      setSaving(false);
    }
  }

  if (done) {
    return (
      <section className="animate-pop-in flex flex-col items-center pt-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
          {done.kind === "setAside" ? "🐷" : done.kind === "expense" ? "💸" : "💵"}
        </div>
        <h2 className="mt-5 text-2xl font-extrabold text-stone-900">
          {done.kind === "setAside"
            ? `Saved ${done.money}`
            : done.kind === "expense"
              ? `Logged ${done.money}`
              : `Logged ${done.money}`}
        </h2>
        {done.goal && (
          <p className="mt-1 text-sm text-stone-500">toward {done.goal}</p>
        )}
        {(done.xp ?? 0) > 0 || (done.reward ?? 0) > 0 ? (
          <div className="mt-5 flex gap-2">
            {(done.xp ?? 0) > 0 && (
              <span className="rounded-full bg-violet-100 px-3 py-1.5 text-sm font-bold text-violet-700">
                +{done.xp} XP
              </span>
            )}
            {(done.reward ?? 0) > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-700">
                +{fmtMoney(done.reward as number)} reward
              </span>
            )}
          </div>
        ) : null}
        <Button className="mt-8 w-40" onClick={leave}>
          Done
        </Button>
      </section>
    );
  }

  const rewardPreview =
    type === "setAside" && Number.isFinite(amountCents)
      ? Math.round((amountCents as number) * (settings?.rewardRate ?? 0.1))
      : 0;

  return (
    <section className="animate-pop-in">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Add entry</h1>
        <Button variant="ghost" onClick={leave} className="h-9">
          Cancel
        </Button>
      </div>

      <Segmented
        options={TYPE_OPTIONS.map((o) => ({
          value: o.value,
          label: (
            <>
              <span aria-hidden>{o.emoji}</span> {o.label}
            </>
          ),
        }))}
        value={type}
        onChange={(v) => {
          setType(v);
          setCategoryId(undefined);
          setGoalId(undefined);
        }}
        className="mb-4"
      />

      <div className="mb-4 rounded-3xl border border-stone-200/70 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Amount
        </label>
        <div className="mt-1 flex items-baseline">
          <span className="text-2xl font-semibold text-stone-400">$</span>
          <input
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent px-2 py-1 text-3xl font-bold tabular-nums outline-none placeholder:text-stone-300"
          />
        </div>
        {rewardPreview > 0 && chosenGoal && (
          <p className="mt-1 text-sm font-semibold text-amber-600">
            🎁 ~{fmtMoney(rewardPreview)} reward credit + ~{saveXpFor(
              amountCents as number,
            )}{" "}
            XP
          </p>
        )}
      </div>

      <div className="mb-4 rounded-3xl border border-stone-200/70 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Date
        </label>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-medium outline-none focus:border-emerald-400"
        />
      </div>

      {type === "expense" && (
        <div className="mb-4 rounded-3xl border border-stone-200/70 bg-white p-4 shadow-sm">
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Category
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {categories?.map((c) => {
              const active = categoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(active ? undefined : c.id)}
                  className={cx(
                    "flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-stone-200 bg-white text-stone-600 active:bg-stone-50",
                  )}
                >
                  <span aria-hidden>{c.icon}</span> {c.name}
                </button>
              );
            })}
          </div>
          {categoryId === undefined && (
            <p className="mt-2 text-xs text-stone-400">
              No category = “other”. It still counts as a treat.
            </p>
          )}
        </div>
      )}

      {type === "setAside" && (
        <div className="mb-4 rounded-3xl border border-stone-200/70 bg-white p-4 shadow-sm">
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Save toward
          </label>
          {goals && goals.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {goals.map((g) => {
                const active = goalId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoalId(active ? undefined : g.id)}
                    className={cx(
                      "flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-stone-200 bg-white text-stone-600 active:bg-stone-50",
                    )}
                  >
                    <span aria-hidden>{g.emoji ?? "🎯"}</span> {g.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-stone-500">
              No goals yet.{" "}
              <Link href="/goals" className="font-semibold text-emerald-600">
                Create one first
              </Link>{" "}
              — saving needs a target to feel good.
            </p>
          )}
        </div>
      )}

      <div className="mb-4 rounded-3xl border border-stone-200/70 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          {type === "expense" ? "Merchant or note" : "Note"}
        </label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={
            type === "expense"
              ? "e.g. Lunch with Sam"
              : type === "income"
                ? "e.g. Paycheck"
                : "Optional"
          }
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-medium outline-none focus:border-emerald-400"
        />
      </div>

      {error && <p className="mb-3 text-sm font-medium text-rose-600">{error}</p>}

      <Button className="w-full" disabled={!canSave || saving} onClick={() => void save()}>
        {type === "expense"
          ? "Log expense"
          : type === "income"
            ? "Log income"
            : "Save it away"}
      </Button>
    </section>
  );
}
