import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canSeePage, can, type PermissionMap } from "@/lib/permissions";
import { AppNav } from "../../AppNav";
import { setUserActiveAction } from "../actions";
import { RoleForm } from "./RoleForm";
import { PasswordResetForm } from "./PasswordResetForm";
import { DeleteUserControl } from "./DeleteUserControl";
import { PermissionsForm } from "./PermissionsForm";

const ROLE_LABEL: Record<string, string> = {
  Designer: "Designer",
  Supervisor: "Supervisor",
  Manager: "Manager",
  OwnerFinance: "Owner/Finance",
  Admin: "Admin",
};

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!canSeePage(currentUser, "users") || !can(currentUser, "manageUsers")) redirect("/users");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) notFound();

  return (
    <div className="app-shell">
      <AppNav user={currentUser} activePage="users" />
      <main className="app-main">
        <a href="/users" className="label">&larr; Back to Users</a>
        <h1 style={{ margin: "4px 0 12px" }}>{target.name} <span className="label">({target.username})</span></h1>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
          <RoleForm userId={target.id} role={target.role} />

          <form action={setUserActiveAction.bind(null, target.id, !target.active)}>
            <label className="label">Status</label>
            <div>
              <button className="btn btn-sm" type="submit" disabled={target.id === currentUser.id}>
                {target.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </form>

          <PasswordResetForm userId={target.id} />

          {target.id !== currentUser.id && (
            <div>
              <label className="label">Danger Zone</label>
              <DeleteUserControl userId={target.id} />
            </div>
          )}
        </div>

        <p className="label">Current role default: {ROLE_LABEL[target.role]}</p>

        <PermissionsForm
          key={target.updatedAt.toISOString()}
          userId={target.id}
          actions={target.actions as PermissionMap}
          actionViews={target.actionViews as PermissionMap}
          pages={target.pages as PermissionMap}
          tabs={target.tabs as PermissionMap}
        />
      </main>
    </div>
  );
}
