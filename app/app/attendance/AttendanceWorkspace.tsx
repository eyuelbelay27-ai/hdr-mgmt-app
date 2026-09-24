"use client";

import { useState } from "react";
import { DashboardTable } from "./DashboardTable";
import { SettingsPanel } from "./SettingsPanel";
import type { AttendanceDashboardRow } from "./actions";
import type { AttendanceSchedule } from "@/lib/attendance/settings";
import type { AuthorizedDeviceInfo } from "@/lib/attendance/device";

export function AttendanceWorkspace({
  initialRows,
  schedule,
  devices,
}: {
  initialRows: AttendanceDashboardRow[];
  schedule: AttendanceSchedule;
  devices: AuthorizedDeviceInfo[];
}) {
  const [section, setSection] = useState<"dashboard" | "settings">("dashboard");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="crm-toolbar">
        <button
          type="button"
          className={`tab${section === "dashboard" ? " active" : ""}`}
          onClick={() => setSection("dashboard")}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={`tab${section === "settings" ? " active" : ""}`}
          onClick={() => setSection("settings")}
        >
          Settings
        </button>
      </div>

      {section === "dashboard" ? (
        <DashboardTable initialRows={initialRows} schedule={schedule} />
      ) : (
        <SettingsPanel schedule={schedule} devices={devices} />
      )}
    </div>
  );
}
