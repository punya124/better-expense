import Dexie, { type Table } from "dexie";

export type LedgerType =
  | "expense"
  | "income"
  | "setAside"
  | "rewardEarned"
  | "rewardSpend";
export type LedgerSource = "manual" | "plaid" | "import";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string; // hex, used inline (avoids Tailwind purge pitfalls)
  isDiscretionary: boolean; // a "want"; drives no-spend rules
}

export interface LedgerEntry {
  id?: number;
  type: LedgerType;
  /** Whole dollars or sub-unit count in cents. Always positive. */
  amountCents: number;
  /** Local calendar date as YYYY-MM-DD (day boundaries ignore timezone). */
  date: string;
  categoryId?: string;
  goalId?: number;
  merchant?: string;
  note?: string;
  source: LedgerSource;
  /** Dedupe key for bank-synced transactions. */
  plaidTransactionId?: string;
  /** For rewardEarned rows: ledger id of the setAside that produced them. */
  rewardOf?: number;
  createdAt: number;
}

export interface Goal {
  id?: number;
  name: string;
  targetCents: number;
  emoji?: string;
  deadline?: string;
  archivedAt?: number | null;
  createdAt: number;
}

export interface XpEvent {
  id?: number;
  amount: number;
  reason: string;
  date: string;
  createdAt: number;
}

export interface StreakRow {
  key: string; // "login" | "noSpend"
  count: number;
  lastDate: string;
}

export interface BadgeRow {
  code: string;
  unlockedAt: number;
}

export interface PlaidItem {
  id?: number;
  accessToken: string;
  institution: string;
  cursor?: string;
  lastSyncedAt?: number;
}

export interface AppSettings {
  deviceId: string;
  rewardRate: number; // fraction of a set-aside that becomes reward credit
  petName: string;
  petStage: number; // 0 egg .. n adult (driven by gamification)
  seededAt: number;
}

interface MetaRow {
  key: string;
  value: unknown;
}

class BetterExpenseDB extends Dexie {
  meta!: Table<MetaRow, string>;
  categories!: Table<Category, string>;
  ledger!: Table<LedgerEntry, number>;
  goals!: Table<Goal, number>;
  xpLog!: Table<XpEvent, number>;
  streaks!: Table<StreakRow, string>;
  badges!: Table<BadgeRow, string>;
  plaidItems!: Table<PlaidItem, number>;

  constructor() {
    super("better-expense");
    this.version(1).stores({
      meta: "key",
      categories: "id, name",
      ledger: "++id, date, type, goalId, plaidTransactionId",
      goals: "++id, name",
      xpLog: "++id, date",
      streaks: "key, lastDate",
      badges: "code",
      plaidItems: "++id",
    });
    // v2: index rewardOf so cascade deletes can find minted reward rows.
    this.version(2).stores({
      ledger: "++id, date, type, goalId, plaidTransactionId, rewardOf",
    });
  }
}

export const db = new BetterExpenseDB();

const SETTINGS_KEY = "app";

export async function getSettings(): Promise<AppSettings | undefined> {
  const row = await db.meta.get(SETTINGS_KEY);
  return row?.value as AppSettings | undefined;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = (await getSettings()) ?? defaultSettings();
  const next = { ...current, ...patch };
  await db.meta.put({ key: SETTINGS_KEY, value: next });
  return next;
}

function defaultSettings(): AppSettings {
  return {
    deviceId: crypto.randomUUID(),
    rewardRate: 0.1,
    petName: "Peanut",
    petStage: 0,
    seededAt: Date.now(),
  };
}

/**
 * First-run setup: seed categories + settings. Idempotent. Client-only.
 * Gamification unlocks are a separate concern and run later (see gamification.ts).
 */
export async function initDB(): Promise<void> {
  await db.open();
  const count = await db.categories.count();
  if (count === 0) {
    await db.transaction("rw", db.categories, db.meta, async () => {
      const defaults = [
        // Needs (non-discretionary)
        ["groceries", "Groceries", "🛒", "#22c55e", false],
        ["transport", "Transport", "🚌", "#3b82f6", false],
        ["rent-home", "Rent & Home", "🏠", "#0ea5e9", false],
        ["utilities", "Utilities", "💡", "#eab308", false],
        ["health", "Health", "💊", "#10b981", false],
        ["insurance", "Insurance", "🛡️", "#14b8a6", false],
        ["family-kids", "Family & Kids", "🧸", "#fb923c", false],
        ["personal-care", "Personal care", "🧴", "#a3a3a3", false],
        ["other-bills", "Bills & other", "🧾", "#94a3b8", false],
        // Wants (discretionary — these count against no-spend days)
        ["dining-out", "Dining out", "🍔", "#f97316", true],
        ["coffee", "Coffee & snacks", "☕", "#a16207", true],
        ["shopping", "Shopping", "🛍️", "#ec4899", true],
        ["entertainment", "Entertainment", "🎬", "#8b5cf6", true],
        ["travel", "Travel", "✈️", "#06b6d4", true],
        ["gifts", "Gifts", "🎁", "#f43f5e", true],
        ["hobbies", "Hobbies & games", "🎮", "#d946ef", true],
        ["subscriptions", "Subscriptions", "📺", "#64748b", true],
      ] as const;
      for (const [id, name, icon, color, isDiscretionary] of defaults) {
        await db.categories.put({ id, name, icon, color, isDiscretionary });
      }
      if (!(await db.meta.get(SETTINGS_KEY))) {
        await db.meta.put({ key: SETTINGS_KEY, value: defaultSettings() });
      }
    });
  }
}
