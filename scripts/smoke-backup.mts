// Backup/restore roundtrip against fake-indexeddb + WebCrypto (Node 22).
// Run: npx tsx scripts/smoke-backup.mts
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { initDB, db } from "../src/lib/db";
import { addEntry } from "../src/lib/ledger";
import { buildBackupFile, importBackup } from "../src/lib/backup";
import { todayISO } from "../src/lib/format";

await initDB();
const today = todayISO();
await addEntry({ type: "expense", amountCents: 1234, date: today, categoryId: "coffee" });
await addEntry({ type: "setAside", amountCents: 500_000, date: today });
const before = await db.ledger.count();

const plain = await buildBackupFile();
assert.match(plain, /"better-expense"/, "plain file is tagged JSON");
const enc = await buildBackupFile("hunter2");
assert.doesNotMatch(enc, /1234/, "encrypted file hides the contents");

await assert.rejects(importBackup(enc, "wrong"), /password|damaged/i, "wrong password");
await assert.rejects(importBackup("{}"), /doesn't look/, "garbage rejected");

let s = await importBackup(enc, "hunter2");
assert.equal(s.tables.find((t) => t.name === "ledger")?.rows, before, "encrypted restore");
assert.equal(await db.ledger.count(), before);

s = await importBackup(plain);
assert.equal(await db.ledger.count(), before, "plain restore is idempotent");
const first = await db.ledger.where("type").equals("expense").first();
assert.equal(first?.amountCents, 1234, "data survived roundtrip");

await db.delete();
console.log("Backup smoke OK ✓");
