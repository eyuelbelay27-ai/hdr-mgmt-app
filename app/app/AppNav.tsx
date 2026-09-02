"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Tag,
  Package,
  ClipboardCheck,
  Users,
  Settings as SettingsIcon,
  Menu,
  X,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { PAGE_KEYS, canSeePage, type PermissionSubject } from "@/lib/permissions";
import { signOutAction } from "./actions";
import { HadarMark } from "./Logo";

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  jobs: Briefcase,
  calculator: Tag,
  inventory: Package,
  reconciliation: ClipboardCheck,
  users: Users,
  settings: SettingsIcon,
};

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
          {open ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
        </button>
        <div className="mobile-topbar-title">{activeLabel}</div>
      </div>

      <div className={`nav-overlay${open ? " nav-open" : ""}`} onClick={() => setOpen(false)} />

      <nav className={`app-nav${open ? " nav-open" : ""}`}>
        <div style={{ padding: "4px 12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <HadarMark size={26} />
          <div>
            <div className="font-display" style={{ fontWeight: 700, fontSize: 14 }}>Hadar Advertising</div>
            <div className="label" style={{ marginTop: 4, marginBottom: 0 }}>
              {user.name} · {user.role}
            </div>
          </div>
        </div>

        {PAGE_KEYS.filter((p) => canSeePage(user, p.key)).map((p) => {
          const Icon = NAV_ICONS[p.key];
          const isActive = activePage === p.key;
          return (
            <a
              key={p.key}
              className={`nav-item${isActive ? " active" : ""}`}
              href={p.key === "dashboard" ? "/" : `/${p.key}`}
            >
              {Icon && <Icon size={17} strokeWidth={1.75} color={isActive ? "var(--accent)" : "currentColor"} />}
              {p.label}
            </a>
          );
        })}

        <form action={signOutAction} style={{ marginTop: 16, padding: "0 12px" }}>
          <button className="btn" style={{ width: "100%", justifyContent: "center" }} type="submit">
            <LogOut size={15} strokeWidth={1.75} />
            Sign Out
          </button>
        </form>
      </nav>
    </>
  );
}
