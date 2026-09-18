"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { Paperclip, Trash2 } from "lucide-react";
import { BudgetPaidBadge } from "../../BudgetPaidBadge";
import { Lightbox } from "../../Lightbox";
import { SubmitButton } from "../../SubmitButton";
import { FileField } from "../../FileField";
import { setBudgetPaidAction, upsertChequeAction, deleteChequeImageAction } from "./budgetPaidActions";
import type { ActionState as ChequeActionState } from "./actions";

const initialState: ChequeActionState = { error: null };

export interface ChequeData {
  name: string | null;
  url: string | null;
  kind: string | null;
  description: string | null;
}

/**
 * The Budget Paid indicator's home on the job detail page — right below
 * the status badges, since that's what "right after an approved job"
 * means (Section: user request). Visible to everyone who can see the job;
 * the toggle and cheque controls only render for whoever can approve
 * budgets. Nothing here reads from or writes to any other tab.
 */
export function BudgetPaidSection({
  jobId,
  paid,
  canManage,
  cheque,
}: {
  jobId: string;
  paid: boolean;
  canManage: boolean;
  cheque: ChequeData;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmToggle() {
    setBusy(true);
    await setBudgetPaidAction(jobId, !paid);
    setBusy(false);
    setConfirming(false);
  }

  if (!canManage) {
    return (
      <div className="card" style={{ padding: 12 }}>
        <BudgetPaidBadge paid={paid} />
        {paid && <ChequeView cheque={cheque} />}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <BudgetPaidBadge paid={paid} />
        {!confirming ? (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setConfirming(true)}>
            Mark Budget {paid ? "Unpaid" : "Paid"}
          </button>
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="label" style={{ margin: 0 }}>
              Are you sure you want to mark this budget as {paid ? "unpaid" : "paid"}?
            </span>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={confirmToggle}>
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        )}
      </div>

      {paid && <ChequeManager jobId={jobId} cheque={cheque} />}
    </div>
  );
}

function ChequeView({ cheque }: { cheque: ChequeData }) {
  if (!cheque.url && !cheque.description) {
    return <p className="label" style={{ margin: 0 }}>No cheque photo attached.</p>;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {cheque.url && <Lightbox file={{ name: cheque.name ?? "cheque", url: cheque.url, kind: cheque.kind ?? "" }} size={44} />}
      {cheque.description && <span style={{ fontSize: 13.5 }}>{cheque.description}</span>}
    </div>
  );
}

function ChequeManager({ jobId, cheque }: { jobId: string; cheque: ChequeData }) {
  const boundAction = upsertChequeAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (state !== initialState && state.error === null) {
      formRef.current?.reset();
      setEditing(false);
    }
  }, [state]);

  async function confirmDelete() {
    setDeleting(true);
    await deleteChequeImageAction(jobId);
    setDeleting(false);
    setDeleteConfirming(false);
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-soft)" }}>
      <ChequeView cheque={cheque} />

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {!editing && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>
            <Paperclip size={13} strokeWidth={1.75} /> {cheque.url ? "Replace" : "Attach"} Cheque Photo
          </button>
        )}
        {cheque.url && !deleteConfirming && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDeleteConfirming(true)}>
            <Trash2 size={13} strokeWidth={1.75} /> Delete Photo
          </button>
        )}
        {deleteConfirming && (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="label" style={{ margin: 0 }}>Delete the cheque photo?</span>
            <button type="button" className="btn btn-sm btn-danger" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting…" : "Confirm Delete"}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={deleting} onClick={() => setDeleteConfirming(false)}>
              Cancel
            </button>
          </span>
        )}
      </div>

      {editing && (
        <form
          ref={formRef}
          action={formAction}
          encType="multipart/form-data"
          style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginTop: 10 }}
        >
          <FileField id={`chequeImage-${jobId}`} name="chequeImage" label="Cheque Photo" accept="image/*,.pdf" />
          <div style={{ flex: "1 1 200px" }}>
            <label className="label" htmlFor={`chequeDescription-${jobId}`}>Description</label>
            <input
              className="input"
              id={`chequeDescription-${jobId}`}
              name="chequeDescription"
              defaultValue={cheque.description ?? ""}
              placeholder="e.g. Cheque #4471, CBE"
            />
          </div>
          <SubmitButton label="Save" pendingLabel="Saving…" className="btn btn-sm btn-primary" />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
          {state.error && <span className="login-error">{state.error}</span>}
        </form>
      )}
    </div>
  );
}
