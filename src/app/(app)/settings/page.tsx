"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db, getSettings, initDB, saveSettings } from "@/lib/db";
import { syncPlaidItem } from "@/lib/plaid/sync";
import { Button, Card } from "@/components/ui";

const PLAID_LINK_URL = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

function loadPlaidLink(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Plaid) return resolve(true);
    const s = document.createElement("script");
    s.src = PLAID_LINK_URL;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

function fmtWhen(ts: number | undefined): string {
  if (!ts) return "never";
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.round(min / 60)}h ago`;
}

export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [rate, setRate] = useState("");
  const [rateSaved, setRateSaved] = useState("");

  const items = useLiveQuery(() => db.plaidItems.toArray(), []);
  const settings = useLiveQuery(() => getSettings(), []);
  const saveCount = useLiveQuery(
    () => db.ledger.where("type").equals("setAside").count(),
    [],
  );

  useEffect(() => {
    if (settings && rate === "") setRate(String(settings.rewardRate * 100));
  }, [settings, rate]);

  function note(msg: string) {
    setMessage(msg);
  }

  async function connect() {
    setBusy(true);
    setMessage("Opening Plaid Link…");
    try {
      await initDB();
      const s = await getSettings();
      if (!s) throw new Error("Storage not ready yet. Try again.");
      const tokenRes = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: s.deviceId }),
      });
      const { link_token, error } = await tokenRes.json();
      if (!tokenRes.ok || !link_token) {
        setMessage(
          error?.includes("Plaid is not configured")
            ? "Bank sync needs Plaid keys. Put them in .env.local (see .env.example)."
            : error ?? "Couldn't start bank linking.",
        );
        setBusy(false);
        return;
      }
      const ok = await loadPlaidLink();
      if (!ok || !window.Plaid) {
        setMessage("Couldn't load Plaid Link (offline?). Try again.");
        setBusy(false);
        return;
      }
      const handler = window.Plaid.create({
        token: link_token as string,
        onSuccess: async (public_token, meta) => {
          setBusy(true);
          setMessage("Connecting…");
          try {
            const exRes = await fetch("/api/plaid/exchange", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ public_token }),
            });
            const { access_token, error: exError } = await exRes.json();
            if (!exRes.ok || !access_token) throw new Error(exError ?? "Exchange failed");
            const itemId = await db.plaidItems.add({
              accessToken: access_token as string,
              institution: meta.institution?.name ?? "Bank",
              lastSyncedAt: undefined,
            });
            const out = await syncPlaidItem(itemId);
            note(
              `Connected ${meta.institution?.name ?? "bank"}: ${out.added} new, ${out.existing} matched, ${out.skipped} skipped.`,
            );
          } catch (e) {
            note(e instanceof Error ? e.message : "Couldn't finish connecting.");
          } finally {
            setBusy(false);
          }
        },
        onExit: () => {
          setMessage("");
          setBusy(false);
        },
      });
      handler.open();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unexpected error.");
      setBusy(false);
    }
  }

  async function syncAll() {
    if (!items || items.length === 0) return;
    setBusy(true);
    setMessage("Syncing…");
    try {
      for (const item of items) {
        const out = await syncPlaidItem(item.id as number);
        note(
          `${item.institution}: ${out.added} new, ${out.existing} refreshed, ${out.skipped} skipped.`,
        );
      }
    } catch (e) {
      note(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRate() {
    const pct = Number(rate);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setRateSaved("Rate must be between 0 and 100.");
      return;
    }
    const rewardRate = Math.round(pct * 100) / 100 / 100;
    await saveSettings({ rewardRate });
    setRateSaved("Saved. Past rewards are untouched.");
    window.setTimeout(() => setRateSaved(""), 2500);
  }

  return (
    <section>
      <h1 className="mb-1 text-xl font-bold">Settings</h1>
      <p className="mb-4 text-sm text-stone-500">Your data never leaves this phone.</p>

      {message && (
        <div className="animate-pop-in mb-3 rounded-2xl bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700">
          {message}
        </div>
      )}

      {/* Bank sync */}
      <Card className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-stone-900">Bank sync</h2>
            <p className="text-xs text-stone-400">Auto-import spending from your bank.</p>
          </div>
          <Button
            className="h-9"
            disabled={busy}
            onClick={() => void connect()}
            variant="secondary"
          >
            {busy ? "…" : "＋ Connect"}
          </Button>
        </div>

        {items && items.length > 0 ? (
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-2xl bg-stone-50 px-3 py-2"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-sm" aria-hidden>
                  🏦
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-800">
                    {item.institution}
                  </p>
                  <p className="text-xs text-stone-400">Synced {fmtWhen(item.lastSyncedAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void syncPlaidItem(item.id as number)}
                  className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 active:bg-emerald-50"
                >
                  Sync
                </button>
                <button
                  type="button"
                  aria-label="Remove connection"
                  onClick={() => {
                    if (window.confirm("Remove this bank connection?")) {
                      void db.plaidItems.delete(item.id as number);
                    }
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-bold text-rose-500 active:bg-rose-50"
                >
                  Remove
                </button>
              </div>
            ))}
            <Button className="w-full" variant="secondary" onClick={() => void syncAll()}>
              Sync everything now
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            No bank connected. Transactions you log by hand work fine without it.
          </p>
        )}
      </Card>

      {/* Reward rate */}
      <Card className="mb-3">
        <h2 className="font-extrabold text-stone-900">Reward rate</h2>
        <p className="mt-0.5 text-xs text-stone-400">
          % of each set-aside that becomes guilt-free reward budget. Past rewards
          stay as they were.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-24 rounded-xl border border-stone-200 px-3 py-2 text-sm font-bold outline-none focus:border-emerald-400"
          />
          <span className="font-semibold text-stone-500">%</span>
          <Button className="ml-auto h-9" variant="secondary" onClick={() => void saveRate()}>
            Save
          </Button>
        </div>
        {rateSaved && <p className="mt-2 text-sm font-medium text-emerald-600">{rateSaved}</p>}
      </Card>

      {/* Pet */}
      <Card className="mb-3">
        <h2 className="font-extrabold text-stone-900">Pet</h2>
        <PetRename name={settings?.petName ?? "Peanut"} />
      </Card>

      {/* Data */}
      <Card>
        <h2 className="font-extrabold text-stone-900">Your data</h2>
        <p className="mt-0.5 text-sm text-stone-500">
          This app is local-first. Switch phones by exporting a backup on this
          device and importing it on the new one.
        </p>
        <p className="mt-1 text-xs text-stone-400">
          {saveCount ?? 0} set-aside{saveCount === 1 ? "" : "s"} recorded on this
          device.
        </p>
      </Card>
    </section>
  );
}

function PetRename({ name }: { name: string }) {
  const [value, setValue] = useState(name);
  const [saved, setSaved] = useState(false);
  useEffect(() => setValue(name), [name]);
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={value}
        maxLength={20}
        onChange={(e) => setValue(e.target.value)}
        className="w-36 rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium outline-none focus:border-emerald-400"
        aria-label="Pet name"
      />
      <Button
        variant="secondary"
        className="h-9"
        onClick={() => {
          const v = value.trim();
          if (!v) return;
          void saveSettings({ petName: v });
          setSaved(true);
          window.setTimeout(() => setSaved(false), 2000);
        }}
      >
        Rename
      </Button>
      {saved && <span className="text-xs font-bold text-emerald-600">✓</span>}
    </div>
  );
}
