"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { rejectPurchaseOrderAction, type ActionState } from "./poActions";

const initialState: ActionState = { error: null };

function ConfirmButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-sm btn-danger" type="submit" disabled={pending || !enabled}>
      {pending ? "Rejecting…" : "Confirm Reject"}
    </button>
  );
}

export function RejectPOControl({ poId }: { poId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const boundAction = rejectPurchaseOrderAction.bind(null, poId);
  const [state, formAction] = useFormState(boundAction, initialState);

  if (!open) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setOpen(true)}>Reject</button>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input className="input" style={{ width: 140 }} name="note" placeholder="Reason" value={note} onChange={(e) => setNote(e.target.value)} />
      <ConfirmButton enabled={note.trim().length > 0} />
      <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>Cancel</button>
      {state.error && <span className="login-error">{state.error}</span>}
    </form>
  );
}
