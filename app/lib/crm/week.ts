/**
 * CRM date helpers.
 *
 * Leads are filtered by *when they were received* (`receivedAt`), never by
 * when the row was created — so a lead entered late still lands in the
 * week/month it actually came in on. Every date here is a date, not a
 * moment: dates are held at midnight UTC and formatted in UTC, so a
 * boundary means the same thing on every machine that renders it. "Today",
 * though, has to mean today *in Addis* — the whole team is in Ethiopia, and
 * a boundary that flipped at midnight UTC would arrive at 3am local.
 */

/** Africa/Addis_Ababa is UTC+3 year-round — Ethiopia has never used DST. */
const BUSINESS_UTC_OFFSET_MINUTES = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "yyyy-mm-dd" → midnight UTC on that day. Null if unparseable. */
export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Midnight-UTC Date → "yyyy-mm-dd", the format <input type="date"> wants. */
export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Strips the time off an instant, keeping the UTC day it falls on. */
export function startOfUtcDay(d: Date): Date {
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Today's date in Addis Ababa, as midnight UTC. */
export function businessToday(now: Date = new Date()): Date {
  return startOfUtcDay(new Date(now.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000));
}

export interface DateRange {
  /** First day covered, inclusive. */
  start: Date;
  /** Last day covered, inclusive. */
  end: Date;
}

/** Inclusive-end range → the half-open range a Prisma `receivedAt` filter needs. */
export function rangeFilter(range: DateRange): { gte: Date; lt: Date } {
  return { gte: range.start, lt: addDays(range.end, 1) };
}

// -----------------------------------------------------------------------
// ISO week (Monday–Sunday) — what <input type="week"> speaks natively.
// -----------------------------------------------------------------------

/** The ISO week (year + 1-53 week number) a date falls in, per ISO 8601:
 * weeks start Monday, and week 1 is the week containing the year's first
 * Thursday. */
export function isoWeekOf(date: Date): { year: number; week: number } {
  const d = startOfUtcDay(date);
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  const thursday = addDays(d, 3 - dayNum);
  const firstThursday = (() => {
    const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
    const jan4Day = (jan4.getUTCDay() + 6) % 7;
    return addDays(jan4, 3 - jan4Day);
  })();
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { year: thursday.getUTCFullYear(), week };
}

/** "yyyy-Www" for the ISO week a date falls in — the value <input
 * type="week"> reads and writes. */
export function toWeekInputValue(date: Date): string {
  const { year, week } = isoWeekOf(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** "yyyy-Www" → the Monday–Sunday range it names. Null if unparseable. */
export function parseWeekRange(value: string): DateRange | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = addDays(jan4, -jan4Day);
  const start = addDays(week1Monday, (week - 1) * 7);
  return { start, end: addDays(start, 6) };
}

// -----------------------------------------------------------------------
// Calendar month — what <input type="month"> speaks natively.
// -----------------------------------------------------------------------

/** "yyyy-mm" for the month a date falls in. */
export function toMonthInputValue(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** "yyyy-mm" → the full calendar month it names. Null if unparseable. */
export function parseMonthRange(value: string): DateRange | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this one
  return { start, end };
}

export function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatRange(range: DateRange): string {
  return `${formatShortDate(range.start)} – ${formatShortDate(range.end)}, ${range.end.toLocaleDateString("en-US", {
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

/** Date + time of a real moment (e.g. when a lead was first seen), shown in
 * Addis local time with a 12-hour clock, matching Overtime Control. */
export function formatSeenAt(d: Date): string {
  const local = new Date(d.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000);
  const date = local.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const hh = local.getUTCHours();
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  const period = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${date}, ${hour12}:${mm} ${period}`;
}
