import { formatEthiopianDate, toEthiopian } from "@/lib/payroll/ethiopian";

/** Addis Ababa is UTC+3 with no DST, so a fixed offset is exact. */
const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The Addis calendar day containing `at`, as that day's UTC midnight —
 * the canonical workDate stored on attendance rows. */
export function addisWorkDate(at: Date = new Date()): Date {
  const a = new Date(at.getTime() + ADDIS_OFFSET_MS);
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()));
}

/** Minutes after Addis midnight. */
export function addisMinutes(at: Date = new Date()): number {
  const a = new Date(at.getTime() + ADDIS_OFFSET_MS);
  return a.getUTCHours() * 60 + a.getUTCMinutes();
}

/** 0 = Sunday, in Addis. */
export function addisWeekday(at: Date = new Date()): number {
  return new Date(at.getTime() + ADDIS_OFFSET_MS).getUTCDay();
}

/** The instant for "HH:MM" Addis time on a workDate (UTC midnight). */
export function addisInstant(workDate: Date, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return new Date(workDate.getTime() + (h * 60 + min) * 60000 - ADDIS_OFFSET_MS);
}

export function minutesLabel(total: number): string {
  const h = Math.floor(total / 60);
  const m = String(total % 60).padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${period}`;
}

/** "8:42 AM" in Addis time. */
export function addisTimeLabel(at: Date | null | undefined): string {
  return at ? minutesLabel(addisMinutes(at)) : "—";
}

/** "HH:MM" (24h) in Addis time, for <input type="time">. */
export function addisHHMM(at: Date | null | undefined): string {
  if (!at) return "";
  const t = addisMinutes(at);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function ethiopianDateLabel(workDate: Date): string {
  return formatEthiopianDate(toEthiopian(workDate));
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
