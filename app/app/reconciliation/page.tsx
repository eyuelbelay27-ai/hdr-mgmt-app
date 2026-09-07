import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canSeePage } from "@/lib/permissions";
import { totalAllocatedCash } from "@/lib/calc/budget";
import { actualTotalExpenses } from "@/lib/calc/reconciliation";
import { AppNav } from "../AppNav";
import { StatusBadge } from "../StatusBadge";

const RECONCILIATION_STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Pending: { bg: "var(--surface-3)", fg: "var(--text-dim)" },
  Reconciled: { bg: "var(--success-soft)", fg: "var(--success)" },
  Flagged: { bg: "var(--danger-soft)", fg: "var(--danger)" },
};

export default async function ReconciliationListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "reconciliation")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="reconciliation" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to Reconciliation.</p>
        </main>
      </div>
    );
  }

  // Only jobs actually submitted for reconciliation belong here — an
  // approved budget alone isn't enough (that job still shows on the Budget
  // tab until someone clicks "Submit for Reconciliation").
  const jobs = await prisma.job.findMany({
    where: { status: "WaitingForReconciliation" },
    include: { budgetItems: true, expenses: true },
    orderBy: { updatedAt: "desc" },
  });

  const rows = jobs.map((j) => {
    const allocated = totalAllocatedCash(j.budgetItems);
    const actual = actualTotalExpenses(j.expenses);
    const variance = Math.round((actual - allocated) * 100) / 100;
    return { job: j, allocated, actual, variance };
  });

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="reconciliation" />
      <main className="app-main">
        <h1 style={{ marginTop: 0 }}>Reconciliation</h1>

        <div className="expenses-desktop-table">
          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  {["Job #", "Client", "Status", "Allocated", "Actual", "Variance", "Reconciliation"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ job: j, allocated, actual, variance }) => (
                  <tr key={j.id}>
                    <td className="mono" data-label="Job #">
                      <a href={`/reconciliation/${j.id}`} style={{ color: "inherit" }}>{j.jobNumber}</a>
                    </td>
                    <td data-label="Client">{j.clientName}</td>
                    <td data-label="Status"><StatusBadge status={j.status} /></td>
                    <td className="mono" data-label="Allocated">{allocated.toLocaleString()}</td>
                    <td className="mono" data-label="Actual">{actual.toLocaleString()}</td>
                    <td className="mono" data-label="Variance" style={{ color: variance > 0 ? "var(--danger)" : "var(--success)" }}>
                      {variance.toLocaleString()}
                    </td>
                    <td data-label="Reconciliation">
                      <span
                        className="badge"
                        style={{
                          background: RECONCILIATION_STATUS_TONE[j.reconciliationStatus].bg,
                          color: RECONCILIATION_STATUS_TONE[j.reconciliationStatus].fg,
                        }}
                      >
                        {j.reconciliationStatus}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className="label" colSpan={7}>No jobs waiting for reconciliation.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="expenses-mobile-cards">
          {rows.map(({ job: j, actual, variance }) => (
            <a key={j.id} href={`/reconciliation/${j.id}`} className="card expense-row" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <div className="expense-row-header" style={{ cursor: "pointer" }}>
                <div className="expense-row-main">
                  <div className="expense-row-item">{j.jobNumber} — {j.clientName}</div>
                  <span
                    className="badge"
                    style={{
                      background: RECONCILIATION_STATUS_TONE[j.reconciliationStatus].bg,
                      color: RECONCILIATION_STATUS_TONE[j.reconciliationStatus].fg,
                    }}
                  >
                    {j.reconciliationStatus}
                  </span>
                </div>
                <div className="expense-row-amounts">
                  <div className="expense-row-total">{actual.toLocaleString()} Br</div>
                  <div style={{ color: variance > 0 ? "var(--danger)" : "var(--success)" }}>
                    {variance > 0 ? "Over" : variance < 0 ? "Under" : "On budget"} {Math.abs(variance).toLocaleString()} Br
                  </div>
                </div>
                <ChevronRight size={16} strokeWidth={2} className="expense-row-chevron" />
              </div>
            </a>
          ))}
          {rows.length === 0 && <p className="label">No jobs waiting for reconciliation.</p>}
        </div>
      </main>
    </div>
  );
}
