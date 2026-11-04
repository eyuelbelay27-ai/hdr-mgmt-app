import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { can, canSeePage } from "@/lib/permissions";
import { AppNav } from "../AppNav";
import { InstallationBoard } from "./InstallationBoard";
import { loadEligibleJobs, loadRequests } from "./data";

export const dynamic = "force-dynamic";

export default async function InstallationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "installation")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="installation" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to Installation Approval.</p>
        </main>
      </div>
    );
  }

  const canRequest = can(user, "requestInstallation");
  const canApprove = can(user, "approveInstallation");
  const [requests, jobs] = await Promise.all([loadRequests(user.id, canApprove), canRequest ? loadEligibleJobs() : Promise.resolve([])]);

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="installation" />
      <main className="app-main">
        <h1 style={{ marginTop: 0 }}>Installation Approval</h1>
        <p className="label" style={{ marginBottom: 12 }}>
          Request approval before a sign leaves the workshop for installation. The remaining payments are recorded on the job once approved.
        </p>
        <InstallationBoard
          initialRequests={requests}
          jobs={jobs}
          currentUserId={user.id}
          currentUserName={user.name}
          canRequest={canRequest}
          canApprove={canApprove}
        />
      </main>
    </div>
  );
}
