"use client";

import { useState } from "react";
import { ChevronRight, Clock } from "lucide-react";
import {
  updateOvertimeRequestAction,
  withdrawOvertimeRequestAction,
  approveOvertimeRequestAction,
  type OvertimeRequestData,
} from "./actions";
import { RejectOvertimeControl } from "./RejectOvertimeControl";
import { EmployeeNamesField } from "./EmployeeNamesField";

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Pending: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  Approved: { bg: "var(--success-soft)", fg: "var(--success)" },
  Rejected: { bg: "var(--danger-soft)", fg: "var(--danger)" },
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtTime(d: Date) {
  return d.toISOString().slice(11, 16);
}

export function OvertimeCard({
  request,
  currentUserId,
  currentUserName,
  canSubmit,
  canApprove,
  onUpdate,
  onRemove,
}: {
  request: OvertimeRequestData;
  currentUserId: string;
  currentUserName: string;
  canSubmit: boolean;
  canApprove: boolean;
  onUpdate: (id: string, patch: Partial<OvertimeRequestData>) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = request.submittedById === currentUserId;
  const isPending = request.status === "Pending";
  const tone = STATUS_TONE[request.status];

  const handleApprove = async () => {
    setBusy(true);
    await approveOvertimeRequestAction(request.id);
    onUpdate(request.id, { status: "Approved", decidedBy: currentUserName, decidedAt: new Date(), rejectionNote: null });
    setBusy(false);
  };

  const handleWithdraw = async () => {
    setBusy(true);
    await withdrawOvertimeRequestAction(request.id);
    onRemove(request.id);
  };

  const handleSaveEdit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    setError(null);
    setBusy(true);
    const result = await updateOvertimeRequestAction(request.id, { error: null }, formData);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const employeeNames = formData.getAll("employeeNames").map((v) => String(v));
    const date = String(formData.get("date"));
    const time = String(formData.get("time"));
    onUpdate(request.id, {
      title: String(formData.get("title")),
      description: String(formData.get("description") ?? "").trim() || null,
      startAt: new Date(`${date}T${time}:00`),
      employeeNames,
    });
    setEditing(false);
  };

  return (
    <div className="card expense-row">
      <button type="button" className="expense-row-header" onClick={() => setOpen((o) => !o)}>
        <span className="pricedb-row-icon stock">
          <Clock size={15} strokeWidth={2} />
        </span>
        <div className="expense-row-main">
          <div className="expense-row-item">{request.title}</div>
          <span className="badge" style={{ background: tone.bg, color: tone.fg }}>
            {request.status}
          </span>
        </div>
        <div className="expense-row-amounts">
          <div className="expense-row-total">{fmtDate(request.startAt)}</div>
          <div>{fmtTime(request.startAt)} · {request.employeeNames.length} people</div>
        </div>
        <ChevronRight size={16} strokeWidth={2} className="expense-row-chevron" style={{ transform: open ? "rotate(90deg)" : undefined }} />
      </button>

      {open && (
        <div className="expense-row-detail">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit(e.currentTarget);
              }}
              style={{ display: "grid", gap: 10 }}
            >
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Work Title</div>
                <input className="input" name="title" defaultValue={request.title} required />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Description</div>
                <textarea className="input" name="description" rows={2} defaultValue={request.description ?? ""} style={{ resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 140px" }}>
                  <div className="label" style={{ marginBottom: 2 }}>Date</div>
                  <input className="input" name="date" type="date" defaultValue={fmtDate(request.startAt)} required />
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <div className="label" style={{ marginBottom: 2 }}>Start Time</div>
                  <input className="input" name="time" type="time" defaultValue={fmtTime(request.startAt)} required />
                </div>
              </div>
              <EmployeeNamesField initialNames={request.employeeNames} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm btn-primary" type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </button>
                <button className="btn btn-sm btn-ghost" type="button" onClick={() => { setEditing(false); setError(null); }}>
                  Cancel
                </button>
              </div>
              {error && <p className="login-error">{error}</p>}
            </form>
          ) : (
            <div className="pricedb-field-grid">
              {request.description && (
                <div className="pricedb-field-full">
                  <div className="label" style={{ marginBottom: 2 }}>Description</div>
                  <div style={{ fontSize: 13.5 }}>{request.description}</div>
                </div>
              )}
              <div className="pricedb-field-full">
                <div className="label" style={{ marginBottom: 2 }}>Employees Going Out</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {request.employeeNames.map((name, i) => (
                    <span key={`${name}-${i}`} className="badge" style={{ background: "var(--surface-3)", color: "var(--text)" }}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Submitted By</div>
                <div style={{ fontSize: 13.5 }}>{request.submittedByName}</div>
              </div>
              {request.decidedBy && (
                <div>
                  <div className="label" style={{ marginBottom: 2 }}>{request.status} By</div>
                  <div style={{ fontSize: 13.5 }}>
                    {request.decidedBy}{request.decidedAt ? ` · ${fmtDate(request.decidedAt)}` : ""}
                  </div>
                </div>
              )}
              {request.rejectionNote && (
                <div className="pricedb-field-full">
                  <div className="label" style={{ marginBottom: 2 }}>Rejection Reason</div>
                  <div style={{ fontSize: 13.5 }}>{request.rejectionNote}</div>
                </div>
              )}
            </div>
          )}

          {!editing && isPending && (isOwner && canSubmit || canApprove) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {isOwner && canSubmit && (
                <>
                  <button className="btn btn-sm" type="button" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={handleWithdraw}>
                    {busy ? "Withdrawing…" : "Withdraw"}
                  </button>
                </>
              )}
              {canApprove && (
                <>
                  <button className="btn btn-sm btn-primary" type="button" disabled={busy} onClick={handleApprove}>
                    {busy ? "Approving…" : "Approve"}
                  </button>
                  <RejectOvertimeControl
                    requestId={request.id}
                    onRejected={(note) =>
                      onUpdate(request.id, { status: "Rejected", decidedBy: currentUserName, decidedAt: new Date(), rejectionNote: note })
                    }
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
