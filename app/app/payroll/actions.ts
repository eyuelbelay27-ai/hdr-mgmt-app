"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { can, requirePage, PermissionError, type PermissionSubject } from "@/lib/permissions";
import { round2, toNumber } from "@/lib/money";
import { saveUpload, getUploadedFile, deleteUpload } from "@/lib/storage";
import { normalizePayTypes, type PayTypes } from "@/lib/payroll/calc";
import { isValidEthiopianDate, toGregorian } from "@/lib/payroll/ethiopian";
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

/** Salary/Overtime/Commission switches; null when neither Salary nor
 * Commission is on, since such an employee would never be paid anything. */
function readPayTypes(formData: FormData): PayTypes | null {
  const types = normalizePayTypes({
    paySalary: formData.get("paySalary") === "on",
    payOvertime: formData.get("payOvertime") === "on",
    payCommission: formData.get("payCommission") === "on",
  });
  return types.paySalary || types.payCommission ? types : null;
}

const PAY_TYPES_ERROR = "Turn on Salary or Commission (or both).";

/** Optional bank/wallet name and account number; blank clears them. */
function readBankDetails(formData: FormData): { bankName: string | null; bankAccount: string | null } {
  return {
    bankName: trimmed(formData, "bankName").slice(0, 80) || null,
    bankAccount: trimmed(formData, "bankAccount").slice(0, 60) || null,
  };
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
  const payTypes = readPayTypes(formData);
  if (!payTypes) return { error: PAY_TYPES_ERROR };
  if (payTypes.paySalary && (!trimmed(formData, "salary") || salary === null)) {
    return { error: "Enter a valid monthly salary." };
  }

  await prisma.payrollEmployee.create({ data: { name, salary: salary ?? 0, ...payTypes, ...readBankDetails(formData) } });
  revalidatePath("/payroll");
  return { error: null };
}

export async function updatePayrollEmployeeAction(employeeId: string, formData: FormData): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  const name = trimmed(formData, "name");
  const salary = nonNegative(formData, "salary");
  if (!name) return { error: "Name can't be empty." };
  const payTypes = readPayTypes(formData);
  if (!payTypes) return { error: PAY_TYPES_ERROR };
  if (salary === null || (payTypes.paySalary && !trimmed(formData, "salary"))) {
    return { error: "Enter a valid monthly salary." };
  }

  await prisma.payrollEmployee.update({
    where: { id: employeeId },
    data: { name, salary, active: formData.get("active") === "on", ...payTypes, ...readBankDetails(formData) },
  });
  revalidatePath("/payroll");
  return { error: null };
}

/** Only an employee with no history can be deleted — anyone who has been
 * paid or owes money is deactivated instead, so past months stay intact. */
export async function deletePayrollEmployeeAction(employeeId: string): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  const [entries, debts, deductions] = await Promise.all([
    prisma.payrollEntry.count({ where: { employeeId } }),
    prisma.payrollDebt.count({ where: { employeeId } }),
    prisma.payrollDeduction.count({ where: { employeeId } }),
  ]);
  if (entries > 0 || debts > 0 || deductions > 0) {
    return { error: "This employee has payroll history. Turn off Active instead of deleting." };
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
  const note = trimmed(formData, "note") || null;
  // Entered in the Ethiopian calendar, stored as the matching Gregorian day.
  const ethiopianDate = {
    year: Number(trimmed(formData, "dateYear")),
    month: Number(trimmed(formData, "dateMonth")),
    day: Number(trimmed(formData, "dateDay")),
  };

  if (!employeeId) return { error: "Choose an employee." };
  if (!amount) return { error: "Enter an amount greater than zero." };
  if (!isValidEthiopianDate(ethiopianDate)) return { error: "Enter a valid date." };

  const employee = await prisma.payrollEmployee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "That employee no longer exists." };

  await prisma.payrollDebt.create({
    data: { employeeId, amount, date: toGregorian(ethiopianDate), note, createdBy: user.name },
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
    data: toAdd.map((e) => ({
      employeeId: e.id,
      ...month,
      salary: e.salary,
      ...rates,
      ...normalizePayTypes(e),
      updatedBy: user.name,
    })),
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
  const payTypes = readPayTypes(formData);
  if (!payTypes) return { error: PAY_TYPES_ERROR };

  // Net pay may go negative (owner's call), so only the debt balance limits
  // a repayment.
  if (debtRepayment > 0) {
    const owed = await outstandingDebt(entry.employeeId, entry.id);
    if (debtRepayment > owed) {
      return { error: `${entry.employee.name} only owes ${br(owed)}.` };
    }
  }

  await prisma.payrollEntry.update({
    where: { id: entryId },
    data: {
      salary,
      otNormalHours,
      otNightHours,
      otRestDayHours,
      otHolidayHours,
      debtRepayment,
      ...payTypes,
      updatedBy: user.name,
    },
  });
  revalidatePath("/payroll");
  return { error: null };
}

/** Takes an employee off one month. Any repayment on that row goes back
 * onto their debt balance; that month's deductions stay recorded. */
export async function removePayrollEntryAction(entryId: string): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  const entry = await prisma.payrollEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: null };
  await prisma.payrollEntry.delete({ where: { id: entryId } });
  await deleteUpload(entry.receiptUrl);
  revalidatePath("/payroll");
  return { error: null };
}

