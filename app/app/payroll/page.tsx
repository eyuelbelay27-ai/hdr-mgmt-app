import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { round2, toNumber } from "@/lib/money";
import { formatEthiopianDate, toEthiopian } from "@/lib/payroll/ethiopian";
import { currentPayrollMonth, formatPayrollMonthKey, parsePayrollMonth, payrollMonthLabel } from "@/lib/payroll/month";
import { getPayrollRates } from "@/lib/payroll/settings";
import { AppNav } from "../AppNav";
import { MonthlyPayroll, type PayrollEntryData } from "./MonthlyPayroll";
import { DeductionsPanel } from "./DeductionsPanel";
import { PayrollSettingsPanel } from "./PayrollSettingsPanel";

const TABS = [
  { key: "payroll", label: "Monthly Payroll" },
  { key: "deductions", label: "Deductions" },
  { key: "settings", label: "Settings" },
] as const;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!canSeePage(user, "payroll") || !can(user, "managePayroll")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="payroll" />
        <main className="app-main">
          <h1 style={{ marginTop: 0 }}>Payroll</h1>
          <p className="label">You don&apos;t have access to Payroll.</p>
        </main>
      </div>
    );
  }

  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "payroll";
  const month = parsePayrollMonth(sp.month) ?? currentPayrollMonth();
  const monthKey = formatPayrollMonthKey(month);

  const [employees, debtSums, repaidSums, entries, monthDeductions, debts, repayments, rates] = await Promise.all([
    prisma.payrollEmployee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.payrollDebt.groupBy({ by: ["employeeId"], _sum: { amount: true } }),
    prisma.payrollEntry.groupBy({ by: ["employeeId"], _sum: { debtRepayment: true } }),
    prisma.payrollEntry.findMany({
      where: { ...month },
      include: {
        employee: { select: { name: true, bankName: true, bankAccount: true } },
        commissions: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.payrollDeduction.findMany({
      where: { ...month },
      orderBy: { createdAt: "asc" },
      include: { employee: { select: { name: true } } },
    }),
    prisma.payrollDebt.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { employee: { select: { name: true } } } }),
    prisma.payrollEntry.findMany({
      where: { debtRepayment: { gt: 0 } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { employee: { select: { name: true } } },
    }),
    getPayrollRates(),
  ]);

  const borrowedBy = new Map(debtSums.map((d) => [d.employeeId, toNumber(d._sum.amount)]));
  const repaidBy = new Map(repaidSums.map((r) => [r.employeeId, toNumber(r._sum.debtRepayment)]));
  const deductionsBy = new Map<string, { id: string; reason: string; amount: number }[]>();
  for (const d of monthDeductions) {
    const list = deductionsBy.get(d.employeeId) ?? [];
    list.push({ id: d.id, reason: d.reason, amount: toNumber(d.amount) });
    deductionsBy.set(d.employeeId, list);
  }

  const monthEntries: PayrollEntryData[] = entries
    .map((e) => {
      const repayment = toNumber(e.debtRepayment);
      const repaidElsewhere = (repaidBy.get(e.employeeId) ?? 0) - repayment;
      const deductionItems = deductionsBy.get(e.employeeId) ?? [];
      return {
        id: e.id,
        employeeName: e.employee.name,
        // What the employee owes before counting this month's repayment.
        owedBefore: round2((borrowedBy.get(e.employeeId) ?? 0) - repaidElsewhere),
        salary: toNumber(e.salary),
        hoursPerMonth: toNumber(e.hoursPerMonth),
        otNormalMultiplier: toNumber(e.otNormalMultiplier),
        otNightMultiplier: toNumber(e.otNightMultiplier),
        otRestDayMultiplier: toNumber(e.otRestDayMultiplier),
        otHolidayMultiplier: toNumber(e.otHolidayMultiplier),
        otNormalHours: toNumber(e.otNormalHours),
        otNightHours: toNumber(e.otNightHours),
        otRestDayHours: toNumber(e.otRestDayHours),
        otHolidayHours: toNumber(e.otHolidayHours),
        debtRepayment: repayment,
        paySalary: e.paySalary,
        payOvertime: e.payOvertime,
        payCommission: e.payCommission,
        commissionItems: e.commissions.map((c) => ({ id: c.id, jobName: c.jobName, amount: toNumber(c.amount) })),
        commission: round2(e.commissions.reduce((s, c) => s + toNumber(c.amount), 0)),
        deductions: round2(deductionItems.reduce((s, d) => s + d.amount, 0)),
        deductionItems,
        receipt: e.receiptUrl ? { url: e.receiptUrl, name: e.receiptName ?? "receipt", kind: e.receiptKind ?? "" } : null,
        // Read live from the employee (not snapshotted): it's where to pay, not how much.
        bankName: e.employee.bankName,
        bankAccount: e.employee.bankAccount,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const inMonth = new Set(entries.map((e) => e.employeeId));
  const missingActive = employees.filter((e) => e.active && !inMonth.has(e.id)).map((e) => e.name);

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="payroll" />
      <main className="app-main">
        <div className="pr-stack" style={{ maxWidth: 1100 }}>
          <h1 style={{ margin: 0 }}>Payroll</h1>

          <nav className="pr-segmented" aria-label="Payroll sections">
            {TABS.map((t) => (
              <a
                key={t.key}
                href={`/payroll?${t.key === "payroll" ? "" : `tab=${t.key}&`}month=${monthKey}`}
                className={`pr-seg${tab === t.key ? " active" : ""}`}
                aria-current={tab === t.key ? "page" : undefined}
              >
                {t.label}
              </a>
            ))}
          </nav>

          {tab === "payroll" && (
            <MonthlyPayroll
              key={`${monthKey}:${monthEntries.map((e) => e.id).join(",")}`}
              monthKey={monthKey}
              entries={monthEntries}
              missingActive={missingActive}
              activeCount={employees.filter((e) => e.active).length}
            />
          )}

          {tab === "deductions" && (
            <DeductionsPanel
              key={monthKey}
              monthKey={monthKey}
              employees={employees.map((e) => ({ id: e.id, name: e.name, active: e.active }))}
              deductions={monthDeductions.map((d) => ({
                id: d.id,
                employeeName: d.employee.name,
                amount: toNumber(d.amount),
                reason: d.reason,
                createdBy: d.createdBy,
                createdAt: d.createdAt.toISOString(),
              }))}
            />
          )}

          {tab === "settings" && (
            <PayrollSettingsPanel
              rates={rates}
              employees={employees.map((e) => {
                const borrowed = borrowedBy.get(e.id) ?? 0;
                const repaid = repaidBy.get(e.id) ?? 0;
                return {
                  id: e.id,
                  name: e.name,
                  salary: toNumber(e.salary),
                  active: e.active,
                  paySalary: e.paySalary,
                  payOvertime: e.payOvertime,
                  payCommission: e.payCommission,
                  bankName: e.bankName,
                  bankAccount: e.bankAccount,
                  borrowed,
                  repaid,
                  owed: round2(borrowed - repaid),
                };
              })}
              debts={debts.map((d) => ({
                id: d.id,
                employeeName: d.employee.name,
                amount: toNumber(d.amount),
                dateLabel: formatEthiopianDate(toEthiopian(d.date)),
                note: d.note,
                createdBy: d.createdBy,
              }))}
              repayments={repayments.map((r) => ({
                id: r.id,
                employeeName: r.employee.name,
                monthKey: formatPayrollMonthKey({ year: r.year, month: r.month }),
                monthLabel: payrollMonthLabel({ year: r.year, month: r.month }),
                amount: toNumber(r.debtRepayment),
              }))}
            />
          )}
        </div>
      </main>
    </div>
  );
}
