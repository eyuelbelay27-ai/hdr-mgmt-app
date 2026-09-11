import { redirect } from "next/navigation";
import { JobStatus } from "@prisma/client";
import { Search } from "lucide-react";
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
  const filter = { q, status: statusFilter };

  const canSeeFinancials = canSeeTab(user, "tab_payments");
  const { jobs, hasMore } = await fetchJobsPage(user, filter, 0);

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

        <JobsList
          key={`${q}|${statusFilter}`}
          initialJobs={jobs}
          initialHasMore={hasMore}
          canSeeFinancials={canSeeFinancials}
          filter={filter}
        />
      </main>
    </div>
  );
}
