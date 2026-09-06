import { NextResponse } from "next/server";
import { plaidClient } from "@/server/plaid";

export interface SyncedTxn {
  transactionId: string;
  amount: number;
  currency: string;
  date: string;
  name: string;
  merchantName: string | null;
  primaryCategory: string | null;
}

interface SyncPayload {
  added: SyncedTxn[];
  removed: string[];
  cursor: string;
  truncated: boolean;
}

/**
 * Incremental sync proxy: the browser sends the access_token it owns plus its
 * stored cursor; the server pages through Plaid and returns the delta. No
 * per-user state is kept on the server.
 */
export async function POST(req: Request) {
  try {
    const { access_token, cursor } = (await req.json().catch(() => ({}))) as {
      access_token?: string;
      cursor?: string;
    };
    if (!access_token) {
      return NextResponse.json({ error: "Missing access_token" }, { status: 400 });
    }
    const client = plaidClient();
    const payload: SyncPayload = {
      added: [],
      removed: [],
      cursor: cursor ?? "",
      truncated: false,
    };
    let nextCursor = cursor ?? "";
    let pages = 0;
    let hasMore = true;
    while (hasMore && pages < 8) {
      pages += 1;
      const res = await client.transactionsSync({
        access_token,
        cursor: nextCursor,
        count: 100,
      });
      const d = res.data;
      for (const t of d.added) {
        const pfc = t.personal_finance_category;
        payload.added.push({
          transactionId: t.transaction_id,
          amount: t.amount,
          currency: t.iso_currency_code ?? "USD",
          date: t.date,
          name: t.name,
          merchantName: t.merchant_name ?? null,
          primaryCategory:
            (pfc && "primary" in pfc ? (pfc.primary as string) : null) ??
            (t.category && t.category.length > 0 ? t.category[0] : null),
        });
      }
      for (const r of d.removed ?? []) payload.removed.push(r.transaction_id);
      nextCursor = d.next_cursor;
      hasMore = Boolean(d.has_more) && pages < 8;
    }
    payload.cursor = nextCursor;
    payload.truncated = hasMore;
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 },
    );
  }
}
