/**
 * Maps Plaid categories (personal-finance "primary", else legacy category name)
 * onto Better Expense categories. Anything unrecognized lands on a needs-style
 * catch-all so imported bills don't silently break no-spend streaks.
 */

export type ImportClass = "expense" | "income" | "skip";

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

// normalized primary -> our categoryId
const MAP: Record<string, string> = {
  FOODANDDRINK: "dining-out",
  RESTAURANTS: "dining-out",
  COFFEE: "coffee",
  COFFEESHOPS: "coffee",
  GROCERIES: "groceries",
  TRANSPORTATION: "transport",
  GAS: "transport",
  TRAVEL: "travel",
  RENTANDUTILITIES: "rent-home",
  HOMEIMPROVEMENT: "other-bills",
  GENERALMERCHANDISE: "shopping",
  SHOPPING: "shopping",
  HEALTHCARE: "health",
  MEDICAL: "health",
  ENTERTAINMENT: "entertainment",
  RECREATION: "entertainment",
  PERSONALCARE: "personal-care",
  EDUCATION: "other-bills",
  LOANPAYMENTS: "other-bills",
  BILLSPAYMENTS: "other-bills",
  GOVERNMENTANDNONPROFIT: "other-bills",
  OTHERINCOME: "income",
  TRANSFERIN: "skip", // bank-internal movements, not real spending
  TRANSFEROUT: "skip",
  PAYMENT: "skip",
  FEES: "other-bills",
  INTEREST: "skip",
};

export function classifyPlaidTransaction(
  primaryCategory: string | null,
  amount: number,
): { kind: ImportClass; categoryId?: string } {
  if (primaryCategory) {
    const hit = MAP[norm(primaryCategory)];
    if (hit === "income") return { kind: "income" };
    if (hit === "skip") return { kind: "skip" };
    if (hit) return { kind: "expense", categoryId: hit };
  }
  if (amount < 0) return { kind: "income" };
  return { kind: "expense", categoryId: "other-bills" };
}
