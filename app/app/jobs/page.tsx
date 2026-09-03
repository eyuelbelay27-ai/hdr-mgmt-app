import { redirect } from "next/navigation";
import { Prisma, JobStatus } from "@prisma/client";
import { Search, DollarSign, Wallet, Clock, CalendarDays, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage, canSeeTab } from "@/lib/permissions";
import { STATUS_LABEL } from "@/lib/job-status";
import { remainingPayment } from "@/lib/calc/payments";
import { toNumber } from "@/lib/money";
import { AppNav } from "../AppNav";
import { StatusBadge, DeadlineBadge, STATUS_ICON } from "../StatusBadge";
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

  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
  const chipHref = (status: JobStatus) => `/jobs?status=${status}${qParam}`;

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="jobs" />
      <main className="app-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ marginTop: 0 }}>Jobs</h1>
          {can(user, "createJob") && <NewJobForm />}
        </div>

        <form method="get" style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} strokeWidth={2} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
            <input
              className="input"
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Search by client, job #, or title"
              style={{ paddingLeft: 36, borderRadius: 999 }}
            />
          </div>
          <button className="btn btn-sm btn-primary" type="submit">Search</button>
          {(q || statusFilter) && <a className="btn btn-sm btn-ghost" href="/jobs">Clear</a>}
        </form>

        <div className="jobs-chip-row">
          <a href={`/jobs${q ? `?q=${encodeURIComponent(q)}` : ""}`} className={`jobs-chip${!statusFilter ? " active" : ""}`}>
            All
          </a>
          {STATUS_OPTIONS.map((s) => {
            const Icon = STATUS_ICON[s];
            return (
              <a key={s} href={chipHref(s)} className={`jobs-chip${statusFilter === s ? " active" : ""}`}>
                <Icon size={13} strokeWidth={2} />
                {STATUS_LABEL[s]}
              </a>
            );
          })}
        </div>

        <div className="jobs-desktop-table card dtable-wrap">
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

        <div className="jobs-mobile-cards">
          {jobs.map((j) => {
            const advance = j.payments
              .filter((p) => p.type === "Advance")
              .reduce((s, p) => s + toNumber(p.amount), 0);
            const remaining = remainingPayment(j.costEstimateSoldPrice, j.payments);
            return (
              <div key={j.id} className="card job-card">
                <div className="job-card-top">
                  <div>
                    <div className="label" style={{ marginBottom: 2 }}>Job #</div>
                    <div className="job-card-id">{j.jobNumber}</div>
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 2 }}>Client</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{j.clientName}</div>
                  </div>
                  <div className="job-card-badges">
                    {j.deadline && <DeadlineBadge deadline={j.deadline} status={j.status} />}
                  </div>
                </div>

                <div className="job-card-secondary">
                  <div>
                    <div className="label" style={{ marginBottom: 2 }}>Designer</div>
                    <div style={{ fontSize: 13.5 }}>{j.designer || "—"}</div>
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 2 }}>Status</div>
                    <StatusBadge status={j.status} />
                  </div>
                </div>

                {canSeeFinancials && (
                  <div className="job-card-financials">
                    <div className="job-card-fin-item">
                      <span className="job-card-fin-icon"><DollarSign size={13} strokeWidth={2} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="label" style={{ marginBottom: 0 }}>Final Price</div>
                        <div className="mono" style={{ fontSize: 13.5 }}>{toNumber(j.costEstimateSoldPrice).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="job-card-fin-item">
                      <span className="job-card-fin-icon"><Wallet size={13} strokeWidth={2} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="label" style={{ marginBottom: 0 }}>Advance</div>
                        <div className="mono" style={{ fontSize: 13.5 }}>{advance.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="job-card-fin-item">
                      <span className="job-card-fin-icon"><Clock size={13} strokeWidth={2} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="label" style={{ marginBottom: 0 }}>Remaining</div>
                        <div className="mono" style={{ fontSize: 13.5 }}>{remaining.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="job-card-fin-item">
                      <span className="job-card-fin-icon"><CalendarDays size={13} strokeWidth={2} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="label" style={{ marginBottom: 0 }}>Updated</div>
                        <div style={{ fontSize: 13.5 }}>{j.updatedAt.toISOString().slice(0, 10)}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="job-card-footer">
                  <a className="job-card-open-link" href={`/jobs/${j.id}`}>
                    Open details <ChevronRight size={14} strokeWidth={2} />
                  </a>
                  {j.status === "Closed" && (
                    <a className="btn btn-sm" href={`/jobs/${j.id}/print`}>Print</a>
                  )}
                </div>
              </div>
            );
          })}
          {jobs.length === 0 && (
            <div className="card" style={{ padding: 20 }}>
              <p className="label" style={{ marginBottom: 0 }}>No jobs match.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
