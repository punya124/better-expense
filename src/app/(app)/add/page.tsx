"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type LedgerType } from "@/lib/db";
import { addEntry } from "@/lib/ledger";
import { centsToInput, inputToCents, todayISO } from "@/lib/format";
import { Button, Segmented, cx } from "@/components/ui";

type AddType = Extract<LedgerType, "expense" | "setAside" | "income">;

const TYPE_OPTIONS: Array<{ value: AddType; label: string; emoji: string }> = [
  { value: "expense", label: "Spent", emoji: "💸" },
  { value: "setAside", label: "Saved", emoji: "🐷" },
  { value: "income", label: "Earned", emoji: "💵" },
];

export default function AddPage() {
  const router = useRouter();
  const [type, setType] = useState<AddType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [goalId, setGoalId] = useState<number | undefined>();
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const categories = useLiveQuery(() => db.categories.orderBy("name").toArray(), []);
  const goals = useLiveQuery(
    () => db.goals.filter((g) => !g.archivedAt).sortBy("createdAt"),
    [],
  );
  const chosenGoal = goals?.find((g) => g.id === goalId);

  const amountCents = inputToCents(amount);
  const canSave =
    Number.isFinite(amountCents) && (type !== "setAside" || goalId != null);

  function back() {
    if (window.history.length > 1) router.back();
    else router.replace("/");
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
    await addEntry({
      type,
      amountCents: amountCents as number,
      date,
      categoryId: type === "expense" ? categoryId : undefined,
      goalId: type === "setAside" ? goalId : undefined,
      merchant: type === "income" ? label || "Income" : label || undefined,
    });
    back();
  }

  const amountDraft = amountCents ? centsToInput(amountCents) : "";

  return (
    <section className="animate-pop-in">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Add entry</h1>
        <Button variant="ghost" onClick={back} className="h-9">
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
        {amountDraft && type === "setAside" && (
          <p className="mt-1 text-sm font-medium text-emerald-600">
            Heading to {chosenGoal?.name ?? "a goal"}.
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
          placeholder={type === "expense" ? "e.g. Lunch with Sam" : type === "income" ? "e.g. Paycheck" : "Optional"}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-medium outline-none focus:border-emerald-400"
        />
      </div>

      {error && <p className="mb-3 text-sm font-medium text-rose-600">{error}</p>}

      <Button
        className="w-full"
        disabled={!canSave}
        onClick={() => void save()}
      >
        {type === "expense"
          ? "Log expense"
          : type === "income"
            ? "Log income"
            : "Save it away"}
      </Button>
    </section>
  );
}
