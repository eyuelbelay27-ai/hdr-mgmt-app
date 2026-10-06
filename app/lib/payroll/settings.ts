import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { DEFAULT_PAYROLL_RATES, type PayrollRates } from "./calc";

/** Falls back to the schema defaults if the singleton row was never saved. */
export async function getPayrollRates(): Promise<PayrollRates> {
  const s = await prisma.payrollSettings.findUnique({ where: { id: "singleton" } });
  if (!s) return DEFAULT_PAYROLL_RATES;
  return {
    hoursPerMonth: toNumber(s.hoursPerMonth),
    otNormalMultiplier: toNumber(s.otNormalMultiplier),
    otNightMultiplier: toNumber(s.otNightMultiplier),
    otRestDayMultiplier: toNumber(s.otRestDayMultiplier),
    otHolidayMultiplier: toNumber(s.otHolidayMultiplier),
  };
}
