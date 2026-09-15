/**
 * CRM reporting weeks.
 *
 * The business picks one company-wide day of the week (CrmSettings.reportDay)
 * that closes a reporting week. A week is the seven days *ending* on that
 * day, inclusive — with a Friday report day, the week runs Saturday to
 * Friday.
 *
 * Every date here is a date, not a moment: dates are held at midnight UTC
 * and formatted in UTC, so a week boundary means the same thing on every
 * machine that renders it. "Today", though, has to mean today *in Addis* —
 * the whole team is in Ethiopia, and a report day that flipped at midnight
 * UTC would arrive at 3am local.
 */

/** Africa/Addis_Ababa is UTC+3 year-round — Ethiopia has never used DST. */
const BUSINESS_UTC_OFFSET_MINUTES = 180;

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DEFAULT_REPORT_DAY = 5; // Friday

const DAY_MS = 24 * 60 * 60 * 1000;

/** Clamps anything stored in the DB back into 0–6, so a bad row can't
 * produce a NaN week. */
export function normalizeReportDay(day: unknown): number {
  const n = Math.trunc(Number(day));
  return Number.isFinite(n) && n >= 0 && n <= 6 ? n : DEFAULT_REPORT_DAY;
}

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

export interface ReportWeek {
  /** First day covered, inclusive. */
  start: Date;
  /** Report day itself — last day covered, inclusive. */
  end: Date;
}

/** The seven days ending on `end`. */
export function weekEndingOn(end: Date): ReportWeek {
  return { start: addDays(end, -6), end };
}

/**
 * The week a report is currently owed for: the one that closed on the most
 * recent report day, today included. On the report day itself that's the
 * week ending today; the day after, it's still that same week — an
 * ungenerated report stays owed rather than quietly rolling over.
 */
export function dueReportWeek(reportDay: number, now: Date = new Date()): ReportWeek {
  const today = businessToday(now);
  const back = (today.getUTCDay() - normalizeReportDay(reportDay) + 7) % 7;
  return weekEndingOn(addDays(today, -back));
}

/** The week in progress right now — the one closing on the next report day. */
export function currentReportWeek(reportDay: number, now: Date = new Date()): ReportWeek {
  const today = businessToday(now);
  const ahead = (normalizeReportDay(reportDay) - today.getUTCDay() + 7) % 7;
  return weekEndingOn(addDays(today, ahead));
}

/** Inclusive on both ends — the range a Prisma `receivedAt` filter needs. */
export function weekRangeFilter(week: ReportWeek): { gte: Date; lt: Date } {
  return { gte: week.start, lt: addDays(week.end, 1) };
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

export function formatWeekRange(week: ReportWeek): string {
  return `${formatShortDate(week.start)} – ${formatShortDate(week.end)}, ${week.end.toLocaleDateString("en-US", {
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
