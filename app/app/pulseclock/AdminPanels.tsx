"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { X } from "lucide-react";
import { daysInEthiopianMonth, type EthiopianDate } from "@/lib/payroll/ethiopian";
import type { MonthReport } from "@/lib/pulseclock/reports";
import {
  addEmployeeAction,
  addExceptionAction,
  correctAttendanceAction,
  deleteExceptionAction,
  lockAdminAction,
  resetFaceAction,
  saveRulesAction,
  setAdminPinAction,
  setEmployeeActiveAction,
  type PulseState,
} from "./actions";

const INITIAL: PulseState = { error: null };
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Submit({ children, className = "pc-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`pc-button ${className}`} disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}

function Feedback({ state }: { state: PulseState }) {
  if (state.error) return <p className="pc-error">{state.error}</p>;
  if (state.message) return <p className="pc-ok">{state.message}</p>;
  return null;
}

function Heading({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="pc-heading">
      <div>
        <div className="pc-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Avatar({ initials, photo }: { initials: string; photo: string | null }) {
  return (
    <span className="pc-avatar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img src={photo} alt="" /> : initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export interface RegisterRow {
  employeeId: string;
  name: string;
  role: string | null;
  initials: string;
  photo: string | null;
  checkIn: string;
  checkOut: string;
  checkInHHMM: string;
  checkOutHHMM: string;
  early: boolean;
  corrected: boolean;
  status: "present" | "late" | "leave" | "absent" | "pending" | "off";
  note: string | null;
}

const STATUS_PILL: Record<RegisterRow["status"], [string, string]> = {
  present: ["pc-good", "On time"],
  late: ["pc-warn", "Late"],
  leave: ["pc-blue", "On leave"],
  absent: ["pc-bad", "Absent"],
  pending: ["pc-neutral", "Not in yet"],
  off: ["pc-neutral", "Day off"],
};

export function OverviewPanel({
  dayIso,
  dayLabel,
  prevIso,
  nextIso,
  isToday,
  dayNote,
  rows,
}: {
  dayIso: string;
  dayLabel: string;
  prevIso: string;
  nextIso: string | null;
  isToday: boolean;
  dayNote: string | null;
  rows: RegisterRow[];
}) {
  const [editing, setEditing] = useState<RegisterRow | null>(null);
  const count = (s: RegisterRow["status"]) => rows.filter((r) => r.status === s).length;
  const present = count("present") + count("late");

  return (
    <>
      <Heading eyebrow={isToday ? "Today" : "Register"} title="Overview" sub={dayLabel + (dayNote ? ` · ${dayNote}` : "")}>
        <div className="pc-monthnav">
          <a href={`/pulseclock?view=admin&tab=overview&date=${prevIso}`} aria-label="Previous day">‹</a>
          <b>{isToday ? "Today" : dayLabel.split(", ").slice(1).join(", ")}</b>
          {nextIso ? (
            <a href={`/pulseclock?view=admin&tab=overview&date=${nextIso}`} aria-label="Next day">›</a>
          ) : (
            <a aria-disabled style={{ opacity: 0.3 }}>›</a>
          )}
        </div>
      </Heading>

      <div className="pc-metrics">
        <div className="pc-metric"><small>Present</small><b>{present}</b><em>of {rows.length} employees</em></div>
        <div className="pc-metric"><small>Late</small><b>{count("late")}</b><em>after the grace period</em></div>
        <div className="pc-metric"><small>On leave</small><b>{count("leave")}</b><em>approved</em></div>
        <div className="pc-metric">
          <small>{isToday ? "Not in yet" : "Absent"}</small>
          <b>{isToday ? count("pending") : count("absent")}</b>
          <em>{isToday ? "no check-in so far" : "no check-in, no leave"}</em>
        </div>
      </div>

      <div className="pc-panel">
        <div className="pc-panelhead">
          <div>
            <h2>Register</h2>
            <p>Edit fixes a wrong or missing time. Every correction needs a reason and is logged.</p>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="pc-empty">No employees yet. Add them under Employees.</p>
        ) : (
          <div className="pc-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Check in</th>
                  <th>Check out</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td>
                      <span className="pc-person">
                        <Avatar initials={r.initials} photo={r.photo} />
                        <span>
                          <b>{r.name}</b>
                          <small>{r.role ?? ""}</small>
                        </span>
                      </span>
                    </td>
                    <td>{r.checkIn}</td>
                    <td>
                      {r.checkOut}
                      {r.early && <span className="pc-pill pc-warn" style={{ marginLeft: 6 }}>Early</span>}
                    </td>
                    <td>
                      <span className={`pc-pill ${STATUS_PILL[r.status][0]}`}>{STATUS_PILL[r.status][1]}</span>
                      {r.corrected && <span className="pc-pill pc-neutral" style={{ marginLeft: 6 }}>Corrected</span>}
                      {r.note && <div className="pc-sub">{r.note}</div>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="pc-button pc-secondary pc-small" onClick={() => setEditing(r)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <CorrectionModal row={editing} dayIso={dayIso} dayLabel={dayLabel} onClose={() => setEditing(null)} />}
    </>
  );
}

function CorrectionModal({ row, dayIso, dayLabel, onClose }: { row: RegisterRow; dayIso: string; dayLabel: string; onClose: () => void }) {
  const [state, action] = useFormState(correctAttendanceAction, INITIAL);
  useEffect(() => {
    if (state.message) onClose();
  }, [state, onClose]);

  return (
    <div className="pc-backdrop" role="dialog" aria-modal="true" aria-label="Correct attendance">
      <div className="pc-modal">
        <button type="button" className="pc-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="pc-modalcopy">
          <div className="pc-eyebrow">Correction</div>
          <h2>{row.name}</h2>
          <p>{dayLabel}. Leave a time empty to clear it.</p>
        </div>
        <form action={action} className="pc-stack">
          <input type="hidden" name="employeeId" value={row.employeeId} />
          <input type="hidden" name="workDate" value={`${dayIso}T00:00:00.000Z`} />
          <div className="pc-twocol" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label className="pc-field">
              Check in
              <input type="time" name="checkIn" defaultValue={row.checkInHHMM} />
            </label>
            <label className="pc-field">
              Check out
              <input type="time" name="checkOut" defaultValue={row.checkOutHHMM} />
            </label>
          </div>
          <label className="pc-field">
            Reason (required)
            <input name="reason" required placeholder="e.g. Forgot to check out" />
          </label>
          <Feedback state={state} />
          <Submit>Save correction</Submit>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export interface EmployeeItem {
  id: string;
  name: string;
  role: string | null;
  active: boolean;
  initials: string;
  photo: string | null;
  enrolledAt: string | null;
}

export function EmployeesPanel({ employees }: { employees: EmployeeItem[] }) {
  const [state, action] = useFormState(addEmployeeAction, INITIAL);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (!state.error) setFormKey((k) => k + 1);
  }, [state]);

  function run(fn: () => Promise<PulseState>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const res = await fn();
      setError(res.error);
    });
  }

  return (
    <>
      <Heading eyebrow="People" title="Employees" sub="This list is separate from app users. Faces register on each person's first check-in." />
      <div className="pc-twocol">
        <div className="pc-panel">
          <div className="pc-panelhead"><div><h2>Add employee</h2></div></div>
          <form key={formKey} action={action} className="pc-stack">
            <label className="pc-field">
              Full name
              <input name="name" required />
            </label>
            <label className="pc-field">
              Role (optional)
              <input name="role" placeholder="e.g. Designer" />
            </label>
            <Feedback state={state} />
            <Submit>Add employee</Submit>
          </form>
        </div>
        <div className="pc-panel">
          <div className="pc-panelhead">
            <div>
              <h2>Team</h2>
              <p>{employees.filter((e) => e.active).length} active</p>
            </div>
          </div>
          {error && <p className="pc-error">{error}</p>}
          {employees.length === 0 && <p className="pc-empty">No employees yet.</p>}
          {employees.map((e) => (
            <div key={e.id} className="pc-employee" style={{ opacity: e.active ? 1 : 0.55 }}>
              <Avatar initials={e.initials} photo={e.photo} />
              <span>
                <b>{e.name}</b>
                <small className="pc-sub">{[e.role, e.enrolledAt ? `Face registered ${e.enrolledAt}` : null].filter(Boolean).join(" · ")}</small>
              </span>
              <span className={`pc-pill ${!e.active ? "pc-neutral" : e.enrolledAt ? "pc-good" : "pc-warn"}`}>
                {!e.active ? "Inactive" : e.enrolledAt ? "Registered" : "Not registered"}
              </span>
              <span className="pc-rowbtns">
                {e.enrolledAt && (
                  <button
                    type="button"
                    className="pc-button pc-secondary pc-small"
                    disabled={pending}
                    onClick={() => run(() => resetFaceAction(e.id), `Reset ${e.name}'s face? Their next check-in registers a new one.`)}
                  >
                    Reset face
                  </button>
                )}
                <button
                  type="button"
                  className={`pc-button pc-small ${e.active ? "pc-danger" : "pc-secondary"}`}
                  disabled={pending}
                  onClick={() =>
                    run(() => setEmployeeActiveAction(e.id, !e.active), e.active ? `Deactivate ${e.name}? They won't be able to check in.` : undefined)
                  }
                >
                  {e.active ? "Deactivate" : "Reactivate"}
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ReportsPanel({
  monthKey,
  monthLabel,
  prevKey,
  nextKey,
  report,
}: {
  monthKey: string;
  monthLabel: string;
  prevKey: string;
  nextKey: string;
  report: MonthReport;
}) {
  function download() {
    const lines = [
      [`PulseClock — ${monthLabel}`],
      [],
      ["Employee", "Role", "Working days", "Present", "Late", "Left early", "Leave", "Absent", "Hours"],
      ...report.rows.map((r) => [r.name, r.role ?? "", r.workDays, r.present, r.late, r.early, r.leave, r.absent, r.hours]),
      [],
      ["Date", "Employee", "Check in", "Check out", "Status"],
      ...report.days.map((d) => [d.date, d.name, d.checkIn, d.checkOut, d.status]),
    ];
    const csv = lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulseclock-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Heading eyebrow="Monthly" title="Reports" sub="Counts working days so far this month, excluding holidays.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="pc-monthnav">
            <a href={`/pulseclock?view=admin&tab=reports&month=${prevKey}`} aria-label="Previous month">‹</a>
            <b>{monthLabel}</b>
            <a href={`/pulseclock?view=admin&tab=reports&month=${nextKey}`} aria-label="Next month">›</a>
          </div>
          <button type="button" className="pc-button pc-primary" onClick={download}>Download CSV</button>
        </div>
      </Heading>

      <div className="pc-reportstrip">
        <span><small>Working days</small><b>{report.workDays}</b></span>
        <span><small>Attendance</small><b>{report.rate === null ? "—" : `${report.rate}%`}</b></span>
        <span><small>Late arrivals</small><b>{report.late}</b></span>
        <span><small>Hours worked</small><b>{report.hours}</b></span>
      </div>

      <div className="pc-panel">
        <div className="pc-panelhead"><div><h2>By employee</h2></div></div>
        {report.rows.length === 0 ? (
          <p className="pc-empty">Nothing recorded this month.</p>
        ) : (
          <div className="pc-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Left early</th>
                  <th>Leave</th>
                  <th>Absent</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td>
                      <b>{r.name}</b>
                      {r.role && <div className="pc-sub">{r.role}</div>}
                    </td>
                    <td>{r.present} / {r.workDays}</td>
                    <td>{r.late > 0 ? <span className="pc-pill pc-warn">{r.late}</span> : 0}</td>
                    <td>{r.early}</td>
                    <td>{r.leave}</td>
                    <td>{r.absent > 0 ? <span className="pc-pill pc-bad">{r.absent}</span> : 0}</td>
                    <td>{r.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Leave & holidays
// ---------------------------------------------------------------------------

export interface ExceptionItem {
  type: "leave" | "holiday";
  id: string;
  date: string;
  title: string;
  reason: string;
  by: string;
  upcoming: boolean;
}

export function ExceptionsPanel({
  employees,
  items,
  today,
  monthNames,
}: {
  employees: { id: string; name: string }[];
  items: ExceptionItem[];
  today: EthiopianDate;
  monthNames: string[];
}) {
  const [state, action] = useFormState(addExceptionAction, INITIAL);
  const [type, setType] = useState<"leave" | "holiday">("leave");
  const [date, setDate] = useState(today);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const days = daysInEthiopianMonth(date.year, date.month);
  const years = [today.year - 1, today.year, today.year + 1];

  return (
    <>
      <Heading eyebrow="Calendar" title="Leave & holidays" sub="Days marked here aren't counted as absences. Dates are in the Ethiopian calendar." />
      <div className="pc-twocol">
        <div className="pc-panel">
          <div className="pc-panelhead"><div><h2>Add</h2></div></div>
          <form action={action} className="pc-stack">
            <div className="pc-days" role="radiogroup" aria-label="Type">
              <label><input type="radio" name="type" value="leave" checked={type === "leave"} onChange={() => setType("leave")} /> Employee leave</label>
              <label><input type="radio" name="type" value="holiday" checked={type === "holiday"} onChange={() => setType("holiday")} /> Company holiday</label>
            </div>
            {type === "leave" && (
              <label className="pc-field">
                Employee
                <select name="employeeId" required defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="pc-field">
              Date
              <div className="pc-datefields">
                <select name="dateDay" aria-label="Day" value={Math.min(date.day, days)} onChange={(e) => setDate({ ...date, day: Number(e.target.value) })}>
                  {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select name="dateMonth" aria-label="Month" value={date.month} onChange={(e) => setDate({ ...date, month: Number(e.target.value) })}>
                  {monthNames.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select name="dateYear" aria-label="Year" value={date.year} onChange={(e) => setDate({ ...date, year: Number(e.target.value) })}>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="pc-field">
              Reason
              <input name="reason" placeholder={type === "holiday" ? "e.g. Meskel" : "e.g. Annual leave"} />
            </label>
            <Feedback state={state} />
            <Submit>{type === "holiday" ? "Add holiday" : "Add leave"}</Submit>
          </form>
        </div>
        <div className="pc-panel">
          <div className="pc-panelhead"><div><h2>Recent & upcoming</h2><p>Last 60 days and everything ahead.</p></div></div>
          {error && <p className="pc-error">{error}</p>}
          {items.length === 0 && <p className="pc-empty">Nothing scheduled.</p>}
          {items.map((x) => (
            <div key={`${x.type}-${x.id}`} className="pc-line-item">
              <span>
                <b>
                  {x.title} <span className={`pc-pill ${x.type === "holiday" ? "pc-blue" : "pc-good"}`}>{x.type === "holiday" ? "Holiday" : "Leave"}</span>
                </b>
                <small className="pc-sub">{x.date} · {x.reason} · by {x.by}</small>
              </span>
              <button
                type="button"
                className="pc-button pc-ghost pc-small"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Remove this entry?")) return;
                  start(async () => setError((await deleteExceptionAction(x.type, x.id)).error));
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export function AuditPanel({ entries }: { entries: { id: string; actor: string; action: string; detail: string; when: string }[] }) {
  return (
    <>
      <Heading eyebrow="Accountability" title="Audit trail" sub="Check-ins, rejected faces, corrections and admin changes. Latest 300." />
      <div className="pc-panel">
        {entries.length === 0 && <p className="pc-empty">Nothing yet.</p>}
        {entries.map((a) => (
          <div key={a.id} className="pc-line-item">
            <span>
              <b>{a.action}</b>
              <small className="pc-sub">{a.detail} · by {a.actor}</small>
            </span>
            <time>{a.when}</time>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function SettingsPanel({
  shiftStart,
  shiftEnd,
  grace,
  workDays,
}: {
  shiftStart: string;
  shiftEnd: string;
  grace: number;
  workDays: number[];
}) {
  const [rulesState, rulesAction] = useFormState(saveRulesAction, INITIAL);
  const [pinState, pinAction] = useFormState(setAdminPinAction, INITIAL);

  return (
    <>
      <Heading eyebrow="Configuration" title="Settings" sub="Changes apply to check-ins from now on; existing records keep their flags." />
      <div className="pc-twocol">
        <div className="pc-panel">
          <div className="pc-panelhead"><div><h2>Work schedule</h2></div></div>
          <form action={rulesAction}>
            <div className="pc-setting">
              <span><b>Shift starts</b><small className="pc-sub">Addis Ababa time</small></span>
              <input type="time" name="shiftStart" defaultValue={shiftStart} required style={{ width: 130 }} />
            </div>
            <div className="pc-setting">
              <span><b>Shift ends</b><small className="pc-sub">Leaving before this is &quot;left early&quot;</small></span>
              <input type="time" name="shiftEnd" defaultValue={shiftEnd} required style={{ width: 130 }} />
            </div>
            <div className="pc-setting">
              <span><b>Grace period</b><small className="pc-sub">Minutes after start before &quot;late&quot;</small></span>
              <input type="number" name="grace" min={0} max={240} defaultValue={grace} required style={{ width: 90 }} />
            </div>
            <div className="pc-setting" style={{ flexWrap: "wrap" }}>
              <span><b>Work days</b></span>
              <div className="pc-days">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <label key={d}>
                    <input type="checkbox" name="workDays" value={d} defaultChecked={workDays.includes(d)} />
                    {WEEKDAY_SHORT[d]}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              <Feedback state={rulesState} />
              <Submit>Save schedule</Submit>
            </div>
          </form>
        </div>
        <div className="pc-stack">
          <div className="pc-panel">
            <div className="pc-panelhead"><div><h2>Change admin PIN</h2><p>Everyone using the admin side needs the new PIN.</p></div></div>
            <form action={pinAction} className="pc-stack">
              <label className="pc-field">
                New PIN (4–8 digits)
                <input name="pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="\d{4,8}" required />
              </label>
              <label className="pc-field">
                Repeat PIN
                <input name="confirm" type="password" inputMode="numeric" autoComplete="new-password" pattern="\d{4,8}" required />
              </label>
              <Feedback state={pinState} />
              <Submit className="pc-secondary">Change PIN</Submit>
            </form>
          </div>
          <div className="pc-panel">
            <div className="pc-panelhead"><div><h2>Admin session</h2><p>Unlocks last 12 hours on this device.</p></div></div>
            <form action={lockAdminAction}>
              <button type="submit" className="pc-button pc-danger pc-full">Lock admin now</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
