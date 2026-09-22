"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Eye, EyeOff, Pencil, Phone, RefreshCw, Trash2 } from "lucide-react";
import type { CrmLeadStatus } from "@prisma/client";
import { CRM_DESTINATIONS, CRM_STATUS_TONE } from "@/lib/crm/status";
import { formatDateLabel, formatSeenAt } from "@/lib/crm/week";
import {
  deleteCrmLeadAction,
  revealCrmLeadPhoneAction,
  setCrmLeadStatusAction,
  updateCrmLeadAction,
  type CrmActionState,
} from "./actions";
import { SubmitButton } from "../SubmitButton";
import { LeadFormFields } from "./LeadFormFields";
import type { CrmLeadData } from "./listData";
import type { PendingMove } from "./CrmWorkspace";

const initialState: CrmActionState = { error: null };

export interface LeadCardHandlers {
  currentUserId: string;
  isAdmin: boolean;
  reps: { id: string; name: string }[];
  pendingMove: PendingMove;
  onRequestMove: (leadId: string, status: "Closed" | "Failed") => void;
  onCancelMove: () => void;
  onUpdate: (lead: CrmLeadData) => void;
  onRemove: (id: string) => void;
}

export function LeadCard({
  lead,
  currentUserId,
  isAdmin,
  reps,
  pendingMove,
  onRequestMove,
  onCancelMove,
  onUpdate,
  onRemove,
}: { lead: CrmLeadData } & LeadCardHandlers) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The pipeline is the assigned rep's call alone — an Admin can see it,
  // never touch it (Section: user request).
  const isOwnLead = lead.assignedToId === currentUserId;
  const tone = CRM_STATUS_TONE[lead.status];
  const awaitingDetail = pendingMove?.leadId === lead.id ? pendingMove.status : null;

  async function reveal() {
    setBusy(true);
    setError(null);
    const result = await revealCrmLeadPhoneAction(lead.id);
    setBusy(false);
    if (result.error) setError(result.error);
    else if (result.lead) onUpdate(result.lead);
  }

  async function commit(status: CrmLeadStatus, payload: Record<string, string> = {}) {
    setBusy(true);
    setError(null);
    const result = await setCrmLeadStatusAction(lead.id, status, payload);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.lead) onUpdate(result.lead);
  }

  function move(status: CrmLeadStatus) {
    setError(null);
    // Closing needs a figure and failing needs a reason, so those two open
    // a small form on the card instead of moving straight away.
    if (status === "Closed" || status === "Failed") {
      onRequestMove(lead.id, status);
      return;
    }
    void commit(status);
  }

  async function handleDelete() {
    setBusy(true);
    await deleteCrmLeadAction(lead.id);
    setBusy(false);
    onRemove(lead.id);
  }

  if (editing) {
    return (
      <div className="card crm-card">
        <EditLeadForm
          lead={lead}
          reps={reps}
          onSaved={(updated) => {
            setEditing(false);
            onUpdate(updated);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  // A destination is shown normally once — except when the lead is
  // flagged for re-confirmation, where the CURRENT status also reappears
  // as an explicit "still X" choice, since re-picking it IS the
  // confirmation the scheduled check is waiting for.
  const destinations = CRM_DESTINATIONS.filter((s) => lead.dueForReview || s !== lead.status);

  return (
    <div className={`card crm-card${lead.dueForReview ? " crm-card-due" : ""}`}>
      <div className="crm-card-top">
        <span className="badge" style={{ background: tone.bg, color: tone.fg }}>
          {lead.status}
        </span>
        {lead.dueForReview && (
          <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            <RefreshCw size={11} strokeWidth={2} /> Needs Update
          </span>
        )}
        <span className="crm-card-date">{formatDateLabel(lead.receivedAt)}</span>
      </div>

      <div className="crm-card-title">{lead.location}</div>
      <div className="crm-card-sub">
        {lead.businessType}
        {lead.source ? ` · ${lead.source}` : ""}
      </div>

      {lead.phone !== null ? (
        <a className="crm-card-phone" href={`tel:${lead.phone.replace(/\s+/g, "")}`}>
          <Phone size={13} strokeWidth={1.75} />
          {lead.phone}
        </a>
      ) : isOwnLead ? (
        <button type="button" className="btn btn-sm crm-reveal-btn" disabled={busy} onClick={reveal}>
          <EyeOff size={13} strokeWidth={1.75} /> Show Phone Number
        </button>
      ) : (
        <span className="crm-card-phone-hidden">
          <EyeOff size={13} strokeWidth={1.75} /> Hidden until the rep views it
        </span>
      )}

      {isAdmin && <div className="crm-card-meta">Rep: {lead.assignedToName}</div>}
      {lead.seenAt && (
        <div className="crm-card-meta">
          <Eye size={12} strokeWidth={1.75} /> Number shown {formatSeenAt(lead.seenAt)}
        </div>
      )}

      {lead.status === "Closed" && (
        <div className="crm-card-outcome">
          Sale <strong className="mono">{(lead.saleAmount ?? 0).toLocaleString()} Br</strong> · Profit{" "}
          <strong className="mono">{(lead.profit ?? 0).toLocaleString()} Br</strong>
        </div>
      )}
      {lead.status === "Failed" && lead.failureNote && (
        <div className="crm-card-outcome">Why: {lead.failureNote}</div>
      )}

      {awaitingDetail === "Closed" && (
        <CloseForm busy={busy} onCancel={onCancelMove} onSave={(sale, profit) => commit("Closed", { saleAmount: sale, profit })} />
      )}
      {awaitingDetail === "Failed" && (
        <FailForm busy={busy} onCancel={onCancelMove} onSave={(note) => commit("Failed", { failureNote: note })} />
      )}

      {isOwnLead && !awaitingDetail && (
        <div className="crm-card-actions">
          {destinations.map((s) => (
            <button key={s} type="button" className="btn btn-sm crm-move-btn" disabled={busy} onClick={() => move(s)}>
              {s === lead.status ? `Still ${s}? Confirm` : s}
            </button>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="crm-card-admin">
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setEditing(true)}>
            <Pencil size={13} strokeWidth={1.75} /> Edit
          </button>
          {confirmDelete ? (
            <>
              <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={handleDelete}>
                Confirm Delete
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={13} strokeWidth={1.75} /> Delete
            </button>
          )}
        </div>
      )}

      {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function CloseForm({
  busy,
  onSave,
  onCancel,
}: {
  busy: boolean;
  onSave: (sale: string, profit: string) => void;
  onCancel: () => void;
}) {
  const [sale, setSale] = useState("");
  const [profit, setProfit] = useState("");
  return (
    <div className="crm-inline-form">
      <div className="form-row">
        <div className="form-field">
          <label className="label">Sale Amount (Br)</label>
          <input className="input" inputMode="decimal" value={sale} onChange={(e) => setSale(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label className="label">Profit (Br)</label>
          <input className="input" inputMode="decimal" value={profit} onChange={(e) => setProfit(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => onSave(sale, profit)}>
          {busy ? "Saving…" : "Mark Closed"}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function FailForm({
  busy,
  onSave,
  onCancel,
}: {
  busy: boolean;
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="crm-inline-form">
      <label className="label">Why did it fail?</label>
      <textarea
        className="input"
        rows={2}
        value={note}
        autoFocus
        style={{ resize: "vertical" }}
        onChange={(e) => setNote(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => onSave(note)}>
          {busy ? "Saving…" : "Mark Failed"}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditLeadForm({
  lead,
  reps,
  onSaved,
  onCancel,
}: {
  lead: CrmLeadData;
  reps: { id: string; name: string }[];
  onSaved: (lead: CrmLeadData) => void;
  onCancel: () => void;
}) {
  const boundAction = updateCrmLeadAction.bind(null, lead.id);
  const [state, formAction] = useFormState(boundAction, initialState);

  useEffect(() => {
    if (state !== initialState && state.error === null && state.lead) onSaved(state.lead);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} style={{ display: "grid", gap: 12 }}>
      <LeadFormFields reps={reps} lead={lead} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <SubmitButton label="Save Lead" pendingLabel="Saving…" className="btn btn-sm btn-primary" />
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        {state.error && <span className="login-error">{state.error}</span>}
      </div>
    </form>
  );
}
