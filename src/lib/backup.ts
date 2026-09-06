import { db } from "./db";

export const BACKUP_SCHEMA = 1;
const APP_TAG = "better-expense";

interface BackupFile {
  app: typeof APP_TAG;
  schema: number;
  exportedAt: number;
  data: Record<string, unknown[]>;
}

interface EncryptedFile {
  app: typeof APP_TAG;
  encrypted: true;
  salt: string;
  iv: string;
  ct: string;
}

/** Snapshot every table. Pure data — the phone owns it all. */
async function dumpRows(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    data[table.name] = await table.toArray();
  }
  return { app: APP_TAG, schema: BACKUP_SCHEMA, exportedAt: Date.now(), data };
}

/** ---- Optional AES-GCM encryption (WebCrypto) ---- */
const te = new TextEncoder();
const td = new TextDecoder();

function bytesToB64(u: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < u.length; i += CHUNK) {
    bin += String.fromCharCode(...u.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

/** View a typed array as a plain ArrayBuffer (WebCrypto wants BufferSource). */
function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

async function deriveKey(pass: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    ab(te.encode(pass)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ab(salt), iterations: 150_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptBackup(pass: string): Promise<EncryptedFile> {
  const file = await dumpRows();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ab(iv) },
    key,
    ab(te.encode(JSON.stringify(file))),
  );
  return {
    app: APP_TAG,
    encrypted: true,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ct: bytesToB64(new Uint8Array(ct)),
  };
}

async function decryptBackup(blob: string, pass: string): Promise<BackupFile> {
  const parsed = JSON.parse(blob) as EncryptedFile;
  const key = await deriveKey(pass, b64ToBytes(parsed.salt));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ab(b64ToBytes(parsed.iv)) },
      key,
      ab(b64ToBytes(parsed.ct)),
    );
    return JSON.parse(td.decode(plain)) as BackupFile;
  } catch {
    throw new Error("Wrong password or a damaged file.");
  }
}

/** Serialize a backup to its file content. Empty passphrase = plain JSON. */
export async function buildBackupFile(pass?: string): Promise<string> {
  if (pass) return JSON.stringify(await encryptBackup(pass));
  return JSON.stringify(await dumpRows());
}

/** Parse + verify a backup string, decrypting if needed. */
async function parseBackup(blob: string, pass?: string): Promise<BackupFile> {
  const parsed = JSON.parse(blob) as BackupFile | EncryptedFile;
  if (parsed.app !== APP_TAG) {
    throw new Error("That doesn't look like a Better Expense backup.");
  }
  if ("encrypted" in parsed) {
    if (!pass) throw new Error("This backup is encrypted — enter its password.");
    return decryptBackup(blob, pass);
  }
  const file = parsed as BackupFile;
  if (file.schema > BACKUP_SCHEMA) {
    throw new Error("That backup was made by a newer app version. Update the app first.");
  }
  return file;
}

export interface ImportSummary {
  tables: Array<{ name: string; rows: number }>;
}

/** Wipe and restore from a backup, atomically across all tables. */
export async function importBackup(blob: string, pass?: string): Promise<ImportSummary> {
  const file = await parseBackup(blob, pass);
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      const rows = file.data[table.name];
      await table.clear();
      if (Array.isArray(rows) && rows.length) await table.bulkPut(rows as never[]);
    }
  });
  const names = new Set(db.tables.map((t) => t.name));
  return {
    tables: Object.keys(file.data)
      .filter((name) => names.has(name))
      .map((name) => ({ name, rows: (file.data[name] as unknown[]).length })),
  };
}

/** Trigger a browser download of a text payload. */
export function downloadText(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function buildLedgerCsv(): Promise<string> {
  const rows = await db.ledger.orderBy("date").toArray();
  const esc = (s?: string) => {
    const v = s ?? "";
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = rows.map((r) =>
    [
      r.type,
      r.date,
      r.amountCents,
      esc(r.merchant),
      esc(r.note),
      r.categoryId ?? "",
      r.goalId ?? "",
      r.source,
      r.createdAt,
      r.plaidTransactionId ?? "",
    ].join(","),
  );
  return [
    "type,date,amount_cents,merchant,note,category_id,goal_id,source,created_at,plaid_id",
    ...lines,
  ].join("\n");
}
