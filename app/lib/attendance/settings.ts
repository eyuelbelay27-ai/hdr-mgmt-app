import { prisma } from "@/lib/prisma";

export interface AttendanceSchedule {
  expectedCheckInHour: number;
  expectedCheckInMinute: number;
  expectedCheckOutHour: number;
  expectedCheckOutMinute: number;
}

function clampHour(n: unknown): number {
  const v = Math.trunc(Number(n));
  return Number.isFinite(v) && v >= 0 && v <= 23 ? v : 0;
}

function clampMinute(n: unknown): number {
  const v = Math.trunc(Number(n));
  return Number.isFinite(v) && v >= 0 && v <= 59 ? v : 0;
}

export function normalizeSchedule(s: {
  expectedCheckInHour: unknown;
  expectedCheckInMinute: unknown;
  expectedCheckOutHour: unknown;
  expectedCheckOutMinute: unknown;
}): AttendanceSchedule {
  return {
    expectedCheckInHour: clampHour(s.expectedCheckInHour),
    expectedCheckInMinute: clampMinute(s.expectedCheckInMinute),
    expectedCheckOutHour: clampHour(s.expectedCheckOutHour),
    expectedCheckOutMinute: clampMinute(s.expectedCheckOutMinute),
  };
}

/** Falls back to the schema's own defaults (9:00 AM / 5:00 PM) if the
 * singleton row was never created. */
export async function getAttendanceSchedule(): Promise<AttendanceSchedule> {
  const s = await prisma.attendanceSettings.findUnique({ where: { id: "singleton" } });
  return normalizeSchedule(
    s ?? { expectedCheckInHour: 9, expectedCheckInMinute: 0, expectedCheckOutHour: 17, expectedCheckOutMinute: 0 }
  );
}

/** Whether a check-in/check-out moment counts as late/early against the
 * configured schedule — comparison only, never blocks the actual action. */
export function isLate(actualHour: number, actualMinute: number, expectedHour: number, expectedMinute: number): boolean {
  return actualHour * 60 + actualMinute > expectedHour * 60 + expectedMinute;
}

export function isEarly(actualHour: number, actualMinute: number, expectedHour: number, expectedMinute: number): boolean {
  return actualHour * 60 + actualMinute < expectedHour * 60 + expectedMinute;
}
