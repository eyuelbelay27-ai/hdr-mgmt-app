"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { can, requirePage, PermissionError, type PermissionSubject } from "@/lib/permissions";
import { round2, toNumber } from "@/lib/money";
import { grossPay } from "@/lib/payroll/calc";
import { parsePayrollMonth } from "@/lib/payroll/month";
import { getPayrollRates } from "@/lib/payroll/settings";

/**
 * Payroll — a standalone module, like CRM/Overtime Control. Nothing here
 * reads from or writes to any other module's tables; the User table is used
 * only to record who made a change. One permission pair gates all of it:
 * the "payroll" page plus the "managePayroll" action.
 */

export interface PayrollActionState {
  error: string | null;
}

function requirePayroll(user: PermissionSubject): void {
  requirePage(user, "payroll");
  if (!can(user, "managePayroll")) throw new PermissionError("You don't have access to Payroll.");
}

async function authorize() {
  const user = await requireCurrentUser();
  try {
    requirePayroll(user);
  } catch (err) {
    if (err instanceof PermissionError) return { user: null, error: err.message };
    throw err;
  }
  return { user, error: null };
}

function trimmed(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Blank reads as 0; anything unparseable or negative is null. */
function nonNegative(formData: FormData, key: string): number | null {
  const raw = trimmed(formData, key);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function br(n: number): string {
  return `${n.toLocaleString()} Br`;
}

/** What an employee still owes, ignoring one month's repayment (the one
 * being edited) so it can be re-validated against its own new value. */
async function outstandingDebt(employeeId: string, excludeEntryId?: string): Promise<number> {
  const [debts, repaid] = await Promise.all([
    prisma.payrollDebt.aggregate({ where: { employeeId }, _sum: { amount: true } }),
    prisma.payrollEntry.aggregate({
      where: { employeeId, ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}) },
      _sum: { debtRepayment: true },
    }),
  ]);
  return round2(toNumber(debts._sum.amount) - toNumber(repaid._sum.debtRepayment));
}

// -----------------------------------------------------------------------
// Employees
// -----------------------------------------------------------------------

export async function createPayrollEmployeeAction(
  _prevState: PayrollActionState,
  formData: FormData
): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  const name = trimmed(formData, "name");
  const salary = nonNegative(formData, "salary");
  if (!name) return { error: "Enter the employee's name." };
  if (!trimmed(formData, "salary") || salary === null) return { error: "Enter a valid monthly salary." };

  await prisma.payrollEmployee.create({ data: { name, salary } });
  revalidatePath("/payroll");
  return { error: null };
}

export async function updatePayrollEmployeeAction(employeeId: string, formData: FormData): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  const name = trimmed(formData, "name");
  const salary = nonNegative(formData, "salary");
  if (!name) return { error: "Name can't be empty." };
  if (!trimmed(formData, "salary") || salary === null) return { error: "Enter a valid monthly salary." };

  await prisma.payrollEmployee.update({
    where: { id: employeeId },
    data: { name, salary, active: formData.get("active") === "on" },
  });
  revalidatePath("/payroll");
  return { error: null };
}

/** Only an employee with no history can be deleted — anyone who has been
 * paid or owes money is deactivated instead, so past months stay intact. */
export async function deletePayrollEmployeeAction(employeeId: string): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  const [entries, debts] = await Promise.all([
    prisma.payrollEntry.count({ where: { employeeId } }),
    prisma.payrollDebt.count({ where: { employeeId } }),
  ]);
  if (entries > 0 || debts > 0) {
    return { error: "This employee has payroll or debt history. Untick Active instead of deleting." };
  }

  await prisma.payrollEmployee.delete({ where: { id: employeeId } });
  revalidatePath("/payroll");
  return { error: null };
}

// -----------------------------------------------------------------------
// Debts
// -----------------------------------------------------------------------

export async function addPayrollDebtAction(
  _prevState: PayrollActionState,
  formData: FormData
): Promise<PayrollActionState> {
  const { user, error } = await authorize();
  if (error || !user) return { error };

  const employeeId = trimmed(formData, "employeeId");
  const amount = nonNegative(formData, "amount");
  const dateRaw = trimmed(formData, "date");
  const note = trimmed(formData, "note") || null;

  if (!employeeId) return { error: "Choose an employee." };
  if (!amount) return { error: "Enter an amount greater than zero." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return { error: "Enter a valid date." };

  const employee = await prisma.payrollEmployee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "That employee no longer exists." };

  await prisma.payrollDebt.create({
    data: { employeeId, amount, date: new Date(`${dateRaw}T00:00:00Z`), note, createdBy: user.name },
  });
  revalidatePath("/payroll");
  return { error: null };
}

/** Blocked once deleting it would leave the employee having repaid more
 * than they ever borrowed. */
export async function deletePayrollDebtAction(debtId: string): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  const debt = await prisma.payrollDebt.findUnique({ where: { id: debtId } });
  if (!debt) return { error: null };

  const remaining = await outstandingDebt(debt.employeeId);
  if (round2(remaining - toNumber(debt.amount)) < 0) {
    return { error: "Part of this debt has already been repaid, so it can't be deleted." };
  }

  await prisma.payrollDebt.delete({ where: { id: debtId } });
  revalidatePath("/payroll");
  return { error: null };
}

