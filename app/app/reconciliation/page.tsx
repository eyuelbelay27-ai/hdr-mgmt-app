import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canSeePage } from "@/lib/permissions";
import { totalAllocatedCash } from "@/lib/calc/budget";
import { actualTotalExpenses } from "@/lib/calc/reconciliation";
import { AppNav } from "../AppNav";
import { StatusBadge } from "../StatusBadge";

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

  const jobs = await prisma.job.findMany({
    where: { budgetStatus: "Approved" },
    include: { budgetItems: true, expenses: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="reconciliation" />
      <main className="app-main">
        <h1 style={{ marginTop: 0 }}>Reconciliation</h1>
        <div className="card dtable-wrap">
        <table className="dtable">
          <thead>
            <tr>
              {["Job #", "Client", "Status", "Allocated", "Actual", "Variance", "Reconciliation"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const allocated = totalAllocatedCash(j.budgetItems);
              const actual = actualTotalExpenses(j.expenses);
              const variance = Math.round((actual - allocated) * 100) / 100;
              return (
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
                  <td data-label="Reconciliation">{j.reconciliationStatus}</td>
                </tr>
              );
            })}
            {jobs.length === 0 && (
              <tr><td className="label" colSpan={7}>No approved-budget jobs yet.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </main>
    </div>
  );
}
