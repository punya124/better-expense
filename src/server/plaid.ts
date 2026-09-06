import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

type Env = keyof typeof PlaidEnvironments;

/** Plaid secret holder — server only. Never import this from client code. */
export function plaidClient(): PlaidApi {
  const raw = (process.env.PLAID_ENV ?? "sandbox") as string;
  if (!(raw in PlaidEnvironments)) {
    throw new Error(`Unknown PLAID_ENV: ${raw} (use sandbox or production)`);
  }
  const env = raw as Env;
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new Error(
      "Plaid is not configured. Set PLAID_CLIENT_ID / PLAID_SECRET / PLAID_ENV.",
    );
  }
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: { headers: { "PLAID-CLIENT-ID": clientId, "PLAID-SECRET": secret } },
  });
  return new PlaidApi(config);
}
