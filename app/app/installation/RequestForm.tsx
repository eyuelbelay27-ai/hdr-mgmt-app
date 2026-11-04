"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { prepareReceipt } from "../payroll/prepareReceipt";
import { Lightbox } from "../Lightbox";
import { createInstallationRequestAction, updateInstallationRequestAction, uploadInstallationFileAction } from "./actions";
import { PAYMENT_METHODS } from "./shared";
import type { EligibleJob, FileData, InstallationRequestData } from "./data";

interface PaymentRow {
  key: number;
  amount: string;
  method: string;
  receipt: FileData | null;
  uploading: boolean;
  error: string | null;
}

let nextKey = 1;
const emptyRow = (): PaymentRow => ({ key: nextKey++, amount: "", method: "Cash", receipt: null, uploading: false, error: null });
export const br = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} Br`;

/** Shrinks a photo if needed and uploads it on its own (each upload stays under 1 MB). */
async function uploadOne(file: File): Promise<{ file: FileData } | { error: string }> {
  const prepared = await prepareReceipt(file);
  if ("error" in prepared) return prepared;
  const fd = new FormData();
  fd.append("file", prepared.file);
  try {
    return await uploadInstallationFileAction(fd);
  } catch {
    return { error: "Couldn't upload. Check your connection and try again." };
  }
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="inst-step">
      <div className="inst-step-head">
        <span className="inst-step-n">{n}</span>
        <div>
          <div className="inst-step-title">{title}</div>
          {hint && <div className="label" style={{ marginTop: 2 }}>{hint}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * New installation request (or editing / re-sending one): pick the job,
 * add the remaining payment(s) with receipt photos, optionally attach the
 * withholding receipt, add a note, send.
 */
export function RequestForm({
  jobs,
  editing,
  onDone,
  onCancel,
}: {
  jobs: EligibleJob[];
  editing?: InstallationRequestData;
  onDone: (request: InstallationRequestData) => void;
  onCancel: () => void;
}) {
  const [jobId, setJobId] = useState(editing?.jobId ?? "");
  const [rows, setRows] = useState<PaymentRow[]>(
    editing?.payments.length
      ? editing.payments.map((p) => ({ key: nextKey++, amount: String(p.amount), method: p.method ?? "Other", receipt: p.receipt, uploading: false, error: null }))
      : [emptyRow()]
  );
  const [withholding, setWithholding] = useState<FileData | null>(editing?.withholding ?? null);
  const [whBusy, setWhBusy] = useState(false);
  const [whError, setWhError] = useState<string | null>(null);
  const [note, setNote] = useState(editing?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const job = jobs.find((j) => j.id === jobId);
  const remaining = editing ? editing.remainingBefore : job?.remaining ?? 0;
  const total = rows.reduce((s, r) => s + (Number(r.amount) > 0 ? Number(r.amount) : 0), 0);
  const after = Math.max(0, Math.round((remaining - total) * 100) / 100);
  const anyUploading = whBusy || rows.some((r) => r.uploading);
  const resend = editing?.status === "Rejected";

  const patch = (key: number, p: Partial<PaymentRow>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));

  async function pickReceipt(key: number, file: File | undefined) {
    if (!file) return;
    patch(key, { uploading: true, error: null });
    const res = await uploadOne(file);
    patch(key, "error" in res ? { uploading: false, error: res.error } : { uploading: false, receipt: res.file });
  }

  async function pickWithholding(file: File | undefined) {
    if (!file) return;
    setWhBusy(true);
    setWhError(null);
    const res = await uploadOne(file);
    setWhBusy(false);
    if ("error" in res) setWhError(res.error);
    else setWithholding(res.file);
  }

  async function submit() {
    setError(null);
    if (!jobId) return setError("Pick the job to be installed.");
    const filled = rows.filter((r) => r.amount.trim() || r.receipt);
    for (let i = 0; i < filled.length; i++) {
      if (!(Number(filled[i].amount) > 0)) return setError(`Payment ${i + 1}: enter an amount greater than 0.`);
      if (!filled[i].receipt) return setError(`Payment ${i + 1}: attach the receipt photo.`);
    }
    if (!filled.length && remaining > 0) return setError("Add the remaining payment with its receipt photo.");
    const input = {
      jobId,
      payments: filled.map((r) => ({ amount: Number(r.amount), method: r.method, receipt: r.receipt as FileData })),
      withholding,
      note,
    };
    setBusy(true);
    try {
      const res = editing ? await updateInstallationRequestAction(editing.id, input) : await createInstallationRequestAction(input);
      if ("error" in res) setError(res.error);
      else onDone(res.request);
    } catch {
      setError("Couldn't send. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <div className="card inst-form">
      <div className="inst-form-title">{editing ? (resend ? "Fix and re-send" : "Edit request") : "New installation request"}</div>
      {editing?.rejectionNote && resend && (
        <div className="inst-alert inst-alert-danger">
          <b>Rejected by {editing.decidedBy}:</b> {editing.rejectionNote}
        </div>
      )}

      <Step n={1} title="Job to be installed" hint={editing ? undefined : "Jobs in implementation (Approved Budget) without a waiting request."}>
        {editing ? (
          <div className="inst-job-fixed">
            <b>{editing.jobNumber}</b> · {editing.jobTitle} <span className="label">— {editing.clientName}</span>
          </div>
        ) : jobs.length ? (
          <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">Choose a job…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.jobNumber} · {j.title} — {j.clientName}
              </option>
            ))}
          </select>
        ) : (
          <p className="label">No jobs are ready: a job must have an approved budget and no request waiting.</p>
        )}
        {(job || editing) && (
          <div className={`inst-balance${remaining > 0 ? " owed" : ""}`}>
            Remaining balance on this job: <b>{br(remaining)}</b>
          </div>
        )}
      </Step>

      <Step n={2} title="Remaining payment" hint={remaining > 0 ? "Required — the amount collected and a photo of its receipt." : "This job is fully paid; add a payment only if one was collected."}>
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r, i) => (
            <div key={r.key} className="inst-pay-row">
              <div className="inst-pay-n">{i + 1}</div>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="Amount (Br)"
                value={r.amount}
                onChange={(e) => patch(r.key, { amount: e.target.value })}
                aria-label={`Payment ${i + 1} amount`}
              />
              <select className="input" value={r.method} onChange={(e) => patch(r.key, { method: e.target.value })} aria-label={`Payment ${i + 1} method`}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <div className="inst-pay-file">
                {r.receipt ? (
                  <>
                    <Lightbox file={r.receipt} size={40} />
                    <label className="btn btn-sm">
                      Change
                      <input type="file" accept="image/*,.pdf" hidden onChange={(e) => pickReceipt(r.key, e.target.files?.[0])} />
                    </label>
                  </>
                ) : (
                  <label className={`btn btn-sm${r.uploading ? "" : " btn-primary"}`}>
                    {r.uploading ? "Uploading…" : "Receipt photo"}
                    <input type="file" accept="image/*,.pdf" hidden disabled={r.uploading} onChange={(e) => pickReceipt(r.key, e.target.files?.[0])} />
                  </label>
                )}
              </div>
              {rows.length > 1 && (
                <button type="button" className="btn btn-sm btn-ghost" aria-label={`Remove payment ${i + 1}`} onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}>
                  <Trash2 size={14} />
                </button>
              )}
              {r.error && <div className="login-error inst-pay-err">{r.error}</div>}
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-ghost" style={{ justifySelf: "start" }} onClick={() => setRows((prev) => [...prev, emptyRow()])}>
            <Plus size={14} /> Add another payment
          </button>
          {(job || editing) && (
            <div className={`inst-balance${after > 0 ? " owed" : " paid"}`}>
              This request: <b>{br(total)}</b> · Remaining after this: <b>{br(after)}</b>
            </div>
          )}
          {(job || editing) && total > remaining && (
            <div className="inst-balance over">
              That is <b>{br(Math.round((total - remaining) * 100) / 100)}</b> more than the remaining balance — check the amounts.
            </div>
          )}
        </div>
      </Step>

      <Step n={3} title="Withholding receipt" hint="Optional — attach it if the client gave one.">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {withholding ? (
            <>
              <Lightbox file={withholding} size={40} />
              <label className="btn btn-sm">
                Change
                <input type="file" accept="image/*,.pdf" hidden onChange={(e) => pickWithholding(e.target.files?.[0])} />
              </label>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setWithholding(null)}>
                Remove
              </button>
            </>
          ) : (
            <label className="btn btn-sm">
              {whBusy ? "Uploading…" : "Attach withholding receipt"}
              <input type="file" accept="image/*,.pdf" hidden disabled={whBusy} onChange={(e) => pickWithholding(e.target.files?.[0])} />
            </label>
          )}
          {whError && <span className="login-error">{whError}</span>}
        </div>
      </Step>

      <Step n={4} title="Note to the approver" hint="Optional.">
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. client paid the rest by transfer; installation on Thursday" style={{ resize: "vertical" }} />
      </Step>

      {error && <p className="login-error">{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" disabled={busy || anyUploading} onClick={submit}>
          {busy ? "Sending…" : anyUploading ? "Uploading…" : editing ? (resend ? "Re-send for approval" : "Save changes") : "Send for approval"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
