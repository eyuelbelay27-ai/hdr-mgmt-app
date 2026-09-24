import { addDays, addisWallClock, attendanceToday, formatAddisTime } from "@/lib/attendance/day";
import { isLate, isEarly, type AttendanceSchedule } from "@/lib/attendance/settings";
import type { AttendanceDashboardRow } from "./actions";

/** Client-safe re-derivation of "late/early", computed fresh against
 * whatever schedule is currently loaded rather than baked in at fetch
 * time — so changing the expected times updates every already-loaded row
 * instantly, no refetch needed. Reads times as Addis wall-clock, never
 * the viewer's own machine timezone (same trick as lib/crm/week.ts). */
export function rowFlags(row: AttendanceDashboardRow, schedule: AttendanceSchedule) {
  const checkInLate =
    !!row.checkInAt &&
    (() => {
      const { hour, minute } = addisWallClock(row.checkInAt!);
      return isLate(hour, minute, schedule.expectedCheckInHour, schedule.expectedCheckInMinute);
    })();
  const checkOutEarly =
    !!row.checkOutAt &&
    (() => {
      const { hour, minute } = addisWallClock(row.checkOutAt!);
      return isEarly(hour, minute, schedule.expectedCheckOutHour, schedule.expectedCheckOutMinute);
    })();
  return { checkInLate, checkOutEarly };
}

/** Monday through today (never into the future — a day that hasn't
 * happened yet can't be marked "Absent"), capped at this Sunday. */
export function thisWeekRange(): { start: Date; end: Date } {
  const today = attendanceToday();
  const dayOfWeek = today.getUTCDay(); // 0 Sun .. 6 Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = addDays(today, mondayOffset);
  return { start, end: today };
}

export function todayRange(): { start: Date; end: Date } {
  const today = attendanceToday();
  return { start: today, end: today };
}

export { formatAddisTime };
