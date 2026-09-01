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
        <table className="card" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Job #", "Client", "Status", "Allocated", "Actual", "Variance", "Reconciliation"].map((h) => (
                <th key={h} className="label" style={{ textAlign: "left", padding: "10px 12px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const allocated = totalAllocatedCash(j.budgetItems);
              const actual = actualTotalExpenses(j.expenses);
              const variance = Math.round((actual - allocated) * 100) / 100;
              return (
                <tr key={j.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td className="mono" style={{ padding: "10px 12px" }}>
                    <a href={`/reconciliation/${j.id}`} style={{ color: "inherit" }}>{j.jobNumber}</a>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{j.clientName}</td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={j.status} /></td>
                  <td className="mono" style={{ padding: "10px 12px" }}>{allocated.toLocaleString()}</td>
                  <td className="mono" style={{ padding: "10px 12px" }}>{actual.toLocaleString()}</td>
                  <td className="mono" style={{ padding: "10px 12px", color: variance > 0 ? "var(--danger)" : "var(--success)" }}>
                    {variance.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{j.reconciliationStatus}</td>
                </tr>
              );
            })}
            {jobs.length === 0 && (
              <tr><td className="label" style={{ padding: "10px 12px" }} colSpan={7}>No approved-budget jobs yet.</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  );
}
