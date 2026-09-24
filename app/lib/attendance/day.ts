/**
 * Attendance date helpers — same Addis-local-day convention as
 * lib/crm/week.ts's businessToday, reused here so "today" means the same
 * thing across the app: one AttendanceRecord row per employee per Addis
 * calendar day, keyed by that day's midnight held as UTC.
 */

/** Africa/Addis_Ababa is UTC+3 year-round — Ethiopia has never used DST. */
const BUSINESS_UTC_OFFSET_MINUTES = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/** Today's date in Addis Ababa, as midnight UTC — the value AttendanceRecord.date stores. */
export function attendanceToday(now: Date = new Date()): Date {
  return startOfUtcDay(new Date(now.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** A moment (e.g. checkInAt) as Addis wall-clock hour/minute, for
 * comparing against AttendanceSettings' expected times. */
export function addisWallClock(d: Date): { hour: number; minute: number } {
  const local = new Date(d.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000);
  return { hour: local.getUTCHours(), minute: local.getUTCMinutes() };
}

/** Date + time of a real moment, shown in Addis local time, 12-hour clock —
 * matches lib/crm/week.ts's formatSeenAt. */
export function formatAddisMoment(d: Date): string {
  const local = new Date(d.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000);
  const date = local.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const hh = local.getUTCHours();
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  const period = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${date}, ${hour12}:${mm} ${period}`;
}

/** Just the time-of-day part, e.g. "9:03 AM". */
export function formatAddisTime(d: Date): string {
  const { hour, minute } = addisWallClock(d);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
