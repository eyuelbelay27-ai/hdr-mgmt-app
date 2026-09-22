/**
 * The twice-a-week forced pipeline check (user request). Twice a week, at
 * two admin-configurable (weekday, hour) slots in Addis local time, every
 * rep's still-open leads (not Closed/Failed) are flagged `dueForReview`,
 * and the rep can't use the CRM's lead list again until every flagged
 * lead has had a status re-confirmed.
 *
 * There's no cron/background-job infrastructure in this app, so this is
 * applied lazily: `dueSinceInstant` below is computed on every CRM read,
 * and the flagging UPDATE (see actions.ts's `applyCrmSchedule`) only ever
 * touches a lead whose `updatedAt` predates that instant — which makes it
 * naturally idempotent. A lead the rep just confirmed has a fresh
 * `updatedAt`, so it won't be re-flagged again until the *next* slot
 * rolls around, even though "now is past the most recent slot" stays true
 * for the rest of the week.
 */

/** Africa/Addis_Ababa is UTC+3 year-round — Ethiopia has never used DST. */
const BUSINESS_UTC_OFFSET_MINUTES = 180;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface CrmSchedule {
  enabled: boolean;
  day1: number; // 0 (Sun) – 6 (Sat)
  hour1: number; // 0 – 23, Addis local time
  day2: number;
  hour2: number;
}

function clampDay(day: unknown): number {
  const n = Math.trunc(Number(day));
  return Number.isFinite(n) && n >= 0 && n <= 6 ? n : 0;
}

function clampHour(hour: unknown): number {
  const n = Math.trunc(Number(hour));
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : 0;
}

/** Clamps whatever's stored in the DB back into range, so a bad row can't
 * produce a NaN schedule. */
export function normalizeSchedule(s: {
  enabled: unknown;
  day1: unknown;
  hour1: unknown;
  day2: unknown;
  hour2: unknown;
}): CrmSchedule {
  return {
    enabled: !!s.enabled,
    day1: clampDay(s.day1),
    hour1: clampHour(s.hour1),
    day2: clampDay(s.day2),
    hour2: clampHour(s.hour2),
  };
}

/** The most recent past occurrence of (day, hour) in Addis local time, as
 * a real UTC instant. */
function mostRecentSlotInstant(day: number, hour: number, now: Date): Date {
  // Shift `now` so its own UTC-getters read as Addis wall-clock time —
  // the same trick lib/crm/week.ts's businessToday uses.
  const addisNow = now.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000;
  const nowDay = new Date(addisNow).getUTCDay();

  const daysSince = (nowDay - day + 7) % 7;
  const slotDayStart = addisNow - daysSince * DAY_MS;
  // Truncate to that Addis day's midnight, then add the target hour.
  const slotMidnight = Math.floor(slotDayStart / DAY_MS) * DAY_MS;
  let slotAddis = slotMidnight + hour * HOUR_MS;

  if (slotAddis > addisNow) slotAddis -= WEEK_MS; // hasn't happened yet this week
  return new Date(slotAddis - BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000);
}

/**
 * The most recent point at which a review became due, or null if the
 * schedule is off. A lead last touched before this instant is overdue;
 * one touched after it is still within the current cycle.
 */
export function dueSinceInstant(schedule: CrmSchedule, now: Date = new Date()): Date | null {
  if (!schedule.enabled) return null;
  const a = mostRecentSlotInstant(schedule.day1, schedule.hour1, now);
  const b = mostRecentSlotInstant(schedule.day2, schedule.hour2, now);
  return a > b ? a : b;
}

export function formatSlot(day: number, hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${WEEKDAY_NAMES[clampDay(day)]} ${hour12}:00 ${period}`;
}