// -----------------------------------------------------------------------
// Settings — hours per month and the four overtime multipliers
// -----------------------------------------------------------------------

export async function savePayrollSettingsAction(
  _prevState: PayrollActionState,
  formData: FormData
): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  const hoursPerMonth = nonNegative(formData, "hoursPerMonth");
  const otNormalMultiplier = nonNegative(formData, "otNormalMultiplier");
  const otNightMultiplier = nonNegative(formData, "otNightMultiplier");
  const otRestDayMultiplier = nonNegative(formData, "otRestDayMultiplier");
  const otHolidayMultiplier = nonNegative(formData, "otHolidayMultiplier");

  if (!hoursPerMonth) return { error: "Working hours per month must be greater than zero." };
  if (
    otNormalMultiplier === null ||
    otNightMultiplier === null ||
    otRestDayMultiplier === null ||
    otHolidayMultiplier === null
  ) {
    return { error: "Multipliers must be zero or more." };
  }

  const data = { hoursPerMonth, otNormalMultiplier, otNightMultiplier, otRestDayMultiplier, otHolidayMultiplier };
  await prisma.payrollSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  revalidatePath("/payroll");
  return { error: null };
}

// -----------------------------------------------------------------------
// Monthly payroll
// -----------------------------------------------------------------------

/**
 * Adds a row for every active employee not already in the month — used both
 * to start a month and to pull in someone hired after it was started. Each
 * new row snapshots the employee's current salary and the current rates.
 */
export async function startPayrollMonthAction(monthKey: string): Promise<PayrollActionState> {
  const { user, error } = await authorize();
  if (error || !user) return { error };

  const month = parsePayrollMonth(monthKey);
  if (!month) return { error: "Invalid month." };

  const [employees, existing, rates] = await Promise.all([
    prisma.payrollEmployee.findMany({ where: { active: true } }),
    prisma.payrollEntry.findMany({ where: { ...month }, select: { employeeId: true } }),
    getPayrollRates(),
  ]);
  const already = new Set(existing.map((e) => e.employeeId));
  const toAdd = employees.filter((e) => !already.has(e.id));
  if (toAdd.length === 0) return { error: "There are no active employees to add." };

  await prisma.payrollEntry.createMany({
    data: toAdd.map((e) => ({ employeeId: e.id, ...month, salary: e.salary, ...rates, updatedBy: user.name })),
    skipDuplicates: true,
  });
  revalidatePath("/payroll");
  return { error: null };
}

export async function updatePayrollEntryAction(entryId: string, formData: FormData): Promise<PayrollActionState> {
  const { user, error } = await authorize();
  if (error || !user) return { error };

  const entry = await prisma.payrollEntry.findUnique({ where: { id: entryId }, include: { employee: true } });
  if (!entry) return { error: "This row no longer exists. Reload the page." };

  const salary = nonNegative(formData, "salary");
  const otNormalHours = nonNegative(formData, "otNormalHours");
  const otNightHours = nonNegative(formData, "otNightHours");
  const otRestDayHours = nonNegative(formData, "otRestDayHours");
  const otHolidayHours = nonNegative(formData, "otHolidayHours");
  const debtRepayment = nonNegative(formData, "debtRepayment");

  if (salary === null) return { error: "Salary must be zero or more." };
  if (otNormalHours === null || otNightHours === null || otRestDayHours === null || otHolidayHours === null) {
    return { error: "Overtime hours must be zero or more." };
  }
  if (debtRepayment === null) return { error: "Repayment must be zero or more." };

  if (debtRepayment > 0) {
    const owed = await outstandingDebt(entry.employeeId, entry.id);
    if (debtRepayment > owed) {
      return { error: `${entry.employee.name} only owes ${br(owed)}.` };
    }
    const gross = grossPay({
      salary,
      otNormalHours,
      otNightHours,
      otRestDayHours,
      otHolidayHours,
      debtRepayment,
      hoursPerMonth: toNumber(entry.hoursPerMonth),
      otNormalMultiplier: toNumber(entry.otNormalMultiplier),
      otNightMultiplier: toNumber(entry.otNightMultiplier),
      otRestDayMultiplier: toNumber(entry.otRestDayMultiplier),
      otHolidayMultiplier: toNumber(entry.otHolidayMultiplier),
    });
    if (debtRepayment > gross) {
      return { error: `Repayment can't be more than this month's pay (${br(gross)}).` };
    }
  }

  await prisma.payrollEntry.update({
    where: { id: entryId },
    data: { salary, otNormalHours, otNightHours, otRestDayHours, otHolidayHours, debtRepayment, updatedBy: user.name },
  });
  revalidatePath("/payroll");
  return { error: null };
}

/** Takes an employee off one month. Any repayment on that row goes back
 * onto their debt balance. */
export async function removePayrollEntryAction(entryId: string): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  await prisma.payrollEntry.deleteMany({ where: { id: entryId } });
  revalidatePath("/payroll");
  return { error: null };
}
