import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/server/plaid";

/** Returns a one-time Link token. The client supplies its device id (no user DB). */
export async function POST(req: Request) {
  try {
    const { deviceId } = (await req.json().catch(() => ({}))) as {
      deviceId?: string;
    };
    const client = plaidClient();
    const res = await client.linkTokenCreate({
      user: { client_user_id: deviceId ?? "better-expense-device" },
      client_name: "Better Expense",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't create link token" },
      { status: 500 },
    );
  }
}
