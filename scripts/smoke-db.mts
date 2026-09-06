// Exercises the local data layer against fake-indexeddb (no browser needed).
// Run: npx tsx scripts/smoke-db.ts
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { initDB, db, getSettings } from "../src/lib/db";
import { addEntry, deleteEntry, entriesInMonth } from "../src/lib/ledger";
import { todayISO } from "../src/lib/format";

await initDB();
assert.ok((await db.categories.count()) > 0, "categories seeded");
const cat = await db.categories.get("coffee");
assert.equal(cat?.isDiscretionary, true, "coffee is discretionary");

const settings = await getSettings();
assert.ok(settings, "settings seeded");
assert.equal(settings.petName, "Peanut");

// Seed via second open-path (idempotence): running initDB again changes nothing.
await initDB();
assert.equal(await db.categories.count(), 16, "seed idempotent");

const today = todayISO();
const id = await addEntry({
  type: "setAside",
  amountCents: 10000,
  date: today,
});
assert.ok(id > 0);

const id2 = await addEntry({
  type: "expense",
  amountCents: 725,
  date: today,
  categoryId: "coffee",
  merchant: "Blue Bottle",
});
assert.ok(id2 > 0);

const rows = await entriesInMonth(today);
assert.equal(rows.length, 2, "month query sees both entries");
assert.equal(rows.find((r) => r.id === id)?.amountCents, 10000);

// Plaid dedupe index usable.
await db.ledger.add({
  type: "expense",
  amountCents: 999,
  date: today,
  source: "plaid",
  plaidTransactionId: "txn_x",
  createdAt: Date.now(),
});
const dupe = await db.ledger
  .where("plaidTransactionId")
  .equals("txn_x")
  .first();
assert.equal(dupe?.plaidTransactionId, "txn_x", "plaid txn id query works");

await deleteEntry(id);
assert.equal((await entriesInMonth(today)).length, 2, "delete removes set-aside");

await db.delete();
console.log("DB smoke OK ✓");
