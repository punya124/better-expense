import { NextResponse } from "next/server";
import { plaidClient } from "@/server/plaid";

/** Exchange a one-time public_token for a long-lived access_token, handed back to the client. */
export async function POST(req: Request) {
  try {
    const { public_token } = (await req.json().catch(() => ({}))) as {
      public_token?: string;
    };
    if (!public_token) {
      return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
    }
    const client = plaidClient();
    const res = await client.itemPublicTokenExchange({ public_token });
    return NextResponse.json({
      access_token: res.data.access_token,
      item_id: res.data.item_id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't exchange token" },
      { status: 500 },
    );
  }
}
