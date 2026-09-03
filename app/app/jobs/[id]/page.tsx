import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canSeePage, canSeeTab, can, type TabKey } from "@/lib/permissions";
import { isContentLocked } from "@/lib/job-status";
import { AppNav } from "../../AppNav";
import { ActiveTabAutoScroll } from "../../ActiveTabAutoScroll";
import { StatusBadge, DeadlineBadge } from "../../StatusBadge";
import { OverviewTab } from "./OverviewTab";
import { DesignTab } from "./DesignTab";
import { CutListTab } from "./CutListTab";
import { ActivityTab } from "./ActivityTab";
import { CostEstimateTab } from "./CostEstimateTab";
import { BudgetTab } from "./BudgetTab";
import { ExpensesTab } from "./ExpensesTab";
import { PaymentsTab } from "./PaymentsTab";
import { toggleAdminUnlockedAction } from "./actions";
import { ApproveBudgetControl } from "./ApproveBudgetControl";
import {
  submitForApprovalAction,
  submitForReconciliationAction,
  restoreCancelledJobAction,
} from "./statusActions";
import { RequestRevisionControl } from "./RequestRevisionControl";
import { CancelJobControl } from "./CancelJobControl";
import { DeleteJobControl } from "./DeleteJobControl";

const TAB_DEFS: { key: string; tabKey: TabKey; label: string }[] = [
  { key: "overview", tabKey: "tab_overview", label: "Overview" },
  { key: "design", tabKey: "tab_design", label: "Design" },
  { key: "cutlist", tabKey: "tab_cutlist", label: "Cut List" },
  { key: "cost", tabKey: "tab_cost", label: "Cost Estimate" },
  { key: "budget", tabKey: "tab_budget", label: "Budget" },
  { key: "expenses", tabKey: "tab_expenses", label: "Expenses" },
  { key: "payments", tabKey: "tab_payments", label: "Payments & Profit" },
  { key: "activity", tabKey: "tab_activity", label: "Activity" },
];

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "jobs")) redirect("/jobs");

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      components: { orderBy: { id: "asc" } },
      cutFiles: { orderBy: { uploadedAt: "asc" } },
      costEstimateItems: { orderBy: { id: "asc" } },
      budgetItems: { orderBy: { id: "asc" } },
      expenses: { orderBy: { date: "desc" } },
      payments: { orderBy: { date: "asc" } },
      activity: { orderBy: { ts: "desc" } },
    },
  });
  if (!job) notFound();
  if (job.status === "Draft" && !can(user, "manageDraftJobs")) redirect("/jobs");

  const visibleTabs = TAB_DEFS.filter((t) => canSeeTab(user, t.tabKey));
  const requested = TAB_DEFS.find((t) => t.key === sp.tab);
  const activeKey = (requested && canSeeTab(user, requested.tabKey) ? requested.key : visibleTabs[0]?.key) as
    | string
    | undefined;
  const locked = isContentLocked(job);

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="jobs" />
      <main className="app-main">
        <a href="/jobs" className="label">&larr; Back to Jobs</a>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: "0 0 6px" }}>
              {job.jobNumber} — {job.clientName}
            </h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <StatusBadge status={job.status} />
              {job.deadline && <DeadlineBadge deadline={job.deadline} status={job.status} />}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {job.status === "Closed" && <a className="btn btn-sm" href={`/jobs/${job.id}/print`}>Print Record</a>}
            {job.status === "Draft" && can(user, "submitForApproval") && (
              <form action={submitForApprovalAction.bind(null, job.id)}>
                <button className="btn btn-sm btn-primary" type="submit">Submit for Approval</button>
              </form>
            )}
            {job.status === "WaitingForApproval" && job.budgetStatus === "Draft" && (
              <>
                {can(user, "approveBudget") && <ApproveBudgetControl jobId={job.id} />}
                {can(user, "requestRevision") && <RequestRevisionControl jobId={job.id} />}
              </>
            )}
            {job.status === "ApprovedBudget" && can(user, "submitForReconciliation") && (
              <form action={submitForReconciliationAction.bind(null, job.id)}>
                <button className="btn btn-sm btn-primary" type="submit" disabled={job.expenses.length === 0}>
                  Submit for Reconciliation
                </button>
              </form>
            )}
            {can(user, "editApprovedJob") && job.status !== "Draft" && (
              <form action={toggleAdminUnlockedAction.bind(null, job.id, !job.adminUnlocked)}>
                <button className="btn btn-sm" type="submit">
                  {job.adminUnlocked ? "Re-lock Job" : "Unlock for Editing"}
                </button>
              </form>
            )}
            {can(user, "cancelJob") &&
              (job.status === "Cancelled" ? (
                <form action={restoreCancelledJobAction.bind(null, job.id)}>
                  <button className="btn btn-sm" type="submit">Restore</button>
                </form>
              ) : (
                job.status !== "Closed" && <CancelJobControl jobId={job.id} />
              ))}
            {can(user, "deleteJob") && <DeleteJobControl jobId={job.id} jobNumber={job.jobNumber} />}
          </div>
        </div>

        {job.status === "ApprovedBudget" && job.expenses.length === 0 && can(user, "submitForReconciliation") && (
          <p className="label" style={{ marginTop: 8 }}>
            Submit for Reconciliation is disabled until at least one expense has been logged.
          </p>
        )}

        {job.revisionNote && (
          <div className="card" style={{ padding: 12, marginTop: 12, borderColor: "var(--warn)" }}>
            <div className="label" style={{ color: "var(--warn)" }}>
              Revision requested by {job.revisionNoteBy}
            </div>
            <div style={{ marginTop: 4 }}>{job.revisionNote}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginTop: 16, overflowX: "auto" }}>
          {visibleTabs.map((t) => (
            <a key={t.key} href={`?tab=${t.key}`} className={`tab${activeKey === t.key ? " active" : ""}`}>
              {t.label}
            </a>
          ))}
        </div>
        <ActiveTabAutoScroll />

        <div style={{ marginTop: 16 }}>
          {activeKey === "overview" && <OverviewTab job={job} user={user} />}
          {activeKey === "design" && <DesignTab job={job} user={user} locked={locked} />}
          {activeKey === "cutlist" && <CutListTab job={job} user={user} locked={locked} />}
          {activeKey === "cost" && <CostEstimateTab job={job} user={user} locked={locked} />}
          {activeKey === "budget" && <BudgetTab job={job} user={user} />}
          {activeKey === "expenses" && <ExpensesTab job={job} user={user} />}
          {activeKey === "payments" && <PaymentsTab job={job} user={user} />}
          {activeKey === "activity" && <ActivityTab activity={job.activity} />}
          {!activeKey && <p className="label">You don&apos;t have access to any tabs on this job.</p>}
        </div>
      </main>
    </div>
  );
}
