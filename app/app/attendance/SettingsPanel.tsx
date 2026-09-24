"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { ShieldCheck, Trash2 } from "lucide-react";
import {
  authorizeDeviceAction,
  revokeDeviceAction,
  setAttendanceScheduleAction,
  type ScheduleActionState,
} from "./actions";
import type { AttendanceSchedule } from "@/lib/attendance/settings";
import type { AuthorizedDeviceInfo } from "@/lib/attendance/device";
import { formatAddisMoment } from "@/lib/attendance/day";
import { SubmitButton } from "../SubmitButton";

const initialState: ScheduleActionState = { error: null };

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 15, 30, 45];

function hourLabel(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

export function SettingsPanel({
  schedule,
  devices,
}: {
  schedule: AttendanceSchedule;
  devices: AuthorizedDeviceInfo[];
}) {
  const [state, formAction] = useFormState(setAttendanceScheduleAction, initialState);
  const [deviceList, setDeviceList] = useState(devices);
  const [authorizing, setAuthorizing] = useState(false);
  const [authorizeMsg, setAuthorizeMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleAuthorize() {
    setAuthorizing(true);
    setAuthorizeMsg(null);
    const res = await authorizeDeviceAction();
    setAuthorizing(false);
    if (res.error) {
      setAuthorizeMsg(res.error);
    } else {
      setAuthorizeMsg("This browser is now authorized as the kiosk device.");
      // No server-side list refresh call available without a page reload;
      // a simple reload picks up the fresh device row the next time this
      // section is visited, which is fine — authorizing is a rare,
      // deliberate one-time setup action, not a frequent one.
    }
  }

  function handleRevoke(id: string) {
    startTransition(() => {
      setDeviceList((prev) => prev.filter((d) => d.id !== id));
    });
    void revokeDeviceAction(id);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Kiosk Device</h3>
          <p className="label" style={{ marginTop: 4, marginBottom: 0 }}>
            Check-in/check-out only works from a browser that has authorized itself here. Open this page on the
            office PC, signed in as an admin, and click the button below — once.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-sm btn-primary" disabled={authorizing} onClick={handleAuthorize}>
            <ShieldCheck size={14} strokeWidth={2} /> {authorizing ? "Authorizing…" : "Authorize This Browser"}
          </button>
          {authorizeMsg && <span className="label">{authorizeMsg}</span>}
        </div>
        {deviceList.length > 0 && (
          <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
            {deviceList.map((d) => (
              <div
                key={d.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5 }}
              >
                <span>
                  {d.label || "Device"} — authorized by {d.authorizedByName} on {formatAddisMoment(d.authorizedAt)}
                  {d.lastSeenAt ? ` · last used ${formatAddisMoment(d.lastSeenAt)}` : ""}
                </span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleRevoke(d.id)}>
                  <Trash2 size={13} strokeWidth={1.75} /> Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <form action={formAction} className="card" style={{ padding: 16, display: "grid", gap: 14, maxWidth: 520 }}>
        <div>
          <h3 style={{ margin: 0 }}>Expected Times</h3>
          <p className="label" style={{ marginTop: 4, marginBottom: 0 }}>
            Used only to flag late check-ins / early check-outs on the dashboard — never blocks an actual
            check-in or check-out.
          </p>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="label">Expected Check-In — Hour</label>
            <select className="input" name="expectedCheckInHour" defaultValue={schedule.expectedCheckInHour}>
              {HOURS.map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Minute</label>
            <select className="input" name="expectedCheckInMinute" defaultValue={schedule.expectedCheckInMinute}>
              {MINUTES.map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="label">Expected Check-Out — Hour</label>
            <select className="input" name="expectedCheckOutHour" defaultValue={schedule.expectedCheckOutHour}>
              {HOURS.map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Minute</label>
            <select className="input" name="expectedCheckOutMinute" defaultValue={schedule.expectedCheckOutMinute}>
              {MINUTES.map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SubmitButton label="Save" pendingLabel="Saving…" className="btn btn-sm btn-primary" />
          {state.error && <span className="login-error">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
