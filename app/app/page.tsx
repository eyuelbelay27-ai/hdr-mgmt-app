import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canSeePage, canSeeTab } from "@/lib/permissions";
import { AppNav } from "./AppNav";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "dashboard")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="dashboard" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to the Dashboard.</p>
        </main>
      </div>
    );
  }

  const counts = await prisma.job.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countFor = (status: string) =>
    counts.find((c) => c.status === status)?._count._all ?? 0;

  const cards = [
    { tab: "dash_draft" as const, label: "Draft", value: countFor("Draft") },
    { tab: "dash_approval" as const, label: "Waiting for Approval", value: countFor("WaitingForApproval") },
    { tab: "dash_budget" as const, label: "Approved Budget", value: countFor("ApprovedBudget") },
    {
      tab: "dash_reconciliation" as const,
      label: "Waiting for Reconciliation",
      value: countFor("WaitingForReconciliation"),
    },
  ].filter((c) => canSeeTab(user, c.tab));

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="dashboard" />
      <main className="app-main">
        <h1 style={{ marginTop: 0 }}>Dashboard</h1>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {cards.map((c) => (
            <div key={c.tab} className="card" style={{ padding: "14px 18px", minWidth: 160 }}>
              <div className="label" style={{ marginBottom: 6 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{c.value}</div>
            </div>
          ))}
          {cards.length === 0 && (
            <p className="label">No dashboard tabs are enabled for your account.</p>
          )}
        </div>

        {(canSeeTab(user, "dash_remaining") || canSeeTab(user, "dash_purchaseOrders")) && (
          <p className="label" style={{ marginTop: 24 }}>
            Remaining Payments and Purchase Orders panels land in a later build phase
            (see brief Sections 7.7–7.9, 8.7).
          </p>
        )}
      </main>
    </div>
  );
}
