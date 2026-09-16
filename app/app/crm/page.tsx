import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { AppNav } from "../AppNav";
import { CrmWorkspace } from "./CrmWorkspace";
import { CRM_LEAD_ORDER, CRM_PAGE_SIZE, toLeadData } from "./listData";

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

  const [leadRows, repRows] = await Promise.all([
    prisma.crmLead.findMany({
      where: leadWhere,
      orderBy: CRM_LEAD_ORDER,
      include: { assignedTo: { select: { name: true } } },
      take: CRM_PAGE_SIZE + 1,
    }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const hasMore = leadRows.length > CRM_PAGE_SIZE;
  const initialLeads = leadRows.slice(0, CRM_PAGE_SIZE).map(toLeadData);
  // Only someone who can actually work leads may be assigned one.
  const reps = repRows
    .filter((u) => can(u, "workCrmLeads"))
    .map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="crm" />
      <main className="app-main">
        <CrmWorkspace
          isAdmin={isAdmin}
          reps={reps}
          initialLeads={initialLeads}
          initialHasMore={hasMore}
          currentUserId={user.id}
        />
      </main>
    </div>
  );
}
