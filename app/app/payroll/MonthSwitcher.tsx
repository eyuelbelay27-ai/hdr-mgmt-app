"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  PAYROLL_MONTH_NAMES,
  currentPayrollMonth,
  formatPayrollMonthKey,
  parsePayrollMonth,
  shiftPayrollMonth,
  type PayrollMonth,
} from "@/lib/payroll/month";

export function MonthSwitcher({ monthKey, tab }: { monthKey: string; tab?: string }) {
  const router = useRouter();
  const month = parsePayrollMonth(monthKey)!;
  const thisYear = currentPayrollMonth().year;
  const years = Array.from({ length: 6 }, (_, i) => thisYear - 4 + i);
  if (!years.includes(month.year)) years.push(month.year);
  years.sort((a, b) => a - b);

  function go(next: PayrollMonth) {
    router.push(`/payroll?${tab ? `tab=${tab}&` : ""}month=${formatPayrollMonthKey(next)}`);
  }

  return (
    <div className="pr-month">
      <button type="button" className="pr-month-btn" aria-label="Previous month" onClick={() => go(shiftPayrollMonth(month, -1))}>
        <ChevronLeft size={18} strokeWidth={2} />
      </button>
      <div className="pr-month-label">
        <select
          className="pr-month-select"
          aria-label="Month"
          value={month.month}
          onChange={(e) => go({ year: month.year, month: Number(e.target.value) })}
        >
          {PAYROLL_MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          className="pr-month-select"
          aria-label="Year"
          value={month.year}
          onChange={(e) => go({ year: Number(e.target.value), month: month.month })}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <button type="button" className="pr-month-btn" aria-label="Next month" onClick={() => go(shiftPayrollMonth(month, 1))}>
        <ChevronRight size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
