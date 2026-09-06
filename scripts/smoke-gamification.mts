// Exercises XP / rewards / streaks / badges against fake-indexeddb.
// Run: npx tsx scripts/smoke-gamification.mts
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { initDB, db } from "../src/lib/db";
import {
  recordSave,
  recordExpense,
  checkInToday,
  deleteEntryCascade,
  metricsSnapshot,
  saveXpFor,
  levelInfo,
  petStageForXp,
} from "../src/lib/gamification";
import { rewardStats, recordRewardSpend } from "../src/lib/reward";
import { todayISO } from "../src/lib/format";

await initDB();
const today = todayISO();

const goalId = await db.goals.add({
  name: "Trip fund",
  targetCents: 10_000,
  createdAt: Date.now(),
});

// --- saving: rewards + xp + badges ---
const r1 = await recordSave({ goalId, amountCents: 5_000, date: today });
assert.equal(r1.rewardCents, 500, "10% reward on $50");
assert.equal(r1.xpAwarded, saveXpFor(5_000), "save xp only (goal not yet met)");
assert.ok(r1.newBadges.some((b) => b.code === "first-save"), "first-save badge");
assert.ok(r1.newBadges.some((b) => b.code === "save-50"), "save-50 badge");

const earnedRows = await db.ledger.where("type").equals("rewardEarned").toArray();
assert.equal(earnedRows.length, 1);
assert.equal(earnedRows[0].rewardOf, r1.setAsideId, "reward links to set-aside");

// second save crosses the goal -> completion bonus xp + goal badge
const r2 = await recordSave({ goalId, amountCents: 5_000, date: today });
assert.equal(r2.xpAwarded, saveXpFor(5_000) + 100, "goal-complete bonus");
assert.ok(r2.newBadges.some((b) => b.code === "goal-first"), "goal-first badge");

let stats = await rewardStats();
assert.equal(stats.earnedCents, 1_000, "two $5 rewards");
assert.equal(stats.balanceCents, 1_000);

// --- reward spending: validation + spend ---
await assert.rejects(
  recordRewardSpend({ amountCents: 1_001, date: today }),
  /Only/, "cannot overdraw the wallet",
);
await recordRewardSpend({ amountCents: 1_000, date: today, note: "pizza" });
stats = await rewardStats();
assert.equal(stats.balanceCents, 0, "wallet emptied but not negative");
assert.equal(stats.spentCents, 1_000);

// spending a reward is a discretionary day -> kills the no-spend streak
let m = await metricsSnapshot();
assert.equal(m.noSpendStreak, 0, "reward spend breaks the streak today");
assert.ok(m.setAsideCount >= 2 && m.goalsCompleted === 1);

// --- check-in: xp once/day, streak math, badges ---
const c1 = await checkInToday();
assert.equal(c1.loginStreak, 1);
assert.equal(c1.xpAwarded, 5);
assert.ok(c1.newBadges.some((b) => b.code === "first-log"), "first-log badge");
const c2 = await checkInToday();
assert.equal(c2.alreadyCheckedIn, true, "no double XP same day");

// simulate a fresh day: yesterday checked in, today next -> streak 2
await db.streaks.put({ key: "login", count: 1, lastDate: yesterday(today) });
const c3 = await checkInToday();
assert.equal(c3.loginStreak, 2, "streak carries across days");

// --- levels / pet ---
m = await metricsSnapshot();
assert.ok(m.totalXp >= 205, "xp accumulated");
assert.equal(levelInfo(m.totalXp).level, 3);
assert.equal(petStageForXp(m.totalXp), 1, "piglet by 200+ xp");

// --- no-spend streak when days are engaged and treat-free ---
const cleanDay = await recordSave({ goalId, amountCents: 1_000, date: today });
assert.ok(cleanDay);
// reward spend earlier today already broke it; but an ordinary expense (need) today
// stays clean. Use a needs category.
await recordExpense({ amountCents: 300, date: today, categoryId: "groceries" });
m = await metricsSnapshot();
assert.equal(m.noSpendStreak, 0, "today still broken from the reward spend");

// --- cascade delete: removes only the linked reward row ---
// (saves so far: r1 $50, r2 $50, cleanDay $10 -> 3 reward rows)
assert.equal(
  (await db.ledger.where("type").equals("rewardEarned").toArray()).length,
  3,
);
await deleteEntryCascade(r1.setAsideId);
const earnedAfter = await db.ledger.where("type").equals("rewardEarned").toArray();
assert.equal(earnedAfter.length, 2, "cascade removed only the linked reward");
assert.ok(!earnedAfter.some((r) => r.rewardOf === r1.setAsideId));
stats = await rewardStats();
assert.equal(stats.earnedCents, 600, "earned recomputed after delete");

await db.delete();
console.log("Gamification smoke OK ✓");

function yesterday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
