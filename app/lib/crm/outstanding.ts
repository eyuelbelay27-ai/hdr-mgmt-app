import { prisma } from "@/lib/prisma";
import { can, canSeePage, type PermissionSubject } from "@/lib/permissions";
import { getCrmSettings } from "./settings";
import { dueReportWeek, weekRangeFilter, type ReportWeek } from "./week";

export interface CrmOutstanding {
  reportDay: number;
  week: ReportWeek;
  /** Reps who received leads in this week and haven't generated their
   * report yet. A rep only ever sees themselves in here. */
  pendingReps: { id: string; name: string }[];
  /** Whether the calling user personally owes this week's report. */
  selfOwes: boolean;
}

/**
 * Who still owes a report for the week that just closed.
 *
 * A rep with no leads that week owes nothing — there would be nothing in
 * the report — so they're left out rather than nagged. Only the week that
 * most recently closed is tracked; missing an older week isn't chased.
 */
export async function getCrmOutstanding(
  user: (PermissionSubject & { id: string }) | null
): Promise<CrmOutstanding | null> {
  if (!user) return null;
  if (!canSeePage(user, "crm")) return null;

  const isAdmin = can(user, "manageCrmLeads");
  const isRep = can(user, "workCrmLeads");
  if (!isAdmin && !isRep) return null;

  const { reportDay } = await getCrmSettings();
  const week = dueReportWeek(reportDay);
  const range = weekRangeFilter(week);

  const [withLeads, done] = await Promise.all([
    prisma.crmLead.groupBy({
      by: ["assignedToId"],
      where: {
        receivedAt: range,
        ...(isAdmin ? {} : { assignedToId: user.id }),
      },
    }),
    prisma.crmWeeklyReport.findMany({
      where: { weekEnd: week.end },
      select: { repId: true },
    }),
  ]);

  const doneIds = new Set(done.map((r) => r.repId));
  const pendingIds = withLeads.map((g) => g.assignedToId).filter((id) => !doneIds.has(id));

  const pendingUsers = pendingIds.length
    ? await prisma.user.findMany({
        where: { id: { in: pendingIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return {
    reportDay,
    week,
    // A rep is told about their own outstanding report and nobody else's.
    pendingReps: isAdmin ? pendingUsers : pendingUsers.filter((u) => u.id === user.id),
    selfOwes: isRep && pendingIds.includes(user.id),
  };
}
