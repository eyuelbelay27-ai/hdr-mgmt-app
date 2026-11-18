/**
 * Cash Book maths and periods, shared by the page and the PDF.
 * Cash in adds to cash on hand, cash out takes from it; the opening
 * balance from Settings comes before every entry.
 */
import { ETH_MONTHS, ethMonthLength, fromEth, toEth } from "@/lib/ethiopian";
import { ethStr, gregStr, money } from "@/lib/pnl";

export { ethStr, gregStr, money };

export interface CbEntry {
  id: string;
  type: "in" | "out";
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  bank: string;
  category: string | null;
  ref: string | null;
  createdBy: string;
  createdAt: number;
}
export interface CbSettings {
  banks: string[];
  categories: string[];
  opening: number;
  openingDate: string | null;
  company: string;
  address: string;
  preparedBy: string;
}
export const CB_DEFAULTS: CbSettings = {
  banks: ["Commercial Bank of Ethiopia", "Awash Bank", "Dashen Bank", "Bank of Abyssinia"],
  categories: ["Materials", "Transport", "Fuel", "Salary & wages", "Food & refreshment", "Office supplies", "Utilities", "Other"],
  opening: 0,
  openingDate: null,
  company: "Hadar Trading PLC",
  address: "Hayahulet, Bata Complex Building, 2nd Floor, Addis Ababa",
  preparedBy: "",
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
export const signed = (e: CbEntry) => (e.type === "in" ? e.amount : -e.amount);
export const byDateAsc = (a: CbEntry, b: CbEntry) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1);

/** Running balance after each entry, and the balance after all of them. */
export function runningBalances(entries: CbEntry[], opening: number) {
  let b = opening;
  const map = new Map<string, number>();
  for (const e of [...entries].sort(byDateAsc)) { b = r2(b + signed(e)); map.set(e.id, b); }
  return { map, total: b };
}

export function periodData(entries: CbEntry[], opening: number, from: string, to: string) {
  let open = opening;
  for (const e of entries) if (e.date < from) open += signed(e);
  open = r2(open);
  let b = open, tin = 0, tout = 0;
  const byBank: Record<string, { in: number; out: number }> = {};
  const rows = entries.filter((e) => e.date >= from && e.date <= to).sort(byDateAsc).map((e) => {
    if (e.type === "in") tin += e.amount; else tout += e.amount;
    b = r2(b + signed(e));
    const k = (byBank[e.bank] ??= { in: 0, out: 0 });
    k[e.type] = r2(k[e.type] + e.amount);
    return { ...e, bal: b };
  });
  return { rows, open, tin: r2(tin), tout: r2(tout), close: b, byBank };
}
export type CbPeriodData = ReturnType<typeof periodData>;

// ---- periods: Ethiopian or Gregorian months ----
export type Cal = "ec" | "gc";
export interface Month { cal: Cal; y: number; m: number }
const GMONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthOf(cal: Cal, iso: string): Month {
  if (cal === "ec") { const e = toEth(iso); return { cal, y: e.y, m: e.m }; }
  const [y, m] = iso.split("-").map(Number);
  return { cal, y, m };
}
export function monthRange(p: Month): [string, string] {
  if (p.cal === "ec") return [fromEth(p.y, p.m, 1), fromEth(p.y, p.m, ethMonthLength(p.y, p.m))];
  const last = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
  return [`${p.y}-${pad(p.m)}-01`, `${p.y}-${pad(p.m)}-${pad(last)}`];
}
export function shiftMonth(p: Month, d: number): Month {
  const max = p.cal === "ec" ? 13 : 12;
  let { y, m } = p;
  m += d;
  if (m > max) { m = 1; y++; }
  if (m < 1) { m = max; y--; }
  return { ...p, y, m };
}
/** Same moment, other calendar: the month that holds this month's middle day. */
export function switchCal(p: Month, cal: Cal): Month {
  if (p.cal === cal) return p;
  const [a] = monthRange(p);
  const d = new Date(`${a}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 14);
  return monthOf(cal, d.toISOString().slice(0, 10));
}
export const monthName = (p: Month) => (p.cal === "ec" ? `${ETH_MONTHS[p.m - 1]} ${p.y}` : `${GMONTHS[p.m - 1]} ${p.y}`);

/** "dd/mm/yyyy" in each calendar. */
export const gcShort = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
export const ecShort = (iso: string) => { const e = toEth(iso); return `${pad(e.d)}/${pad(e.m)}/${e.y}`; };

/** "Hidar 2019" or "Hidar – Tahsas 2019" for a date range. */
export function ecSpan(a: string, b: string) {
  const x = toEth(a), y = toEth(b);
  if (x.y === y.y && x.m === y.m) return `${ETH_MONTHS[x.m - 1]} ${x.y}`;
  return x.y === y.y ? `${ETH_MONTHS[x.m - 1]} – ${ETH_MONTHS[y.m - 1]} ${y.y}` : `${ETH_MONTHS[x.m - 1]} ${x.y} – ${ETH_MONTHS[y.m - 1]} ${y.y}`;
}
export function gcSpan(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number), [by, bm] = b.split("-").map(Number);
  if (ay === by && am === bm) return `${GMONTHS[am - 1]} ${ay}`;
  return ay === by ? `${GMONTHS[am - 1].slice(0, 3)} – ${GMONTHS[bm - 1].slice(0, 3)} ${by}` : `${GMONTHS[am - 1].slice(0, 3)} ${ay} – ${GMONTHS[bm - 1].slice(0, 3)} ${by}`;
}
/** Main label in the chosen calendar, the other one underneath. */
export function spanLabels(cal: Cal, a: string, b: string) {
  return cal === "ec" ? { t: ecSpan(a, b), s: `${gregStr(a)} – ${gregStr(b)}` } : { t: gcSpan(a, b), s: `${ethStr(a)} – ${ethStr(b)}` };
}
