import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { AppNav } from "../AppNav";
import { CreateUserForm } from "./CreateUserForm";
import { setUserActiveAction } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  Designer: "Designer",
  Supervisor: "Supervisor",
  Manager: "Manager",
  OwnerFinance: "Owner/Finance",
  Admin: "Admin",
};

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "users")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="users" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to Users.</p>
        </main>
      </div>
    );
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const canManage = can(user, "manageUsers");

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="users" />
      <main className="app-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ marginTop: 0 }}>Users</h1>
          {canManage && <CreateUserForm />}
        </div>

        <table className="card" style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead>
            <tr>
              {["Name", "Username", "Role", "Status", ""].map((h) => (
                <th key={h} className="label" style={{ textAlign: "left", padding: "10px 12px" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <td style={{ padding: "10px 12px" }}>
                  {canManage ? <a href={`/users/${u.id}`} style={{ color: "inherit" }}>{u.name}</a> : u.name}
                </td>
                <td className="mono" style={{ padding: "10px 12px" }}>{u.username}</td>
                <td style={{ padding: "10px 12px" }}>{ROLE_LABEL[u.role]}</td>
                <td style={{ padding: "10px 12px" }}>{u.active ? "Active" : "Deactivated"}</td>
                <td style={{ padding: "10px 12px" }}>
                  {canManage && u.id !== user.id && (
                    <form action={setUserActiveAction.bind(null, u.id, !u.active)}>
                      <button className="btn btn-sm" type="submit">
                        {u.active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {canManage && (
          <p className="label" style={{ marginTop: 16 }}>
            Click a user&apos;s name to edit their role, password, and full permissions.
          </p>
        )}
      </main>
    </div>
  );
}
