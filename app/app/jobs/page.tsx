import { redirect } from "next/navigation";
import { JobStatus } from "@prisma/client";
import { Search, AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { can, canSeePage, canSeeTab } from "@/lib/permissions";
import { STATUS_LABEL } from "@/lib/job-status";
import { AppNav } from "../AppNav";
import { STATUS_ICON } from "../StatusBadge";
import { NewJobForm } from "./NewJobForm";
import { JobsList } from "./JobsList";
import { fetchJobsPage, STATUS_OPTIONS } from "./listData";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; paid?: string }>;
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
  const paidFilter = sp.paid === "unpaid" ? "unpaid" : "";
  const filter = { q, status: statusFilter, paid: paidFilter };

  const canSeeFinancials = canSeeTab(user, "tab_payments");
  const { jobs, hasMore } = await fetchJobsPage(user, filter, 0);

  // Builds a Jobs URL from the given overrides, keeping whatever else in
  // {q, statusFilter, paidFilter} isn't overridden — so any one chip
  // (status or Unpaid) toggles independently without dropping the others.
  function jobsHref(overrides: { status?: string; paid?: string }): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const status = overrides.status ?? statusFilter;
    if (status) params.set("status", status);
    const paid = overrides.paid ?? paidFilter;
    if (paid) params.set("paid", paid);
    const qs = params.toString();
    return qs ? `/jobs?${qs}` : "/jobs";
  }
  const allHref = jobsHref({ status: "" });
  const unpaidHref = jobsHref({ paid: paidFilter ? "" : "unpaid" });
  const chipHref = (status: JobStatus) => jobsHref({ status });

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
          {paidFilter && <input type="hidden" name="paid" value={paidFilter} />}
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
          {(q || statusFilter || paidFilter) && <a className="btn btn-sm btn-ghost" href="/jobs">Clear</a>}
        </form>

        <div className="jobs-chip-row">
          <a href={allHref} className={`jobs-chip${!statusFilter ? " active" : ""}`}>
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
          {/* Independent of the status chips above — a job can be, say,
              Approved Budget *and* Unpaid at once, so this toggles on its
              own rather than joining the mutually-exclusive status set. */}
          <a href={unpaidHref} className={`jobs-chip${paidFilter ? " active" : ""}`}>
            <AlertTriangle size={13} strokeWidth={2} />
            Unpaid
          </a>
        </div>

        <JobsList
          key={`${q}|${statusFilter}|${paidFilter}`}
          initialJobs={jobs}
          initialHasMore={hasMore}
          canSeeFinancials={canSeeFinancials}
          filter={filter}
        />
      </main>
    </div>
  );
}
