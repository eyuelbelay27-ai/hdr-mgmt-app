import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { canSeePage, canSeeTab, type TabKey } from "@/lib/permissions";
import { remainingPayment } from "@/lib/calc/payments";
import { AppNav } from "./AppNav";
import { StatusBadge, DeadlineBadge } from "./StatusBadge";
import { PurchaseOrdersPanel } from "./PurchaseOrdersPanel";

const STATUS_CARDS: { tab: TabKey; label: string; status: JobStatus }[] = [
  { tab: "dash_draft", label: "Draft", status: "Draft" },
  { tab: "dash_approval", label: "Waiting for Approval", status: "WaitingForApproval" },
  { tab: "dash_budget", label: "Approved Budget", status: "ApprovedBudget" },
  { tab: "dash_reconciliation", label: "Waiting for Reconciliation", status: "WaitingForReconciliation" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
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

  const sp = await searchParams;
  const counts = await prisma.job.groupBy({ by: ["status"], _count: { _all: true } });
  const countFor = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;

  const statusCards = STATUS_CARDS.filter((c) => canSeeTab(user, c.tab)).map((c) => ({
    ...c,
    value: countFor(c.status),
  }));

  const openJobs = await prisma.job.findMany({
    where: { status: { notIn: ["Closed", "Cancelled"] } },
    include: { payments: true },
  });
  const remainingRows = openJobs
    .map((j) => ({ job: j, remaining: remainingPayment(j.costEstimateSoldPrice, j.payments) }))
    .filter((r) => r.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
  const remainingTotal = Math.round(remainingRows.reduce((s, r) => s + r.remaining, 0) * 100) / 100;

  const showRemaining = canSeeTab(user, "dash_remaining");
  const showPO = canSeeTab(user, "dash_purchaseOrders");

  const activeTab = (["dash_draft", "dash_approval", "dash_budget", "dash_reconciliation", "dash_remaining", "dash_purchaseOrders"].includes(sp.tab ?? "")
    ? sp.tab
    : statusCards[0]?.tab ?? (showRemaining ? "dash_remaining" : showPO ? "dash_purchaseOrders" : undefined)) as TabKey | undefined;

  const activeStatus = STATUS_CARDS.find((c) => c.tab === activeTab)?.status;
  const activeJobs = activeStatus
    ? await prisma.job.findMany({ where: { status: activeStatus }, orderBy: { createdAt: "desc" } })
    : [];

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="dashboard" />
      <main className="app-main">
        <h1 style={{ marginTop: 0 }}>Dashboard</h1>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {statusCards.map((c) => (
            <a key={c.tab} href={`?tab=${c.tab}`} className="card" style={{ padding: "14px 18px", minWidth: 160, color: "inherit", textDecoration: "none", borderColor: activeTab === c.tab ? "var(--accent)" : undefined }}>
              <div className="label" style={{ marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{c.value}</div>
            </a>
          ))}
          {showRemaining && (
            <a href="?tab=dash_remaining" className="card" style={{ padding: "14px 18px", minWidth: 160, color: "inherit", textDecoration: "none", borderColor: activeTab === "dash_remaining" ? "var(--accent)" : undefined }}>
              <div className="label" style={{ marginBottom: 6 }}>Remaining Payments</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{remainingTotal.toLocaleString()} ETB</div>
            </a>
          )}
          {showPO && (
            <a href="?tab=dash_purchaseOrders" className="card" style={{ padding: "14px 18px", minWidth: 160, color: "inherit", textDecoration: "none", borderColor: activeTab === "dash_purchaseOrders" ? "var(--accent)" : undefined }}>
              <div className="label" style={{ marginBottom: 6 }}>Purchase Orders</div>
            </a>
          )}
          {statusCards.length === 0 && !showRemaining && !showPO && (
            <p className="label">No dashboard tabs are enabled for your account.</p>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          {activeStatus && (
            <table className="dtable">
              <thead><tr><th>Job #</th><th>Client</th><th>Status</th></tr></thead>
              <tbody>
                {activeJobs.map((j) => (
                  <tr key={j.id}>
                    <td className="mono"><a href={`/jobs/${j.id}`}>{j.jobNumber}</a></td>
                    <td>
                      <a href={`/jobs/${j.id}`} style={{ display: "flex", gap: 8, alignItems: "center", color: "inherit" }}>
                        {j.clientName}
                        {j.deadline && <DeadlineBadge deadline={j.deadline} status={j.status} />}
                      </a>
                    </td>
                    <td><StatusBadge status={j.status} /></td>
                  </tr>
                ))}
                {activeJobs.length === 0 && <tr><td className="label" colSpan={3}>No jobs in this status.</td></tr>}
              </tbody>
            </table>
          )}

          {activeTab === "dash_remaining" && (
            <table className="dtable">
              <thead><tr><th>Job #</th><th>Client</th><th>Remaining</th></tr></thead>
              <tbody>
                {remainingRows.map(({ job, remaining }) => (
                  <tr key={job.id}>
                    <td className="mono"><a href={`/jobs/${job.id}`}>{job.jobNumber}</a></td>
                    <td>{job.clientName}</td>
                    <td className="mono">{remaining.toLocaleString()} ETB</td>
                  </tr>
                ))}
                {remainingRows.length === 0 && <tr><td className="label" colSpan={3}>No outstanding balances.</td></tr>}
              </tbody>
            </table>
          )}

          {activeTab === "dash_purchaseOrders" && <PurchaseOrdersPanel user={user} />}
        </div>
      </main>
    </div>
  );
}
