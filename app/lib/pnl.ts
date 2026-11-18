/**
 * P&L / general ledger maths, shared by the page and the PDF.
 * An entry moves `amount` through a cash/bank account:
 *   money in  = Dr cash, Cr account     money out = Dr account, Cr cash
 * Balances are shown in each account type's normal direction (assets and
 * expenses grow with debits; liabilities, equity and income with credits).
 */
import { ETH_MONTHS, ethMonthLength, fromEth, toEth } from "@/lib/ethiopian";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export interface Account {
  id: string;
  name: string;
  type: AccountType;
}
export interface Entry {
  id: string;
  kind: "in" | "out";
  amount: number;
  cashId: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  note: string;
  ref: string | null;
  receipt: { name: string; url: string; kind: string } | null;
  createdAt: number;
}

export const TYPES: { k: AccountType; n: string; p: string; h: string }[] = [
  { k: "asset", n: "Asset", p: "Assets", h: "Cash, bank, things you own" },
  { k: "liability", n: "Liability", p: "Liabilities", h: "Money you owe" },
  { k: "equity", n: "Equity", p: "Equity", h: "Owner's capital" },
  { k: "income", n: "Income", p: "Income", h: "Sales, services" },
  { k: "expense", n: "Expense", p: "Expenses", h: "Materials, rent, salaries" },
];
export const typeName = (k: AccountType) => TYPES.find((t) => t.k === k)!.n;
const debitNormal = (k: AccountType) => k === "asset" || k === "expense";

function lines(e: Entry) {
  return e.kind === "in"
    ? [{ a: e.cashId, d: e.amount, c: 0 }, { a: e.accountId, d: 0, c: e.amount }]
    : [{ a: e.accountId, d: e.amount, c: 0 }, { a: e.cashId, d: 0, c: e.amount }];
}

/** How much `e` changes account `acc` (in that account's normal direction). */
export function effect(acc: Account | undefined, e: Entry): number {
  if (!acc) return 0;
  let v = 0;
  for (const l of lines(e)) if (l.a === acc.id) v += l.d - l.c;
  return debitNormal(acc.type) ? v : -v;
}

export function balance(acc: Account, entries: Entry[], from = "", to = "9999"): number {
  let s = 0;
  for (const e of entries) if (e.date >= from && e.date <= to) s += effect(acc, e);
  return Math.round(s * 100) / 100;
}

/** A cash ↔ bank move: both sides are asset accounts. */
export const isTransfer = (e: Entry, byId: Map<string, Account>) => byId.get(e.accountId)?.type === "asset";

// ---- periods (Ethiopian calendar; budget year = Hamle → Sene) ----
export interface Period {
  mode: "month" | "year";
  y: number;
  m: number;
}
export function range(p: Period): [string, string] {
  return p.mode === "month" ? [fromEth(p.y, p.m, 1), fromEth(p.y, p.m, ethMonthLength(p.y, p.m))] : [fromEth(p.y - 1, 11, 1), fromEth(p.y, 10, 30)];
}
export function shift(p: Period, d: number): Period {
  if (p.mode === "year") return { ...p, y: p.y + d };
  let { y, m } = p;
  m += d;
  if (m > 13) { m = 1; y++; }
  if (m < 1) { m = 13; y--; }
  return { ...p, y, m };
}
export const budgetYearOf = (iso: string) => { const e = toEth(iso); return e.m >= 11 ? e.y + 1 : e.y; };

const GMON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Hidar 9, 2019" */
export const ethStr = (iso: string) => { const e = toEth(iso); return `${ETH_MONTHS[e.m - 1]} ${e.d}, ${e.y}`; };
/** "18 Nov 2026" */
export const gregStr = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${GMON[m - 1]} ${y}`; };
export function periodLabel(p: Period): { t: string; s: string } {
  const [a, b] = range(p);
  return p.mode === "month"
    ? { t: `${ETH_MONTHS[p.m - 1]} ${p.y}`, s: `${gregStr(a)} – ${gregStr(b)}` }
    : { t: `Budget year ${p.y}`, s: `Hamle ${p.y - 1} – Sene ${p.y} · ${gregStr(a)} – ${gregStr(b)}` };
}

export const money = (v: number) => Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const sgn = (v: number) => (v < 0 ? "−" : "") + money(v);

// ---- P&L statement data (screen + PDF) ----
export interface PlSection {
  rows: { name: string; total: number; entries: { date: string; note: string; ref: string | null; v: number }[] }[];
  tot: number;
}
export function plData(p: Period, accounts: Account[], entries: Entry[]) {
  const [a, b] = range(p);
  const byId = new Map(accounts.map((x) => [x.id, x]));
  const sec = (k: AccountType): PlSection => {
    const rows = accounts
      .filter((x) => x.type === k)
      .map((x) => {
        const es = entries
          .filter((e) => e.date >= a && e.date <= b && (e.cashId === x.id || e.accountId === x.id))
          .sort((m, n) => (m.date < n.date ? -1 : m.date > n.date ? 1 : m.createdAt - n.createdAt))
          .map((e) => ({ date: e.date, note: e.note || byId.get(e.cashId === x.id ? e.accountId : e.cashId)?.name || "", ref: e.ref, v: effect(x, e) }))
          .filter((e) => e.v !== 0);
        return { name: x.name, total: Math.round(es.reduce((s, e) => s + e.v, 0) * 100) / 100, entries: es };
      })
      .filter((r) => r.entries.length)
      .sort((m, n) => n.total - m.total);
    return { rows, tot: Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100 };
  };
  const inc = sec("income"), exp = sec("expense");
  return { inc, exp, net: Math.round((inc.tot - exp.tot) * 100) / 100, label: periodLabel(p) };
}
