import { db } from "../db";
import { classifyPlaidTransaction } from "./categories";

interface PlaidTxn {
  transactionId: string;
  amount: number;
  currency: string;
  date: string;
  name: string;
  merchantName: string | null;
  primaryCategory: string | null;
}

interface SyncPayload {
  added: PlaidTxn[];
  removed: string[];
  cursor: string;
  truncated: boolean;
}

export interface SyncOutcome {
  added: number;
  removed: number;
  skipped: number;
  existing: number;
}

/** Pull the latest transactions for a stored Plaid item and merge them locally. */
export async function syncPlaidItem(itemId: number): Promise<SyncOutcome> {
  const item = await db.plaidItems.get(itemId);
  if (!item) throw new Error("That bank connection no longer exists.");

  const res = await fetch("/api/plaid/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: item.accessToken, cursor: item.cursor ?? "" }),
  });
  const payload = (await res.json()) as SyncPayload & { error?: string };
  if (!res.ok || !payload) {
    throw new Error(payload?.error ?? "Couldn't reach the sync service.");
  }

  return db.transaction("rw", db.ledger, db.plaidItems, async () => {
    let added = 0;
    let existing = 0;
    let skipped = 0;

    for (const txn of payload.added) {
      if (txn.currency !== "USD") {
        // Only USD is tracked for now; keep the wallet honest.
        continue;
      }
      const { kind, categoryId } = classifyPlaidTransaction(txn.primaryCategory, txn.amount);
      if (kind === "skip") {
        skipped += 1;
        continue;
      }
      const cents = Math.round(Math.abs(txn.amount) * 100);
      if (cents <= 0) continue;

      const prior = await db.ledger
        .where("plaidTransactionId")
        .equals(txn.transactionId)
        .first();
      if (prior) {
        // Re-syncs deliver the same txn again; refresh amount/name, keep category choice.
        await db.ledger.update(prior.id as number, {
          amountCents: cents,
          date: txn.date,
          merchant: txn.merchantName ?? txn.name,
        });
        existing += 1;
        continue;
      }

      await db.ledger.add({
        type: kind === "income" ? "income" : "expense",
        amountCents: cents,
        date: txn.date,
        categoryId,
        merchant: txn.merchantName ?? txn.name,
        source: "plaid",
        plaidTransactionId: txn.transactionId,
        createdAt: Date.now(),
      });
      added += 1;
    }

    for (const id of payload.removed) {
      await db.ledger.where("plaidTransactionId").equals(id).delete();
    }

    await db.plaidItems.update(itemId, {
      cursor: payload.cursor,
      lastSyncedAt: Date.now(),
    });

    return { added, removed: payload.removed.length, skipped, existing };
  });
}
