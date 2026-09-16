"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { toMonthInputValue, toWeekInputValue } from "@/lib/crm/week";
import type { CrmLeadFilters, CrmPeriod } from "./listData";

const PERIOD_MODES: { mode: CrmPeriod["mode"]; label: string }[] = [
  { mode: "all", label: "All Time" },
  { mode: "week", label: "Week" },
  { mode: "month", label: "Month" },
];

/**
 * Filters the lead list by when it was *received* — never by when the row
 * was created — plus, for an Admin, by which rep it's assigned to. A rep
 * gets the same week/month picker over their own leads, just without the
 * rep dropdown (they're always looking at their own).
 */
export function LeadFilters({
  reps,
  isAdmin,
  busy,
  onApply,
}: {
  reps: { id: string; name: string }[];
  isAdmin: boolean;
  busy: boolean;
  onApply: (filters: CrmLeadFilters) => void;
}) {
  const now = new Date();
  const [repId, setRepId] = useState("");
  const [mode, setMode] = useState<CrmPeriod["mode"]>("all");
  const [weekValue, setWeekValue] = useState(() => toWeekInputValue(now));
  const [monthValue, setMonthValue] = useState(() => toMonthInputValue(now));

  function apply(nextMode: CrmPeriod["mode"], nextRepId: string, nextWeek: string, nextMonth: string) {
    const period: CrmPeriod =
      nextMode === "week" ? { mode: "week", value: nextWeek } : nextMode === "month" ? { mode: "month", value: nextMonth } : { mode: "all" };
    onApply({ repId: nextRepId || null, period });
  }

  function selectMode(nextMode: CrmPeriod["mode"]) {
    setMode(nextMode);
    apply(nextMode, repId, weekValue, monthValue);
  }

  return (
    <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
      <div className="form-row">
        {isAdmin && (
          <div className="form-field">
            <label className="label">Sales Rep</label>
            <select
              className="input"
              value={repId}
              onChange={(e) => {
                setRepId(e.target.value);
                apply(mode, e.target.value, weekValue, monthValue);
              }}
            >
              <option value="">All reps</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="form-field">
          <label className="label">Period</label>
          <div className="crm-period-toggle">
            {PERIOD_MODES.map((p) => (
              <button
                key={p.mode}
                type="button"
                className={`btn btn-sm${mode === p.mode ? " btn-primary" : ""}`}
                disabled={busy}
                onClick={() => selectMode(p.mode)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {mode === "week" && (
          <div className="form-field">
            <label className="label">Week (by date received)</label>
            <input
              className="input"
              type="week"
              value={weekValue}
              onChange={(e) => {
                setWeekValue(e.target.value);
                apply("week", repId, e.target.value, monthValue);
              }}
            />
          </div>
        )}
        {mode === "month" && (
          <div className="form-field">
            <label className="label">Month (by date received)</label>
            <input
              className="input"
              type="month"
              value={monthValue}
              onChange={(e) => {
                setMonthValue(e.target.value);
                apply("month", repId, weekValue, e.target.value);
              }}
            />
          </div>
        )}
      </div>
      {busy && (
        <div className="label" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={13} strokeWidth={1.75} /> Filtering…
        </div>
      )}
    </div>
  );
}
