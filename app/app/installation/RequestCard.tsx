"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, ChevronRight, Truck } from "lucide-react";
import { Lightbox } from "../Lightbox";
import {
  approveInstallationRequestAction,
  deleteInstallationRequestAction,
  rejectInstallationRequestAction,
  withdrawInstallationRequestAction,
  type ActionState,
} from "./actions";
import type { InstallationRequestData } from "./data";
import { br } from "./RequestForm";

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Pending: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  Approved: { bg: "var(--success-soft)", fg: "var(--success)" },
  Rejected: { bg: "var(--danger-soft)", fg: "var(--danger)" },
};
const STATUS_LABEL: Record<string, string> = { Pending: "Waiting", Approved: "Approved", Rejected: "Rejected" };

export function fmtWhen(d: Date) {
  return new Date(d).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Addis_Ababa" });
}
const fmtDay = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Addis_Ababa" });

const initial: ActionState = { error: null };
function ConfirmReject({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-sm btn-danger" type="submit" disabled={pending || !enabled}>
      {pending ? "Rejecting…" : "Confirm Reject"}
    </button>
  );
}
function RejectControl({ id, onRejected }: { id: string; onRejected: (note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, formAction] = useFormState(rejectInstallationRequestAction.bind(null, id), initial);
  useEffect(() => {
    if (state !== initial && state.error === null) {
      onRejected(note);
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  if (!open) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setOpen(true)}>
        Reject
      </button>
    );
  }
  return (
    <form action={formAction} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", flex: "1 1 100%" }}>
      <input className="input" style={{ flex: "1 1 200px" }} name="note" placeholder="Reason (the employee sees it)" value={note} onChange={(e) => setNote(e.target.value)} />
      <ConfirmReject enabled={note.trim().length > 0} />
      <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {state.error && <span className="login-error">{state.error}</span>}
    </form>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "pricedb-field-full" : undefined}>
      <div className="label" style={{ marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5 }}>{children}</div>
    </div>
  );
}

