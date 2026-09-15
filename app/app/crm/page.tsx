import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { getCrmOutstanding } from "@/lib/crm/outstanding";
import { toDateInputValue } from "@/lib/crm/week";
import { AppNav } from "../AppNav";
import { CrmWorkspace } from "./CrmWorkspace";
import { CRM_LEAD_ORDER, CRM_PAGE_SIZE, toLeadData, toReportData } from "./listData";

const REPORT_HISTORY_LIMIT = 30;

export default async function CrmPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = can(user, "manageCrmLeads");
  const isRep = can(user, "workCrmLeads");

  if (!canSeePage(user, "crm") || (!isAdmin && !isRep)) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="crm" />
        <main className="app-main">
          <h1 style={{ marginTop: 0 }}>CRM</h1>
          <p className="label">You don&apos;t have access to the CRM.</p>
        </main>
      </div>
    );
  }

  // An Admin sees every rep's leads; a rep sees only their own, enforced
  // here and again inside every server action.
  const leadWhere = isAdmin ? {} : { assignedToId: user.id };

  const [leadRows, reportRows, repRows, outstanding] = await Promise.all([
    prisma.crmLead.findMany({
      where: leadWhere,
      orderBy: CRM_LEAD_ORDER,
      include: { assignedTo: { select: { name: true } } },
      take: CRM_PAGE_SIZE + 1,
    }),
    prisma.crmWeeklyReport.findMany({
      where: isAdmin ? {} : { repId: user.id },
      orderBy: [{ weekEnd: "desc" }, { generatedAt: "desc" }],
      include: { rep: { select: { name: true } } },
      take: REPORT_HISTORY_LIMIT,
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getCrmOutstanding(user),
  ]);

  const hasMore = leadRows.length > CRM_PAGE_SIZE;
  const initialLeads = leadRows.slice(0, CRM_PAGE_SIZE).map(toLeadData);
  const reports = reportRows.map(toReportData);
  // Only someone who can actually work leads may be assigned one.
  const reps = repRows
    .filter((u) => can(u, "workCrmLeads"))
    .map((u) => ({ id: u.id, name: u.name }));

  const dueWeek = outstanding
    ? {
        start: toDateInputValue(outstanding.week.start),
        end: toDateInputValue(outstanding.week.end),
      }
    : null;

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="crm" />
      <main className="app-main">
        <CrmWorkspace
          currentUserId={user.id}
          isAdmin={isAdmin}
          isRep={isRep}
          reps={reps}
          initialLeads={initialLeads}
          initialHasMore={hasMore}
          reports={reports}
          reportDay={outstanding?.reportDay ?? 5}
          dueWeek={dueWeek}
          pendingReps={outstanding?.pendingReps ?? []}
          selfOwes={outstanding?.selfOwes ?? false}
        />
      </main>
    </div>
  );
}
