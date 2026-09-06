"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, getSettings } from "@/lib/db";
import { rewardStats, recordRewardSpend } from "@/lib/reward";
import { fmtMoney, inputToCents, todayISO } from "@/lib/format";
import { Button, Card, cx } from "@/components/ui";

interface HistoryRow {
  id: number;
  kind: "earned" | "spent";
  amountCents: number;
  date: string;
  note: string;
}

export default function RewardsPage() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const stats = useLiveQuery(() => rewardStats(), []);
  const history = useLiveQuery(async (): Promise<HistoryRow[]> => {
    const [earned, spent] = await Promise.all([
      db.ledger.where("type").equals("rewardEarned").toArray(),
      db.ledger.where("type").equals("rewardSpend").toArray(),
    ]);
    return ([] as HistoryRow[])
      .concat(
        earned.map((r) => ({
          id: r.id as number,
          kind: "earned" as const,
          amountCents: r.amountCents,
          date: r.date,
          note: r.note ?? "Reward from a set-aside",
        })),
        spent.map((r) => ({
          id: r.id as number,
          kind: "spent" as const,
          amountCents: r.amountCents,
          date: r.date,
          note: r.merchant ?? "Reward treat",
        })),
      )
      .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
      .slice(0, 40);
  }, []);
  const settings = useLiveQuery(() => getSettings(), []);

  const rate = settings?.rewardRate ?? 0.1;
  const amountCents = inputToCents(amount);
  const balance = stats?.balanceCents ?? 0;

  async function spend() {
    if (!Number.isFinite(amountCents)) {
      setError("Enter an amount.");
      return;
    }
    setError("");
    try {
      await recordRewardSpend({
        amountCents: amountCents as number,
        date: todayISO(),
        note: note.trim(),
      });
      setAmount("");
      setNote("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't spend that.");
    }
  }

  return (
    <section>
      <h1 className="mb-1 text-xl font-bold">Rewards</h1>
      <p className="mb-4 text-sm text-stone-500">
        Save money, earn guilt-free budget to spend on yourself.
      </p>

      <Card className="mb-3 border-0 bg-gradient-to-br from-amber-400 to-orange-500 p-5 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-50">
          Guilt-free budget
        </p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums">
          {fmtMoney(balance)}
        </p>
        <div className="mt-4 flex items-center justify-between border-t border-white/20 pt-3 text-sm">
          <div>
            <p className="text-xs text-amber-100">Earned</p>
            <p className="font-bold tabular-nums">{fmtMoney(stats?.earnedCents ?? 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-amber-100">Spent</p>
            <p className="font-bold tabular-nums">{fmtMoney(stats?.spentCents ?? 0)}</p>
          </div>
        </div>
      </Card>

      <Card className="mb-3">
        <p className="text-sm text-stone-600">
          Every set-aside adds{" "}
          <strong>{Math.round(rate * 100)}% of itself</strong> right back here.
          Put away $100 and{" "}
          <strong className="text-amber-600">
            {fmtMoney(Math.round(100_00 * rate))}
          </strong>{" "}
          is yours to spend on anything — guilt-free, because it&apos;s backed by
          money you really saved.
        </p>
      </Card>

      {!open ? (
        <Button className="w-full" disabled={balance <= 0} onClick={() => setOpen(true)}>
          🎁 Spend reward
        </Button>
      ) : (
        <Card className="animate-pop-in">
          <div className="flex items-baseline">
            <span className="text-xl font-semibold text-stone-400">$</span>
            <input
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent px-2 py-1 text-2xl font-bold tabular-nums outline-none placeholder:text-stone-300"
            />
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's the treat? (optional)"
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
          />
          {error && <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={() => setOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button
              className="flex-1 bg-amber-500 active:bg-amber-600"
              disabled={!Number.isFinite(amountCents)}
              onClick={() => void spend()}
            >
              Spend it
            </Button>
          </div>
        </Card>
      )}

      <h2 className="mb-2 mt-6 px-1 text-sm font-bold text-stone-600">History</h2>
      {history && history.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-stone-300 py-8 text-center text-sm text-stone-400">
          Set money aside and your reward credit shows up here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-sm">
          {history?.map((h) => (
            <div
              key={h.id}
              className={cx(
                "flex items-center gap-3 border-b border-stone-100 px-3 py-2.5 last:border-b-0",
              )}
            >
              <span
                className={cx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base",
                  h.kind === "earned" ? "bg-amber-100" : "bg-orange-100",
                )}
                aria-hidden
              >
                {h.kind === "earned" ? "🎁" : "✨"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-800">{h.note}</p>
                <p className="text-xs text-stone-400">{h.date}</p>
              </div>
              <span
                className={cx(
                  "text-sm font-bold tabular-nums",
                  h.kind === "earned" ? "text-amber-600" : "text-orange-600",
                )}
              >
                {h.kind === "earned" ? "+" : "−"}
                {fmtMoney(h.amountCents)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
