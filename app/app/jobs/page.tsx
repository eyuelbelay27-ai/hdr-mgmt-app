import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { AppNav } from "../AppNav";
import { StatusBadge, DeadlineBadge } from "../StatusBadge";
import { NewJobForm } from "./NewJobForm";

export default async function JobsPage() {
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

  const allJobs = await prisma.job.findMany({ orderBy: { createdAt: "desc" } });
  // Draft jobs are visible only to users with manageDraftJobs (Section 5.4) —
  // deliberately decoupled from createJob.
  const jobs = allJobs.filter((j) => j.status !== "Draft" || can(user, "manageDraftJobs"));

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="jobs" />
      <main className="app-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ marginTop: 0 }}>Jobs</h1>
          {can(user, "createJob") && <NewJobForm />}
        </div>

        <table className="card" style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead>
            <tr>
              {["Job #", "Client", "Title", "Status", "Created"].map((h) => (
                <th key={h} className="label" style={{ textAlign: "left", padding: "10px 12px" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <td className="mono" style={{ padding: "10px 12px" }}>
                  <a href={`/jobs/${j.id}`} style={{ color: "inherit" }}>
                    {j.jobNumber}
                  </a>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <a href={`/jobs/${j.id}`} style={{ display: "flex", gap: 8, alignItems: "center", color: "inherit" }}>
                    {j.clientName}
                    {j.deadline && <DeadlineBadge deadline={j.deadline} status={j.status} />}
                  </a>
                </td>
                <td style={{ padding: "10px 12px" }}>{j.title}</td>
                <td style={{ padding: "10px 12px" }}>
                  <StatusBadge status={j.status} />
                </td>
                <td style={{ padding: "10px 12px" }}>{j.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td className="label" style={{ padding: "10px 12px" }} colSpan={5}>
                  No jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  );
}
