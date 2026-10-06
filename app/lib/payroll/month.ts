import { ETHIOPIAN_MONTH_NAMES, ethiopianToday } from "./ethiopian";

/**
 * A payroll month in the Ethiopian calendar. Payroll runs Meskerem (1)
 * through Nehase (12) — Pagume is never a payroll month.
 */
export interface PayrollMonth {
  year: number;
  month: number; // 1–12
}

export const PAYROLL_MONTH_NAMES = ETHIOPIAN_MONTH_NAMES.slice(0, 12);

/** This Ethiopian month in Addis; during Pagume, the Nehase just ended. */
export function currentPayrollMonth(): PayrollMonth {
  const today = ethiopianToday();
  return { year: today.year, month: Math.min(today.month, 12) };
}

/** Parses "YYYY-MM" (Ethiopian year, month 1–12); null for anything else. */
export function parsePayrollMonth(value: unknown): PayrollMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1990 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

export function formatPayrollMonthKey({ year, month }: PayrollMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function payrollMonthLabel({ year, month }: PayrollMonth): string {
  return `${PAYROLL_MONTH_NAMES[month - 1]} ${year}`;
}

export function shiftPayrollMonth({ year, month }: PayrollMonth, delta: number): PayrollMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
