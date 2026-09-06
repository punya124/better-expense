import { db, getSettings, type BadgeRow, type Category, type LedgerEntry } from "./db";
import { toISODate } from "./format";

/** ---- XP tuning ---- */
/** Every gamification write also re-runs badge checks, which read all tables. */
const GAME_TX = [
  db.ledger,
  db.xpLog,
  db.badges,
  db.streaks,
  db.goals,
  db.categories,
  db.meta,
];

export const XP = {
  login: 5, // daily check-in
  saveBase: 5, // every set-aside
  savePerDollar: 1, // …plus per whole dollar set aside
  savePerDollarCap: 45, // so a single save tops out at 50 XP
  goalComplete: 100, // first time a goal crosses its target
} as const;

export function saveXpFor(amountCents: number): number {
  return (
    XP.saveBase +
    Math.min(XP.savePerDollarCap, Math.floor(amountCents / 100) * XP.savePerDollar)
  );
}

/** ---- Levels (derived from lifetime XP) ---- */
export interface LevelInfo {
  level: number;
  intoLevel: number;
  toNext: number;
}

export function nextXpForLevel(level: number): number {
  return 40 + (level - 1) * 55;
}

export function levelInfo(totalXp: number): LevelInfo {
  let level = 1;
  let rem = totalXp;
  let need = nextXpForLevel(level);
  while (rem >= need) {
    rem -= need;
    level += 1;
    need = nextXpForLevel(level);
  }
  return { level, intoLevel: rem, toNext: need };
}

/** ---- Pet stages (driven by lifetime XP) ---- */
export const PET_STAGES = [
  { stage: 0, label: "Egg", emoji: "🥚" },
  { stage: 1, label: "Piglet", emoji: "🐷" },
  { stage: 2, label: "Squealer", emoji: "🐽" },
  { stage: 3, label: "Chonk", emoji: "🐖" },
  { stage: 4, label: "Royal Pig", emoji: "🏅" },
] as const;

export function petStageForXp(totalXp: number): number {
  if (totalXp < 80) return 0;
  if (totalXp < 260) return 1;
  if (totalXp < 700) return 2;
  if (totalXp < 1600) return 3;
  return 4;
}

/** ---- Metrics snapshot used by badge checks ---- */
export interface Metrics {
  totalXp: number;
  totalSavedCents: number;
  setAsideCount: number;
  expenseCount: number;
  loginStreak: number;
  noSpendStreak: number;
  goalsCompleted: number;
  level: number;
}

export function gatherMetrics(
  ledger: LedgerEntry[],
  categories: Category[],
  streaks: Array<{ key: string; count: number; lastDate: string }>,
  xpTotal: number,
  goals: Array<{ id?: number; name: string; targetCents: number; archivedAt?: number | null }>,
  today: string,
): Metrics {
  const catById = new Map(categories.map((c) => [c.id, c]));

  let totalSavedCents = 0;
  let setAsideCount = 0;
  let expenseCount = 0;

  const byDay = new Map<string, { engaged: boolean; discretionary: boolean }>();
  const touched = (date: string, row: { engaged: boolean; discretionary: boolean }) => {
    const cur = byDay.get(date);
    byDay.set(
      date,
      cur
        ? { engaged: cur.engaged || row.engaged, discretionary: cur.discretionary || row.discretionary }
        : { ...row },
    );
  };

  for (const e of ledger) {
    switch (e.type) {
      case "setAside":
        totalSavedCents += e.amountCents;
        setAsideCount += 1;
        touched(e.date, { engaged: true, discretionary: false });
        break;
      case "expense": {
        expenseCount += 1;
        const cat = e.categoryId ? catById.get(e.categoryId) : undefined;
        const discretionary = cat ? cat.isDiscretionary : true;
        touched(e.date, { engaged: true, discretionary });
        break;
      }
      case "income":
        touched(e.date, { engaged: true, discretionary: false });
        break;
      case "rewardSpend":
        touched(e.date, { engaged: true, discretionary: true });
        break;
      case "rewardEarned":
        break; // bookkeeping only
    }
  }

  const savedByGoal = new Map<number, number>();
  for (const e of ledger) {
    if (e.type === "setAside" && e.goalId != null) {
      savedByGoal.set(e.goalId, (savedByGoal.get(e.goalId) ?? 0) + e.amountCents);
    }
  }
  let goalsCompleted = 0;
  for (const g of goals) {
    if (g.archivedAt) continue;
    if (g.id != null && (savedByGoal.get(g.id) ?? 0) >= g.targetCents) goalsCompleted += 1;
  }

  return {
    totalXp: xpTotal,
    totalSavedCents,
    setAsideCount,
    expenseCount,
    loginStreak: streaks.find((s) => s.key === "login")?.count ?? 0,
    noSpendStreak: noSpendStreakFromDays(byDay, today),
    goalsCompleted,
    level: levelInfo(xpTotal).level,
  };
}

