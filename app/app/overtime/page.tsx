import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { AppNav } from "../AppNav";
import { OvertimeBoard } from "./OvertimeBoard";

export default async function OvertimePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "overtime")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="overtime" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to Overtime Control.</p>
        </main>
      </div>
    );
  }

  // Sorted by when it was submitted, never by an editable field — a
  // Pending request's date/time can be edited by its owner, and sorting
  // by that would reshuffle the list mid-edit (see the Price Database fix
  // for the same class of bug).
  const requests = await prisma.overtimeRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { submittedBy: { select: { name: true } } },
  });

  const initialRequests = requests.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    startAt: r.startAt,
    employeeNames: r.employeeNames,
    status: r.status,
    submittedById: r.submittedById,
    submittedByName: r.submittedBy.name,
    decidedBy: r.decidedBy,
    decidedAt: r.decidedAt,
    rejectionNote: r.rejectionNote,
  }));

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="overtime" />
      <main className="app-main">
        <h1 style={{ marginTop: 0 }}>Overtime Control</h1>
        <p className="label" style={{ marginBottom: 12 }}>
          Submit a request before working overtime. It&apos;s registered once approved.
        </p>

        <OvertimeBoard
          initialRequests={initialRequests}
          currentUserId={user.id}
          currentUserName={user.name}
          canSubmit={can(user, "submitOvertimeRequest")}
          canApprove={can(user, "approveOvertimeRequest")}
        />
      </main>
    </div>
  );
}
