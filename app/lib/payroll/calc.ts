import { round2 } from "@/lib/money";

export interface PayrollRates {
  hoursPerMonth: number;
  otNormalMultiplier: number;
  otNightMultiplier: number;
  otRestDayMultiplier: number;
  otHolidayMultiplier: number;
}

export interface PayrollHours {
  otNormalHours: number;
  otNightHours: number;
  otRestDayHours: number;
  otHolidayHours: number;
}

export interface PayTypes {
  paySalary: boolean;
  payOvertime: boolean;
  payCommission: boolean;
}

export interface PayrollRow extends PayrollRates, PayrollHours, PayTypes {
  salary: number;
  debtRepayment: number;
  /** Sum of that month's PayrollDeduction rows for the employee. */
  deductions: number;
  /** Sum of the row's commission lines. */
  commission: number;
}

/** Overtime is computed from salary, so it can't apply without it. */
export function normalizePayTypes(t: PayTypes): PayTypes {
  return { paySalary: t.paySalary, payOvertime: t.paySalary && t.payOvertime, payCommission: t.payCommission };
}

export function salaryPay(row: PayrollRow): number {
  return row.paySalary ? row.salary : 0;
}

export function commissionPay(row: PayrollRow): number {
  return row.payCommission ? round2(row.commission) : 0;
}

export const DEFAULT_PAYROLL_RATES: PayrollRates = {
  hoursPerMonth: 208,
  otNormalMultiplier: 1.5,
  otNightMultiplier: 1.75,
  otRestDayMultiplier: 2,
  otHolidayMultiplier: 2.5,
};

export const OVERTIME_TYPES = [
  { hoursKey: "otNormalHours", multiplierKey: "otNormalMultiplier", label: "Normal" },
  { hoursKey: "otNightHours", multiplierKey: "otNightMultiplier", label: "Night" },
  { hoursKey: "otRestDayHours", multiplierKey: "otRestDayMultiplier", label: "Rest day" },
  { hoursKey: "otHolidayHours", multiplierKey: "otHolidayMultiplier", label: "Holiday" },
] as const;

export function hourlyWage(salary: number, hoursPerMonth: number): number {
  return hoursPerMonth > 0 ? salary / hoursPerMonth : 0;
}

/** Rounded once at the end, so per-type rounding never drifts the total. */
export function overtimePay(row: PayrollRow): number {
  if (!row.paySalary || !row.payOvertime) return 0;
  const weightedHours = OVERTIME_TYPES.reduce(
    (sum, t) => sum + row[t.hoursKey] * row[t.multiplierKey],
    0
  );
  return round2(hourlyWage(row.salary, row.hoursPerMonth) * weightedHours);
}

export function grossPay(row: PayrollRow): number {
  return round2(salaryPay(row) + overtimePay(row) + commissionPay(row));
}

/** Can go negative when deductions and repayment exceed gross pay. */
export function netPay(row: PayrollRow): number {
  return round2(grossPay(row) - row.debtRepayment - row.deductions);
}
