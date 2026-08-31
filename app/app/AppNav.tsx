import { PAGE_KEYS, canSeePage, type PermissionSubject } from "@/lib/permissions";
import { signOutAction } from "./actions";

export function AppNav({
  user,
  activePage,
}: {
  user: PermissionSubject & { name: string; role: string };
  activePage: string;
}) {
  return (
    <nav className="app-nav">
      <div style={{ padding: "4px 12px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Hadar Advertising</div>
        <div className="label" style={{ marginTop: 4, marginBottom: 0 }}>
          {user.name} · {user.role}
        </div>
      </div>

      {PAGE_KEYS.filter((p) => canSeePage(user, p.key)).map((p) => (
        <a
          key={p.key}
          className={`nav-item${activePage === p.key ? " active" : ""}`}
          href={p.key === "dashboard" ? "/" : `/${p.key}`}
        >
          {p.label}
        </a>
      ))}

      <form action={signOutAction} style={{ marginTop: 16, padding: "0 12px" }}>
        <button className="btn" style={{ width: "100%", justifyContent: "center" }} type="submit">
          Sign Out
        </button>
      </form>
    </nav>
  );
}
