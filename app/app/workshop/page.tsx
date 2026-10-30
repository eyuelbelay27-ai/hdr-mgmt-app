import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { canSeePage } from "@/lib/permissions";
import { AppNav } from "../AppNav";
import { WorkshopFrame } from "./WorkshopFrame";

export default async function WorkshopPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!canSeePage(user, "workshop")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="workshop" />
        <main className="app-main">
          <h1 style={{ marginTop: 0 }}>Workshop Schedule</h1>
          <p className="label">You don&apos;t have access to the Workshop Schedule.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="workshop" />
      <main className="app-main">
        <WorkshopFrame />
      </main>
    </div>
  );
}
