"use client";

import { useFormState } from "react-dom";
import { WEEKDAY_NAMES, type CrmSchedule } from "@/lib/crm/schedule";
import { setCrmScheduleAction, type CrmScheduleActionState } from "./actions";
import { SubmitButton } from "../SubmitButton";

const initialState: CrmScheduleActionState = { error: null };

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

/** Admin-only. Sets the twice-a-week schedule that forces every rep to
 * re-confirm their open leads (Section: user request) — two independent
 * (weekday, hour) slots, both in Addis local time, plus a full off switch. */
export function CrmSettingsPanel({ schedule }: { schedule: CrmSchedule }) {
  const [state, formAction] = useFormState(setCrmScheduleAction, initialState);

  return (
    <form action={formAction} className="card" style={{ padding: 16, display: "grid", gap: 14, maxWidth: 520 }}>
      <div>
        <h3 style={{ margin: 0 }}>Pipeline Update Schedule</h3>
        <p className="label" style={{ marginTop: 4, marginBottom: 0 }}>
          Twice a week, every rep&apos;s open leads (not Closed or Failed) get flagged for re-confirmation. The CRM
          tab won&apos;t let a rep continue until every flagged lead has a status re-picked.
        </p>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
        <input type="checkbox" name="enabled" defaultChecked={schedule.enabled} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
        Enabled
      </label>

      <div className="form-row">
        <div className="form-field">
          <label className="label">First check — Day</label>
          <select className="input" name="day1" defaultValue={schedule.day1}>
            {WEEKDAY_NAMES.map((name, i) => (
              <option key={name} value={i}>{name}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="label">First check — Hour</label>
          <select className="input" name="hour1" defaultValue={schedule.hour1}>
            {HOURS.map((h) => (
              <option key={h} value={h}>{hourLabel(h)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="label">Second check — Day</label>
          <select className="input" name="day2" defaultValue={schedule.day2}>
            {WEEKDAY_NAMES.map((name, i) => (
              <option key={name} value={i}>{name}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="label">Second check — Hour</label>
          <select className="input" name="hour2" defaultValue={schedule.hour2}>
            {HOURS.map((h) => (
              <option key={h} value={h}>{hourLabel(h)}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <SubmitButton label="Save Schedule" pendingLabel="Saving…" className="btn btn-sm btn-primary" />
        {state.error && <span className="login-error">{state.error}</span>}
      </div>
    </form>
  );
}