// -----------------------------------------------------------------------
// Payment receipts — one optional bank slip / screenshot per monthly row
// -----------------------------------------------------------------------

export interface PayrollReceiptState extends PayrollActionState {
  receipt?: { url: string; name: string; kind: string };
}

export async function uploadPayrollReceiptAction(entryId: string, formData: FormData): Promise<PayrollReceiptState> {
  const { error } = await authorize();
  if (error) return { error };

  const file = getUploadedFile(formData, "receipt");
  if (!file) return { error: "Choose a file to upload." };
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return { error: "Upload a photo or a PDF." };
  }

  const entry = await prisma.payrollEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "This row no longer exists. Reload the page." };

  const stored = await saveUpload(file);
  await prisma.payrollEntry.update({
    where: { id: entryId },
    data: { receiptUrl: stored.url, receiptName: stored.name, receiptKind: stored.kind },
  });
  await deleteUpload(entry.receiptUrl);
  revalidatePath("/payroll");
  return { error: null, receipt: stored };
}

export async function removePayrollReceiptAction(entryId: string): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  const entry = await prisma.payrollEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: null };
  await prisma.payrollEntry.update({
    where: { id: entryId },
    data: { receiptUrl: null, receiptName: null, receiptKind: null },
  });
  await deleteUpload(entry.receiptUrl);
  revalidatePath("/payroll");
  return { error: null };
}

// -----------------------------------------------------------------------
// Deductions — penalties etc., subtracted from that month's net pay
// -----------------------------------------------------------------------

export async function addPayrollDeductionAction(
  _prevState: PayrollActionState,
  formData: FormData
): Promise<PayrollActionState> {
  const { user, error } = await authorize();
  if (error || !user) return { error };

  const employeeId = trimmed(formData, "employeeId");
  const month = parsePayrollMonth(trimmed(formData, "month"));
  const amount = nonNegative(formData, "amount");
  const reason = trimmed(formData, "reason");

  if (!employeeId) return { error: "Choose an employee." };
  if (!month) return { error: "Choose a month." };
  if (!amount) return { error: "Enter an amount greater than zero." };
  if (!reason) return { error: "Write the reason for the deduction." };

  const employee = await prisma.payrollEmployee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "That employee no longer exists." };

  await prisma.payrollDeduction.create({
    data: { employeeId, ...month, amount, reason, createdBy: user.name },
  });
  revalidatePath("/payroll");
  return { error: null };
}

export async function deletePayrollDeductionAction(deductionId: string): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  await prisma.payrollDeduction.deleteMany({ where: { id: deductionId } });
  revalidatePath("/payroll");
  return { error: null };
}

// -----------------------------------------------------------------------
// Commission — job/customer + amount lines on a monthly row
// -----------------------------------------------------------------------

export interface PayrollCommissionState extends PayrollActionState {
  line?: { id: string; jobName: string; amount: number };
}

export async function addPayrollCommissionAction(entryId: string, formData: FormData): Promise<PayrollCommissionState> {
  const { user, error } = await authorize();
  if (error || !user) return { error };

  const jobName = trimmed(formData, "jobName");
  const amount = nonNegative(formData, "amount");
  if (!jobName) return { error: "Enter the job or customer name." };
  if (!amount) return { error: "Enter a commission amount greater than zero." };

  const entry = await prisma.payrollEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "This row no longer exists. Reload the page." };

  const line = await prisma.payrollCommission.create({
    data: { entryId, jobName, amount, createdBy: user.name },
  });
  revalidatePath("/payroll");
  return { error: null, line: { id: line.id, jobName: line.jobName, amount: toNumber(line.amount) } };
}

export async function deletePayrollCommissionAction(commissionId: string): Promise<PayrollActionState> {
  const { error } = await authorize();
  if (error) return { error };

  await prisma.payrollCommission.deleteMany({ where: { id: commissionId } });
  revalidatePath("/payroll");
  return { error: null };
}
