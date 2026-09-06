import { db } from "./db";

export interface RewardStats {
  earnedCents: number;
  spentCents: number;
  balanceCents: number;
}

async function sumOfType(type: "rewardEarned" | "rewardSpend"): Promise<number> {
  const rows = await db.ledger.where("type").equals(type).toArray();
  return rows.reduce((s, r) => s + r.amountCents, 0);
}

export async function rewardStats(): Promise<RewardStats> {
  const [earnedCents, spentCents] = await Promise.all([
    sumOfType("rewardEarned"),
    sumOfType("rewardSpend"),
  ]);
  return { earnedCents, spentCents, balanceCents: earnedCents - spentCents };
}

/**
 * Log a guilt-free spend against the reward wallet. Throws if the balance
 * wouldn't cover it, so the wallet always stays backed by money actually
 * set aside.
 */
export async function recordRewardSpend(input: {
  amountCents: number;
  date: string;
  note?: string;
}): Promise<void> {
  await db.transaction("rw", db.ledger, async () => {
    const stats = await rewardStats();
    if (stats.balanceCents < input.amountCents) {
      throw new RangeError(
        `Only ${(stats.balanceCents / 100).toFixed(2)} of reward money available.`,
      );
    }
    await db.ledger.add({
      type: "rewardSpend",
      amountCents: input.amountCents,
      date: input.date,
      merchant: input.note?.trim() || "Reward treat",
      source: "manual",
      createdAt: Date.now(),
    });
  });
}