export function RequestCard({
  request: r,
  currentUserId,
  currentUserName,
  canRequest,
  canApprove,
  onUpdate,
  onReplace,
  onRemove,
  onEdit,
}: {
  request: InstallationRequestData;
  currentUserId: string;
  currentUserName: string;
  canRequest: boolean;
  canApprove: boolean;
  onUpdate: (id: string, patch: Partial<InstallationRequestData>) => void;
  onReplace: (request: InstallationRequestData) => void;
  onRemove: (id: string) => void;
  onEdit: (request: InstallationRequestData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tone = STATUS_TONE[r.status];
  const isOwner = r.submittedById === currentUserId;
  const pending = r.status === "Pending";
  const owed = r.remainingAfter > 0;

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const approve = async () => {
    const res = await run(() => approveInstallationRequestAction(r.id));
    if (!res) return;
    if ("error" in res) setError(res.error);
    else onReplace(res.request);
  };
  const withdraw = async () => {
    const res = await run(() => withdrawInstallationRequestAction(r.id));
    if (res && res.error) setError(res.error);
    else if (res) onRemove(r.id);
  };
  const remove = async () => {
    const res = await run(() => deleteInstallationRequestAction(r.id));
    if (res && res.error) setError(res.error);
    else if (res) onRemove(r.id);
  };

  return (
    <div className={`card expense-row inst-card${pending && canApprove ? " inst-card-waiting" : ""}`}>
      <button type="button" className="expense-row-header" onClick={() => setOpen((o) => !o)}>
        <span className="pricedb-row-icon stock">
          <Truck size={15} strokeWidth={2} />
        </span>
        <div className="expense-row-main">
          <div className="expense-row-item">
            {r.jobNumber} · {r.jobTitle}
          </div>
          <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            <span className="badge" style={{ background: tone.bg, color: tone.fg }}>
              {STATUS_LABEL[r.status]}
            </span>
            {r.sendCount > 1 && <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text)" }}>Sent {r.sendCount}×</span>}
            {owed && r.status !== "Rejected" && (
              <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                Still owes {br(r.remainingAfter)}
              </span>
            )}
            <span className="label" style={{ margin: 0 }}>{r.clientName}</span>
          </span>
        </div>
        <div className="expense-row-amounts">
          <div className="expense-row-total">{br(r.requestTotal)}</div>
          <div>{fmtWhen(r.submittedAt)}</div>
        </div>
        <ChevronRight size={16} strokeWidth={2} className="expense-row-chevron" style={{ transform: open ? "rotate(90deg)" : undefined }} />
      </button>

      {open && (
        <div className="expense-row-detail" style={{ display: "grid", gap: 14 }}>
          {/* Money summary */}
          <div className="inst-summary">
            {r.soldPrice !== null && (
              <div>
                <span>Sold price</span>
                <b>{br(r.soldPrice)}</b>
              </div>
            )}
            {r.soldPrice !== null && (
              <div>
                <span>Paid before</span>
                <b>{br(Math.max(0, r.soldPrice - r.remainingBefore))}</b>
              </div>
            )}
            <div>
              <span>{r.status === "Approved" ? "Paid in this request" : "This request"}</span>
              <b>{br(r.requestTotal)}</b>
            </div>
            <div className={owed ? "owed" : "paid"}>
              <span>Remaining after</span>
              <b>{br(r.remainingAfter)}</b>
            </div>
          </div>
          {r.requestTotal > r.remainingBefore && pending && (
            <div className="inst-alert inst-alert-warn">
              <AlertTriangle size={15} /> The payments are <b>{br(Math.round((r.requestTotal - r.remainingBefore) * 100) / 100)}</b> more than the remaining balance — check the amounts.
            </div>
          )}
          {owed && pending && canApprove && (
            <div className="inst-alert inst-alert-danger">
              <AlertTriangle size={15} /> The client still owes <b>{br(r.remainingAfter)}</b> after this request. You can still approve.
            </div>
          )}

          <div className="pricedb-field-grid">
            <Field label="Client">{r.clientName}</Field>
            <Field label="Sales rep">{r.salesRep || "—"}</Field>
            <Field label="Installation days (Workshop Schedule)" full>
              {r.installDays.length ? r.installDays.join(", ") : "Not scheduled"}
            </Field>
            <Field label="Requested by">
              {r.submittedByName} · {fmtWhen(r.submittedAt)}
            </Field>
            {r.decidedBy && (
              <Field label={`${STATUS_LABEL[r.status]} by`}>
                {r.decidedBy}
                {r.decidedAt ? ` · ${fmtWhen(r.decidedAt)}` : ""}
              </Field>
            )}
            {r.rejectionNote && (
              <Field label="Rejection reason" full>
                <span style={{ color: "var(--danger)" }}>{r.rejectionNote}</span>
              </Field>
            )}
            {r.note && (
              <Field label="Note" full>
                {r.note}
              </Field>
            )}
          </div>

          {/* This request's payments */}
          <div>
            <div className="inst-sub">
              {r.status === "Approved" ? "Payments in this request (recorded on the job)" : "Payments in this request"}
              {r.status === "Pending" && <span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>waiting for approval</span>}
            </div>
            {r.payments.length ? (
              <div className="inst-pay-list new">
                {r.payments.map((p) => (
                  <div key={p.id} className="inst-pay-item">
                    <Lightbox file={p.receipt} size={44} />
                    <div className="inst-pay-what">
                      <b>{br(p.amount)}</b>
                      <span>{p.method || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="label">No payment in this request (the job was already fully paid).</p>
            )}
          </div>

          <div>
            <div className="inst-sub">Withholding receipt</div>
            {r.withholding ? <Lightbox file={r.withholding} size={56} /> : <p className="label">None attached.</p>}
          </div>

          {/* Approver: everything already paid on the job */}
          {r.jobPayments && (
            <div>
              <div className="inst-sub">Payments already on this job</div>
              {r.jobPayments.length ? (
                <div className="inst-pay-list">
                  {r.jobPayments.map((p) => (
                    <div key={p.id} className="inst-pay-item">
                      {p.receipt ? <Lightbox file={p.receipt} size={44} /> : <span className="inst-noimg">—</span>}
                      <div className="inst-pay-what">
                        <b>{br(p.amount)}</b>
                        <span>
                          {p.type === "Final" ? "Final" : p.type} · {fmtDay(p.date)}
                          {p.method ? ` · ${p.method}` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="label">No payments recorded on this job yet.</p>
              )}
              <a className="label" href={`/jobs/${r.jobId}`} style={{ color: "var(--accent)", display: "inline-block", marginTop: 6 }}>
                Open job {r.jobNumber} →
              </a>
            </div>
          )}

          {(pending && canApprove) || (r.status !== "Approved" && isOwner && canRequest) || (canApprove && r.status !== "Approved") ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pending && canApprove && (
                <>
                  <button className="btn btn-sm btn-primary" type="button" disabled={busy} onClick={approve}>
                    {busy ? "Approving…" : owed ? "Approve anyway" : "Approve"}
                  </button>
                  <RejectControl id={r.id} onRejected={(note) => onUpdate(r.id, { status: "Rejected", decidedBy: currentUserName, decidedAt: new Date(), rejectionNote: note })} />
                </>
              )}
              {r.status !== "Approved" && isOwner && canRequest && (
                <>
                  <button className="btn btn-sm" type="button" onClick={() => onEdit(r)}>
                    {r.status === "Rejected" ? "Fix and re-send" : "Edit"}
                  </button>
                  <button className="btn btn-sm btn-ghost" type="button" disabled={busy} onClick={withdraw}>
                    Withdraw
                  </button>
                </>
              )}
              {canApprove && r.status !== "Approved" && !isOwner && (
                confirmDelete ? (
                  <>
                    <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={remove}>
                      Confirm Delete
                    </button>
                    <button className="btn btn-sm btn-ghost" type="button" onClick={() => setConfirmDelete(false)}>
                      Never Mind
                    </button>
                  </>
                ) : (
                  <button className="btn btn-sm btn-ghost" type="button" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                )
              )}
            </div>
          ) : null}
          {error && <p className="login-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
