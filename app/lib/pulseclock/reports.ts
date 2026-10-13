import { prisma } from "@/lib/prisma";
import { ETHIOPIAN_MONTH_NAMES, daysInEthiopianMonth, ethiopianToday, toGregorian } from "@/lib/payroll/ethiopian";
import { addisHHMM, addisWorkDate, ethiopianDateLabel } from "./time";
import type { PulseRules } from "./settings";

const DAY_MS = 86400000;

/** An Ethiopian month, 1–13 (Pagume included — people work in Pagume). */
export interface PulseMonth {
  year: number;
  month: number;
}

export function currentPulseMonth(): PulseMonth {
  const t = ethiopianToday();
  return { year: t.year, month: t.month };
}

export function parsePulseMonth(value: unknown): PulseMonth | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(value ?? ""));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return year >= 1990 && year <= 2100 && month >= 1 && month <= 13 ? { year, month } : null;
}

export function pulseMonthKey({ year, month }: PulseMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function pulseMonthLabel({ year, month }: PulseMonth): string {
  return `${ETHIOPIAN_MONTH_NAMES[month - 1]} ${year}`;
}

export function shiftPulseMonth({ year, month }: PulseMonth, delta: number): PulseMonth {
  const i = year * 13 + (month - 1) + delta;
  return { year: Math.floor(i / 13), month: (i % 13) + 1 };
}

export interface ReportRow {
  employeeId: string;
  name: string;
  role: string | null;
  workDays: number;
  present: number;
  late: number;
  early: number;
  leave: number;
  absent: number;
  hours: number;
}

export interface ReportDay {
  date: string;
  name: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

export interface MonthReport {
  rows: ReportRow[];
  days: ReportDay[];
  workDays: number;
  present: number;
  late: number;
  hours: number;
  rate: number | null;
}

/** Working days so far in an Ethiopian month, and each employee's tally.
 * Expected days only count from the day an employee was added. */
export async function buildMonthReport(month: PulseMonth, rules: PulseRules): Promise<MonthReport> {
  const start = toGregorian({ ...month, day: 1 });
  const end = new Date(start.getTime() + daysInEthiopianMonth(month.year, month.month) * DAY_MS);
  const today = addisWorkDate();
  const until = end <= today ? end : new Date(today.getTime() + DAY_MS);

  const [employees, records, leave, holidays] = await Promise.all([
    prisma.pulseEmployee.findMany({ orderBy: { name: "asc" } }),
    prisma.pulseAttendance.findMany({ where: { workDate: { gte: start, lt: end } }, orderBy: { workDate: "asc" } }),
    prisma.pulseLeave.findMany({ where: { date: { gte: start, lt: end } } }),
    prisma.pulseHoliday.findMany({ where: { date: { gte: start, lt: end } } }),
  ]);
  const holidaySet = new Set(holidays.map((h) => h.date.getTime()));
  const workDayList: number[] = [];
  for (let t = start.getTime(); t < until.getTime(); t += DAY_MS) {
    if (rules.workDays.includes(new Date(t).getUTCDay()) && !holidaySet.has(t)) workDayList.push(t);
  }

  const names = new Map(employees.map((e) => [e.id, e.name]));
  const rows: ReportRow[] = employees
    .map((e): ReportRow & { active: boolean } => {
      const since = addisWorkDate(e.createdAt).getTime();
      const own = records.filter((r) => r.employeeId === e.id);
      const presentDays = new Set(own.filter((r) => r.checkInAt).map((r) => r.workDate.getTime()));
      const leaveDays = new Set(leave.filter((l) => l.employeeId === e.id).map((l) => l.date.getTime()));
      const expected = workDayList.filter((t) => t >= since);
      const hours = own.reduce(
        (sum, r) => sum + (r.checkInAt && r.checkOutAt ? (r.checkOutAt.getTime() - r.checkInAt.getTime()) / 3600000 : 0),
        0
      );
      return {
        employeeId: e.id,
        name: e.name,
        role: e.role,
        active: e.active,
        workDays: expected.length,
        present: expected.filter((t) => presentDays.has(t)).length,
        late: own.filter((r) => r.late).length,
        early: own.filter((r) => r.early).length,
        leave: expected.filter((t) => leaveDays.has(t)).length,
        absent: expected.filter((t) => !presentDays.has(t) && !leaveDays.has(t)).length,
        hours: Math.round(hours * 10) / 10,
      };
    })
    .filter((r) => r.active || r.present > 0)
    .map((r) => {
      const row: ReportRow & { active?: boolean } = { ...r };
      delete row.active;
      return row;
    });

  const days: ReportDay[] = records.map((r) => ({
    date: ethiopianDateLabel(r.workDate),
    name: names.get(r.employeeId) ?? "",
    checkIn: addisHHMM(r.checkInAt),
    checkOut: addisHHMM(r.checkOutAt),
    status: [r.late ? "Late" : "", r.early ? "Left early" : "", r.source === "admin-correction" ? "Corrected" : ""]
      .filter(Boolean)
      .join(", ") || "On time",
  }));

  const expectedTotal = rows.reduce((s, r) => s + r.workDays - r.leave, 0);
  const present = rows.reduce((s, r) => s + r.present, 0);
  return {
    rows,
    days,
    workDays: workDayList.length,
    present,
    late: rows.reduce((s, r) => s + r.late, 0),
    hours: Math.round(rows.reduce((s, r) => s + r.hours, 0) * 10) / 10,
    rate: expectedTotal > 0 ? Math.round((present / expectedTotal) * 100) : null,
  };
}
