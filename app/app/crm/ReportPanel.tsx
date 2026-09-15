"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { ChevronRight, FileText, Trash2 } from "lucide-react";
import { CRM_STATUS_TONE } from "@/lib/crm/status";
import { formatDateLabel, parseDateOnly, WEEKDAY_NAMES } from "@/lib/crm/week";
import {
  deleteCrmWeeklyReportAction,
  generateCrmWeeklyReportAction,
  type CrmReportActionState,
} from "./actions";
import { SubmitButton } from "../SubmitButton";
import type { CrmReportData } from "./listData";

const initialState: CrmReportActionState = { error: null };

function weekLabel(startIso: string, endIso: string): string {
  const start = parseDateOnly(startIso);
  const end = parseDateOnly(endIso);
  if (!start || !end) return "";
  return `${formatDateLabel(start)} — ${formatDateLabel(end)}`;
}

export function ReportPanel({
  isAdmin,
  isRep,
  reports,
  reportDay,
  dueWeek,
  pendingReps,
  selfOwes,
}: {
  isAdmin: boolean;
  isRep: boolean;
  reports: CrmReportData[];
  reportDay: number;
  dueWeek: { start: string; end: string } | null;
  pendingReps: { id: string; name: string }[];
  selfOwes: boolean;
}) {
  const [repFilter, setRepFilter] = useState("");
  const visible = repFilter ? reports.filter((r) => r.repId === repFilter) : reports;
  const repOptions = Array.from(new Map(reports.map((r) => [r.repId, r.repName])).entries());

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p className="label" style={{ margin: 0 }}>
        Reporting week closes every <strong>{WEEKDAY_NAMES[reportDay]}</strong>. A report covers only the leads
        received during that week, and is frozen the moment it&apos;s generated.
      </p>

      {isRep && dueWeek && (
        <GenerateCard weekEnd={dueWeek.end} label={weekLabel(dueWeek.start, dueWeek.end)} owed={selfOwes} />
      )}

      {isAdmin && dueWeek && (
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>Week ending {weekLabel(dueWeek.start, dueWeek.end).split("—")[1]?.trim()}</h3>
          {pendingReps.length === 0 ? (
            <p className="label" style={{ margin: 0, color: "var(--success)" }}>
              Every rep with leads this week has filed their report.
            </p>
          ) : (
            <p className="label" style={{ margin: 0 }}>
              Still waiting on: <strong>{pendingReps.map((r) => r.name).join(", ")}</strong>
            </p>
          )}
        </div>
      )}

      {isAdmin && repOptions.length > 1 && (
        <div style={{ maxWidth: 260 }}>
          <label className="label">Filter by rep</label>
          <select className="input" value={repFilter} onChange={(e) => setRepFilter(e.target.value)}>
            <option value="">All reps</option>
            {repOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {visible.map((report) => (
          <ReportRow key={report.id} report={report} isAdmin={isAdmin} />
        ))}
        {visible.length === 0 && <p className="label">No reports generated yet.</p>}
      </div>
    </div>
  );
}

function GenerateCard({ weekEnd, label, owed }: { weekEnd: string; label: string; owed: boolean }) {
  const router = useRouter();
  const [state, formAction] = useFormState(generateCrmWeeklyReportAction, initialState);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (state !== initialState && state.generated) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!owed) {
    return (
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 6 }}>This week&apos;s report</h3>
        <p className="label" style={{ margin: 0 }}>
          Nothing outstanding for {label}.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card crm-generate-card" style={{ padding: 14 }}>
      <input type="hidden" name="weekEnd" value={weekEnd} />
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>Weekly report due — {label}</h3>
      <p className="label" style={{ marginTop: 0 }}>
        The report is compiled automatically from the leads you received this week. Check that every one of them shows
        the right status first — once generated, the report is frozen.
      </p>
      <label className="crm-confirm">
        <input type="checkbox" name="confirm" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>I&apos;ve checked every lead from this week and its status is accurate.</span>
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        {confirmed ? (
          <SubmitButton label="Generate Report" pendingLabel="Generating…" className="btn btn-sm btn-primary" />
        ) : (
          <button type="button" className="btn btn-sm" disabled>
            Generate Report
          </button>
        )}
        {state.error && <span className="login-error">{state.error}</span>}
      </div>
    </form>
  );
}

function ReportRow({ report, isAdmin }: { report: CrmReportData; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();
  const failed = report.rows.filter((r) => r.status === "Failed");

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <button type="button" className="crm-report-head" onClick={() => setOpen((v) => !v)}>
        <ChevronRight
          size={15}
          strokeWidth={1.75}
          style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s ease", flexShrink: 0 }}
        />
        <FileText size={15} strokeWidth={1.75} style={{ flexShrink: 0 }} />
        <span className="crm-report-title">
          {isAdmin ? `${report.repName} · ` : ""}
          Week ending {formatDateLabel(report.weekEnd)}
        </span>
        <span className="crm-report-summary">
          {report.leadsWorked} leads · {report.closedCount} closed · {report.totalSale.toLocaleString()} Br
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>Location</th>
                <th>Phone</th>
                <th>Business Type</th>
                <th>Status</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, i) => {
                const tone = CRM_STATUS_TONE[row.status];
                return (
                  <tr key={`${row.phone}-${i}`}>
                    <td data-label="Location">{row.location}</td>
                    <td data-label="Phone">{row.phone}</td>
                    <td data-label="Business Type">{row.businessType}</td>
                    <td data-label="Status">
                      <span className="badge" style={{ background: tone.bg, color: tone.fg }}>
                        {row.status}
                      </span>
                    </td>
                    <td data-label="Result">
                      {row.status === "Closed"
                        ? `${(row.saleAmount ?? 0).toLocaleString()} Br sale · ${(row.profit ?? 0).toLocaleString()} Br profit`
                        : row.status === "Failed"
                          ? row.failureNote || "—"
                          : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="crm-report-totals">
            <div>
              <div className="label">Leads Worked</div>
              <div className="mono">{report.leadsWorked}</div>
            </div>
            <div>
              <div className="label">Closed</div>
              <div className="mono">{report.closedCount}</div>
            </div>
            <div>
              <div className="label">Total Sale</div>
              <div className="mono">{report.totalSale.toLocaleString()} Br</div>
            </div>
            <div>
              <div className="label">Total Profit</div>
              <div className="mono">{report.totalProfit.toLocaleString()} Br</div>
            </div>
            <div>
              <div className="label">Unreachable</div>
              <div className="mono">{report.unreachableCount}</div>
            </div>
            <div>
              <div className="label">Failed</div>
              <div className="mono">{report.failedCount}</div>
            </div>
          </div>

          {failed.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="label">Why leads failed</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {failed.map((row, i) => (
                  <li key={`${row.phone}-fail-${i}`} style={{ fontSize: 13 }}>
                    {row.location} — {row.failureNote || "no reason given"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="label" style={{ marginTop: 10, marginBottom: 0 }}>
            Generated {formatDateLabel(report.generatedAt)}
            {isAdmin && " · "}
            {isAdmin &&
              (confirmDelete ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={async () => {
                      await deleteCrmWeeklyReportAction(report.id);
                      router.refresh();
                    }}
                  >
                    Confirm Delete
                  </button>{" "}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={13} strokeWidth={1.75} /> Delete report
                </button>
              ))}
          </p>
        </div>
      )}
    </div>
  );
}
