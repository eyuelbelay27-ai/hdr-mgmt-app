import { redirect } from "next/navigation";
import { Prisma, JobStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage, canSeeTab } from "@/lib/permissions";
import { STATUS_LABEL } from "@/lib/job-status";
import { remainingPayment } from "@/lib/calc/payments";
import { toNumber } from "@/lib/money";
import { AppNav } from "../AppNav";
import { StatusBadge, DeadlineBadge } from "../StatusBadge";
import { NewJobForm } from "./NewJobForm";

const STATUS_OPTIONS: JobStatus[] = [
  "Draft",
  "WaitingForApproval",
  "ApprovedBudget",
  "WaitingForReconciliation",
  "Closed",
  "Cancelled",
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "jobs")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="jobs" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to Jobs.</p>
        </main>
      </div>
    );
  }

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const statusFilter = sp.status && STATUS_OPTIONS.includes(sp.status as JobStatus) ? (sp.status as JobStatus) : "";

  // Draft jobs are visible only to users with manageDraftJobs (Section 5.4) —
  // deliberately decoupled from createJob.
  const conditions: Prisma.JobWhereInput[] = [];
  if (!can(user, "manageDraftJobs")) conditions.push({ status: { not: "Draft" } });
  if (statusFilter) conditions.push({ status: statusFilter });
  if (q) {
    conditions.push({
      OR: [
        { clientName: { contains: q, mode: "insensitive" } },
        { jobNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const canSeeFinancials = canSeeTab(user, "tab_payments");

  const jobs = await prisma.job.findMany({
    where: conditions.length ? { AND: conditions } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { payments: true },
  });

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="jobs" />
      <main className="app-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ marginTop: 0 }}>Jobs</h1>
          {can(user, "createJob") && <NewJobForm />}
        </div>

        <form method="get" className="form-row" style={{ margin: "12px 0", alignItems: "end" }}>
          <div className="form-field">
            <label className="label" htmlFor="q">Search</label>
            <input className="input" id="q" name="q" defaultValue={q} placeholder="Client, job #, or title" />
          </div>
          <div className="form-field">
            <label className="label" htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue={statusFilter}>
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flexDirection: "row", gap: 8 }}>
            <button className="btn btn-sm" type="submit">Filter</button>
            {(q || statusFilter) && (
              <a className="btn btn-sm btn-ghost" href="/jobs">Clear</a>
            )}
          </div>
        </form>

        <div className="card dtable-wrap">
        <table className="dtable">
          <thead>
            <tr>
              {[
                "Job #",
                "Client",
                "Designer",
                "Status",
                ...(canSeeFinancials ? ["Final Price", "Advance", "Remaining"] : []),
                "Updated",
                "Record",
                "",
              ].map((h) => (
                <th key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const advance = j.payments
                .filter((p) => p.type === "Advance")
                .reduce((s, p) => s + toNumber(p.amount), 0);
              const remaining = remainingPayment(j.costEstimateSoldPrice, j.payments);
              return (
                <tr key={j.id}>
                  <td className="mono" data-label="Job #">
                    <a href={`/jobs/${j.id}`} style={{ color: "inherit" }}>{j.jobNumber}</a>
                  </td>
                  <td data-label="Client">
                    <a href={`/jobs/${j.id}`} style={{ display: "flex", gap: 8, alignItems: "center", color: "inherit" }}>
                      {j.clientName}
                      {j.deadline && <DeadlineBadge deadline={j.deadline} status={j.status} />}
                    </a>
                  </td>
                  <td data-label="Designer">{j.designer || "—"}</td>
                  <td data-label="Status">
                    <StatusBadge status={j.status} />
                  </td>
                  {canSeeFinancials && (
                    <>
                      <td className="mono" data-label="Final Price">{toNumber(j.costEstimateSoldPrice).toLocaleString()}</td>
                      <td className="mono" data-label="Advance">{advance.toLocaleString()}</td>
                      <td className="mono" data-label="Remaining">{remaining.toLocaleString()}</td>
                    </>
                  )}
                  <td data-label="Updated">{j.updatedAt.toISOString().slice(0, 10)}</td>
                  <td data-label="Record">
                    {j.status === "Closed" && (
                      <a className="btn btn-sm" href={`/jobs/${j.id}/print`}>Print</a>
                    )}
                  </td>
                  <td>
                    <a href={`/jobs/${j.id}`} style={{ color: "inherit" }}>Open ›</a>
                  </td>
                </tr>
              );
            })}
            {jobs.length === 0 && (
              <tr>
                <td className="label" colSpan={canSeeFinancials ? 9 : 6}>
                  No jobs match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </main>
    </div>
  );
}
