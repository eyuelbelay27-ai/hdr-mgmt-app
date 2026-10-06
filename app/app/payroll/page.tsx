import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { round2, toNumber } from "@/lib/money";
import { currentPayrollMonth, formatPayrollMonthKey, parsePayrollMonth } from "@/lib/payroll/month";
import { getPayrollRates } from "@/lib/payroll/settings";
import { AppNav } from "../AppNav";
import { MonthlyPayroll, type PayrollEntryData } from "./MonthlyPayroll";
import { PayrollSettingsPanel } from "./PayrollSettingsPanel";

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
  const tab = sp.tab === "settings" ? "settings" : "payroll";
  const month = parsePayrollMonth(sp.month) ?? currentPayrollMonth();
  const monthKey = formatPayrollMonthKey(month);

  const [employees, debtSums, repaidSums, entries, debts, repayments, rates] = await Promise.all([
    prisma.payrollEmployee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.payrollDebt.groupBy({ by: ["employeeId"], _sum: { amount: true } }),
    prisma.payrollEntry.groupBy({ by: ["employeeId"], _sum: { debtRepayment: true } }),
    prisma.payrollEntry.findMany({ where: { ...month }, include: { employee: { select: { name: true } } } }),
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

  const monthEntries: PayrollEntryData[] = entries
    .map((e) => {
      const repayment = toNumber(e.debtRepayment);
      const repaidElsewhere = (repaidBy.get(e.employeeId) ?? 0) - repayment;
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
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const inMonth = new Set(entries.map((e) => e.employeeId));
  const missingActive = employees.filter((e) => e.active && !inMonth.has(e.id)).map((e) => e.name);

  const employeeRows = employees.map((e) => {
    const borrowed = borrowedBy.get(e.id) ?? 0;
    const repaid = repaidBy.get(e.id) ?? 0;
    return {
      id: e.id,
      name: e.name,
      salary: toNumber(e.salary),
      active: e.active,
      borrowed,
      repaid,
      owed: round2(borrowed - repaid),
    };
  });

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="payroll" />
      <main className="app-main">
        <h1 style={{ marginTop: 0, marginBottom: 4 }}>Payroll</h1>
        <p className="label" style={{ marginBottom: 12 }}>
          Monthly pay: salary plus overtime, minus any debt repayment.
        </p>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="crm-toolbar">
            <a href={`/payroll?month=${monthKey}`} className={`tab${tab === "payroll" ? " active" : ""}`}>
              Monthly Payroll
            </a>
            <a href={`/payroll?tab=settings&month=${monthKey}`} className={`tab${tab === "settings" ? " active" : ""}`}>
              Settings
            </a>
          </div>

          {tab === "payroll" ? (
            <MonthlyPayroll
              key={`${monthKey}:${monthEntries.map((e) => e.id).join(",")}`}
              monthKey={monthKey}
              entries={monthEntries}
              missingActive={missingActive}
              activeCount={employees.filter((e) => e.active).length}
            />
          ) : (
            <PayrollSettingsPanel
              employees={employeeRows}
              rates={rates}
              debts={debts.map((d) => ({
                id: d.id,
                employeeName: d.employee.name,
                amount: toNumber(d.amount),
                date: d.date.toISOString().slice(0, 10),
                note: d.note,
                createdBy: d.createdBy,
              }))}
              repayments={repayments.map((r) => ({
                id: r.id,
                employeeName: r.employee.name,
                monthKey: formatPayrollMonthKey({ year: r.year, month: r.month }),
                amount: toNumber(r.debtRepayment),
              }))}
            />
          )}
        </div>
      </main>
    </div>
  );
}
