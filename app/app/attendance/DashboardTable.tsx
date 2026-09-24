"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { getAttendanceDashboardAction, type AttendanceDashboardRow } from "./actions";
import { rowFlags, thisWeekRange, todayRange } from "./dashboardData";
import { formatAddisTime, formatDateLabel } from "@/lib/attendance/day";
import type { AttendanceSchedule } from "@/lib/attendance/settings";

export function DashboardTable({
  initialRows,
  schedule,
}: {
  initialRows: AttendanceDashboardRow[];
  schedule: AttendanceSchedule;
}) {
  const [rows, setRows] = useState(initialRows);
  const [range, setRange] = useState<"today" | "week">("week");
  const [loading, setLoading] = useState(false);

  async function applyRange(next: "today" | "week") {
    setRange(next);
    setLoading(true);
    const { start, end } = next === "today" ? todayRange() : thisWeekRange();
    const result = await getAttendanceDashboardAction(start, end);
    setRows(result);
    setLoading(false);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className={`btn btn-sm${range === "today" ? " btn-primary" : " btn-ghost"}`}
          onClick={() => applyRange("today")}
        >
          Today
        </button>
        <button
          type="button"
          className={`btn btn-sm${range === "week" ? " btn-primary" : " btn-ghost"}`}
          onClick={() => applyRange("week")}
        >
          This Week
        </button>
        {loading && <span className="label">Loading…</span>}
      </div>

      <div className="dtable-wrap">
        <table className="dtable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Check-In</th>
              <th>Check-Out</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const { checkInLate, checkOutEarly } = rowFlags(r, schedule);
              return (
                <tr key={`${r.userId}:${r.date.toISOString()}`}>
                  <td data-label="Date">{formatDateLabel(r.date)}</td>
                  <td data-label="Employee">{r.userName}</td>
                  <td data-label="Check-In">
                    {r.checkInAt ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {formatAddisTime(r.checkInAt)}
                        {checkInLate && (
                          <span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                            Late
                          </span>
                        )}
                        {r.checkInPhotoUrl && (
                          <a href={r.checkInPhotoUrl} target="_blank" rel="noreferrer" aria-label="View check-in photo">
                            <Camera size={13} strokeWidth={1.75} />
                          </a>
                        )}
                      </span>
                    ) : (
                      <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                        Absent
                      </span>
                    )}
                  </td>
                  <td data-label="Check-Out">
                    {r.checkOutAt ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {formatAddisTime(r.checkOutAt)}
                        {checkOutEarly && (
                          <span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                            Early
                          </span>
                        )}
                        {r.checkOutPhotoUrl && (
                          <a href={r.checkOutPhotoUrl} target="_blank" rel="noreferrer" aria-label="View check-out photo">
                            <Camera size={13} strokeWidth={1.75} />
                          </a>
                        )}
                      </span>
                    ) : r.checkInAt ? (
                      <span className="label">Still in</span>
                    ) : (
                      <span className="label">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="label">
                  No active employees.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
