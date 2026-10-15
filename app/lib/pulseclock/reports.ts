import { prisma } from "@/lib/prisma";
import { ETHIOPIAN_MONTH_NAMES, daysInEthiopianMonth, ethiopianToday, toEthiopian, toGregorian } from "@/lib/payroll/ethiopian";
import { addisHHMM, addisTimeLabel, addisWorkDate, ethiopianDateLabel } from "./time";
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

// ---------------------------------------------------------------------------
// Daily log — every day, newest first, grouped by Ethiopian month
// ---------------------------------------------------------------------------

export type LogStatus = "ontime" | "late" | "leave" | "absent" | "pending" | "extra";

export interface LogRow {
  employeeId: string;
  name: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: LogStatus;
  early: boolean;
  corrected: boolean;
  note: string | null;
}

export interface LogDay {
  key: string;
  day: number;
  weekday: string;
  date: string;
  note: string | null; // "Holiday: …" or "Day off"
  rows: LogRow[];
}

export interface LogMonth {
  key: string;
  label: string;
  days: LogDay[];
}

export interface DailyLog {
  months: LogMonth[];
  hasEarlier: boolean;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function hoursLabel(inAt: Date | null, outAt: Date | null): string {
  if (!inAt || !outAt) return "—";
  const m = Math.round((outAt.getTime() - inAt.getTime()) / 60000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** The last `monthCount` Ethiopian months up to today (optionally one employee). */
export async function buildDailyLog(rules: PulseRules, monthCount: number, employeeId: string | null): Promise<DailyLog> {
  const today = addisWorkDate();
  const first = shiftPulseMonth(currentPulseMonth(), -(monthCount - 1));
  const start = toGregorian({ ...first, day: 1 });
  const end = new Date(today.getTime() + DAY_MS);
  const empWhere = employeeId ? { employeeId } : {};

  const [employees, records, leave, holidays, earliest] = await Promise.all([
    prisma.pulseEmployee.findMany({ where: employeeId ? { id: employeeId } : {}, orderBy: { name: "asc" } }),
    prisma.pulseAttendance.findMany({ where: { ...empWhere, workDate: { gte: start, lt: end } } }),
    prisma.pulseLeave.findMany({ where: { ...empWhere, date: { gte: start, lt: end } } }),
    prisma.pulseHoliday.findMany({ where: { date: { gte: start, lt: end } } }),
    prisma.pulseAttendance.findFirst({ where: { ...empWhere, workDate: { lt: start } }, select: { id: true } }),
  ]);

  const recordAt = new Map(records.map((r) => [`${r.employeeId}|${r.workDate.getTime()}`, r]));
  const leaveAt = new Map(leave.map((l) => [`${l.employeeId}|${l.date.getTime()}`, l]));
  const holidayAt = new Map(holidays.map((h) => [h.date.getTime(), h]));
  const firstDay = employees.length ? Math.min(...employees.map((e) => addisWorkDate(e.createdAt).getTime())) : today.getTime();

  const months: LogMonth[] = [];
  for (let t = today.getTime(); t >= start.getTime() && t >= firstDay; t -= DAY_MS) {
    const d = new Date(t);
    const et = toEthiopian(d);
    const holiday = holidayAt.get(t);
    const workDay = rules.workDays.includes(d.getUTCDay()) && !holiday;
    const rows: LogRow[] = [];
    for (const e of employees) {
      const r = recordAt.get(`${e.id}|${t}`);
      const l = leaveAt.get(`${e.id}|${t}`);
      if (!r && (t < addisWorkDate(e.createdAt).getTime() || !e.active || !workDay)) continue;
      let status: LogStatus;
      if (r?.checkInAt) status = !workDay ? "extra" : r.late ? "late" : "ontime";
      else if (l) status = "leave";
      else if (t === today.getTime()) status = "pending";
      else status = "absent";
      rows.push({
        employeeId: e.id,
        name: e.name,
        checkIn: addisTimeLabel(r?.checkInAt),
        checkOut: addisTimeLabel(r?.checkOutAt),
        hours: hoursLabel(r?.checkInAt ?? null, r?.checkOutAt ?? null),
        status,
        early: !!r?.early,
        corrected: r?.source === "admin-correction",
        note: l?.reason ?? null,
      });
    }
    const key = pulseMonthKey(et);
    let month = months[months.length - 1];
    if (!month || month.key !== key) {
      month = { key, label: pulseMonthLabel(et), days: [] };
      months.push(month);
    }
    month.days.push({
      key: String(t),
      day: et.day,
      weekday: WEEKDAYS[d.getUTCDay()],
      date: ethiopianDateLabel(d),
      note: holiday ? `Holiday: ${holiday.reason}` : workDay ? null : "Day off",
      rows,
    });
  }
  return { months, hasEarlier: !!earliest || firstDay < start.getTime() };
}