/** Consecutive calendar days (ending today) that were engaged and treat-free. */
export function noSpendStreakFromDays(
  byDay: Map<string, { engaged: boolean; discretionary: boolean }>,
  today: string,
): number {
  const d = new Date(`${today}T12:00:00`);
  if (!byDay.get(today)?.engaged || byDay.get(today)?.discretionary) {
    d.setDate(d.getDate() - 1); // today broke it (or is idle); count from yesterday
  }
  let streak = 0;
  const guard = 500;
  for (let i = 0; i < guard; i++) {
    const iso = toISODate(d);
    const day = byDay.get(iso);
    if (!day?.engaged || day.discretionary) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** ---- Badge catalog ---- */
export interface BadgeDef {
  code: string;
  name: string;
  emoji: string;
  desc: string;
  check: (m: Metrics) => boolean;
}

export const BADGE_DEFS: BadgeDef[] = [
  {
    code: "first-log",
    name: "First check-in",
    emoji: "👋",
    desc: "Open the app and check in for a day.",
    check: (m) => m.loginStreak >= 1,
  },
  {
    code: "login-3",
    name: "Three in a row",
    emoji: "🔥",
    desc: "Check in three days running.",
    check: (m) => m.loginStreak >= 3,
  },
  {
    code: "login-7",
    name: "A week of momentum",
    emoji: "🚀",
    desc: "Check in seven days running.",
    check: (m) => m.loginStreak >= 7,
  },
  {
    code: "first-save",
    name: "First set-aside",
    emoji: "🐷",
    desc: "Set aside money toward a goal.",
    check: (m) => m.setAsideCount >= 1,
  },
  {
    code: "save-5",
    name: "Save again, and again",
    emoji: "🪙",
    desc: "Make five set-asides.",
    check: (m) => m.setAsideCount >= 5,
  },
  {
    code: "save-50",
    name: "Saved $50",
    emoji: "💵",
    desc: "Set aside $50 in total.",
    check: (m) => m.totalSavedCents >= 5_000,
  },
  {
    code: "save-250",
    name: "Saved $250",
    emoji: "💰",
    desc: "Set aside $250 in total.",
    check: (m) => m.totalSavedCents >= 25_000,
  },
  {
    code: "save-1000",
    name: "Four figures saved",
    emoji: "🏦",
    desc: "Set aside $1,000 in total.",
    check: (m) => m.totalSavedCents >= 100_000,
  },
  {
    code: "no-spend-3",
    name: "Treat-free, 3 days",
    emoji: "🧘",
    desc: "Three engaged days with no treats.",
    check: (m) => m.noSpendStreak >= 3,
  },
  {
    code: "no-spend-7",
    name: "A full no-treat week",
    emoji: "🌱",
    desc: "Seven engaged days with no treats.",
    check: (m) => m.noSpendStreak >= 7,
  },
  {
    code: "goal-first",
    name: "First goal crushed",
    emoji: "🎯",
    desc: "Fill a savings goal completely.",
    check: (m) => m.goalsCompleted >= 1,
  },
  {
    code: "expense-10",
    name: "On the books",
    emoji: "🧾",
    desc: "Log ten expenses.",
    check: (m) => m.expenseCount >= 10,
  },
  {
    code: "level-5",
    name: "Level 5 saver",
    emoji: "⭐",
    desc: "Reach level 5.",
    check: (m) => m.level >= 5,
  },
];

/** Read a metrics snapshot straight from the DB (outside a transaction). */
export async function metricsSnapshot(): Promise<Metrics> {
  const [ledger, categories, streaks, xpLog, goals] = await Promise.all([
    db.ledger.toArray(),
    db.categories.toArray(),
    db.streaks.toArray(),
    db.xpLog.toArray(),
    db.goals.toArray(),
  ]);
  const xpTotal = xpLog.reduce((s, x) => s + x.amount, 0);
  return gatherMetrics(
    ledger,
    categories,
    streaks.map(({ key, count, lastDate }) => ({ key, count, lastDate })),
    xpTotal,
    goals,
    toISODate(),
  );
}

/** Inside a tx: persist any badges the snapshot now satisfies. */
async function unlockBadgesTx(): Promise<BadgeRow[]> {
  const existing = new Set((await db.badges.toArray()).map((b) => b.code));
  const m = await metricsSnapshot(); // reuses db connection within the tx
  const fresh: BadgeRow[] = [];
  for (const def of BADGE_DEFS) {
    if (!existing.has(def.code) && def.check(m)) {
      const row: BadgeRow = { code: def.code, unlockedAt: Date.now() };
      await db.badges.add(row);
      fresh.push(row);
    }
  }
  return fresh;
}

/** ---- Public actions ---- */

export interface SaveResult {
  setAsideId: number;
  rewardCents: number;
  xpAwarded: number;
  newBadges: BadgeRow[];
}

/** Set aside money toward a goal: ledger entry + reward accrual + XP + badges. */
export async function recordSave(input: {
  goalId: number;
  amountCents: number;
  date: string;
  note?: string;
}): Promise<SaveResult> {
  return db.transaction("rw", GAME_TX, async () => {
      const settings = await getSettings();
      const rate = settings?.rewardRate ?? 0.1;
      const rewardCents = Math.round(input.amountCents * rate);

      const setAsideId = await db.ledger.add({
        type: "setAside",
        amountCents: input.amountCents,
        date: input.date,
        goalId: input.goalId,
        note: input.note,
        source: "manual",
        createdAt: Date.now(),
      });

      if (rewardCents > 0) {
        await db.ledger.add({
          type: "rewardEarned",
          amountCents: rewardCents,
          date: input.date,
          goalId: input.goalId,
          note: `Reward on setting aside ${input.note ?? ""}`.trim(),
          source: "manual",
          rewardOf: setAsideId,
          createdAt: Date.now(),
        });
      }

      let xpAwarded = saveXpFor(input.amountCents);

      // One-time goal-completion bonus (before/after comparison).
      const goal = await db.goals.get(input.goalId);
      if (goal && !goal.archivedAt && goal.targetCents > 0) {
        const before = await db.ledger
          .where("type")
          .equals("setAside")
          .filter((e) => e.goalId === input.goalId && e.id !== setAsideId)
          .toArray();
        const beforeTotal = before.reduce((s, e) => s + e.amountCents, 0);
        if (beforeTotal < goal.targetCents && beforeTotal + input.amountCents >= goal.targetCents) {
          // The bonus rides along in xpAwarded (logged once, below).
          xpAwarded += XP.goalComplete;
        }
      }

      await db.xpLog.add({
        amount: xpAwarded,
        reason: "save",
        date: input.date,
        createdAt: Date.now(),
      });

      const newBadges = await unlockBadgesTx();
      return { setAsideId, rewardCents, xpAwarded, newBadges };
    },
  );
}

/** Log an expense; no XP for spending, but badge state refreshes. */
export async function recordExpense(input: {
  amountCents: number;
  date: string;
  categoryId?: string;
  merchant?: string;
}): Promise<{ id: number; newBadges: BadgeRow[] }> {
  return db.transaction("rw", GAME_TX, async () => {
      const id = await db.ledger.add({
        type: "expense",
        amountCents: input.amountCents,
        date: input.date,
        categoryId: input.categoryId,
        merchant: input.merchant,
        source: "manual",
        createdAt: Date.now(),
      });
      const newBadges = await unlockBadgesTx();
      return { id, newBadges };
    },
  );
}

/** Daily check-in: advances the login streak and pays its XP once per day. */
export async function checkInToday(): Promise<{
  loginStreak: number;
  xpAwarded: number;
  newBadges: BadgeRow[];
  alreadyCheckedIn: boolean;
}> {
  const date = toISODate();
  return db.transaction("rw", GAME_TX, async () => {
      const row = await db.streaks.get("login");
      if (row && row.lastDate === date) {
        return { loginStreak: row.count, xpAwarded: 0, newBadges: [], alreadyCheckedIn: true };
      }
      const y = new Date(`${date}T12:00:00`);
      y.setDate(y.getDate() - 1);
      const count = row && row.lastDate === toISODate(y) ? row.count + 1 : 1;
      await db.streaks.put({ key: "login", count, lastDate: date });
      await db.xpLog.add({ amount: XP.login, reason: "login", date, createdAt: Date.now() });
      const newBadges = await unlockBadgesTx();
      return { loginStreak: count, xpAwarded: XP.login, newBadges, alreadyCheckedIn: false };
    },
  );
}

/** Delete an entry, cascading to any reward rows it minted. XP is not clawed back. */
export async function deleteEntryCascade(id: number): Promise<void> {
  await db.transaction("rw", db.ledger, async () => {
    const entry = await db.ledger.get(id);
    if (!entry) return;
    if (entry.type === "setAside") {
      await db.ledger.where("rewardOf").equals(id).delete();
    }
    await db.ledger.delete(id);
  });
}
