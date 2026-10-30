/**
 * Ethiopian calendar helpers (same arithmetic as the Workshop Schedule page).
 * Dates are stored as Gregorian "YYYY-MM-DD" and shown in the Ethiopian
 * calendar. Safe to use in the browser and on the server.
 */
export const ETH_MONTHS = ["Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit", "Megabit", "Miyazya", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"];
export const ETH_MONTHS_SHORT = ["Mes", "Tik", "Hid", "Tah", "Tir", "Yek", "Meg", "Miy", "Gin", "Sen", "Ham", "Neh", "Pag"];

const pad = (n: number) => String(n).padStart(2, "0");

export interface EthDate {
  y: number;
  m: number;
  d: number;
}

/** "2026-11-13" → { y: 2019, m: 3, d: 4 } (4 Hidar 2019) */
export function toEth(iso: string): EthDate {
  const [y, m, d] = iso.split("-").map(Number);
  const j = Math.floor(Date.UTC(y, m - 1, d) / 864e5) + 2440588;
  const r = (((j - 1723856) % 1461) + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return { y: 4 * Math.floor((j - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460), m: Math.floor(n / 30) + 1, d: (n % 30) + 1 };
}

/** Ethiopian y/m/d → Gregorian "YYYY-MM-DD" */
export function fromEth(y: number, m: number, d: number): string {
  const j = 1723856 + 365 + 365 * (y - 1) + Math.floor(y / 4) + 30 * m + d - 31;
  const t = new Date((j - 2440588) * 864e5);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Days in an Ethiopian month (Pagume has 5, or 6 in a leap year). */
export const ethMonthLength = (y: number, m: number) => (m < 13 ? 30 : y % 4 === 3 ? 6 : 5);

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });

/** "Fri 4 Hidar" */
export function ethFull(iso: string): string {
  const e = toEth(iso);
  return `${weekday(iso)} ${e.d} ${ETH_MONTHS[e.m - 1]}`;
}

/** "Fri 4 Hidar 2019" */
export function ethLong(iso: string): string {
  const e = toEth(iso);
  return `${weekday(iso)} ${e.d} ${ETH_MONTHS[e.m - 1]} ${e.y}`;
}

/** "Fri 4 Hid", "Sat 21 Tik OT" — a schedule slot "YYYY-MM-DD|day" / "|ot". */
export function ethSlot(k: string): string {
  const [iso, shift] = k.split("|");
  const e = toEth(iso);
  return `${weekday(iso)} ${e.d} ${ETH_MONTHS_SHORT[e.m - 1]}${shift === "ot" ? " OT" : ""}`;
}

/** Today in Addis Ababa as "YYYY-MM-DD". */
export function addisToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" });
}

/** Checks a requested deadline ("YYYY-MM-DD", today or later); returns an error message or null. */
export function requestedDeadlineError(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(new Date(iso).getTime())) return "Choose the deadline.";
  if (iso < addisToday()) return "The deadline can't be in the past.";
  return null;
}
