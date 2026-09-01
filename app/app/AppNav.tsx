"use client";

import { useState } from "react";
import { PAGE_KEYS, canSeePage, type PermissionSubject } from "@/lib/permissions";
import { signOutAction } from "./actions";

export function AppNav({
  user,
  activePage,
}: {
  user: PermissionSubject & { name: string; role: string };
  activePage: string;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = PAGE_KEYS.find((p) => p.key === activePage)?.label ?? "Hadar Advertising";

  return (
    <>
      <div className="mobile-topbar">
        <button
          type="button"
          className="hamburger-btn"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
        <div className="mobile-topbar-title">{activeLabel}</div>
      </div>

      <div className={`nav-overlay${open ? " nav-open" : ""}`} onClick={() => setOpen(false)} />

      <nav className={`app-nav${open ? " nav-open" : ""}`}>
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
    </>
  );
}
