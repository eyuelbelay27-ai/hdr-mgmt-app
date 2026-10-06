const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface PayrollMonth {
  year: number;
  month: number; // 1–12
}

/** Today's month in Addis Ababa (UTC+3, no DST). */
export function currentPayrollMonth(): PayrollMonth {
  const addis = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return { year: addis.getUTCFullYear(), month: addis.getUTCMonth() + 1 };
}

/** Parses "YYYY-MM"; null for anything malformed. */
export function parsePayrollMonth(value: unknown): PayrollMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

export function formatPayrollMonthKey({ year, month }: PayrollMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function payrollMonthLabel({ year, month }: PayrollMonth): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
