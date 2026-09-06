const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** cents -> "$12.50" */
export function fmtMoney(cents: number): string {
  return currency.format(cents / 100);
}

/** cents -> "12.50" (no symbol), used in inputs */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** "12.50" or "12" -> cents. Returns NaN for garbage/negative/zero. */
export function inputToCents(input: string): number {
  const clean = input.replace(/[^0-9.]/g, "");
  if (!clean || /[.]{2}/.test(clean)) return NaN;
  const value = Math.round(parseFloat(clean) * 100);
  return Number.isFinite(value) && value > 0 ? value : NaN;
}

/** Local calendar date YYYY-MM-DD (no timezone shifting). */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate();
}

/** First day of the month containing `iso`, e.g. 2026-09-01 */
export function monthStartISO(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Human label for a date: "Today", "Yesterday", or "Mon, Sep 6". */
export function dayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === toISODate(y)) return "Yesterday";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function monthLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
