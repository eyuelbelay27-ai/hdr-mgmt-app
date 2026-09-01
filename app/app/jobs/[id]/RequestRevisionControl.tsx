"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestRevisionAction } from "./statusActions";
import type { ActionState } from "./actions";

const initialState: ActionState = { error: null };

function ConfirmButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-sm btn-danger" type="submit" disabled={pending || !enabled}>
      {pending ? "Sending…" : "Send Back for Revision"}
    </button>
  );
}

export function RequestRevisionControl({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const boundAction = requestRevisionAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);

  if (!open) {
    return (
      <button className="btn btn-sm" type="button" onClick={() => setOpen(true)}>
        Request Revision
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", gap: 8, alignItems: "end" }}>
      <div style={{ flex: 1 }}>
        <label className="label">Reason (required)</label>
        <input className="input" name="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <ConfirmButton enabled={note.trim().length > 0} />
      <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>Cancel</button>
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
