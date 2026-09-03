"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { deleteJobAction } from "./statusActions";
import type { ActionState } from "./actions";

const initialState: ActionState = { error: null };

function ConfirmButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-sm btn-danger" type="submit" disabled={pending || !enabled}>
      {pending ? "Deleting…" : "Permanently Delete"}
    </button>
  );
}

/** Irreversible whole-job delete (Section 9) — typing the exact job number
 * replaces a native confirm() dialog as the safety gate, matching this
 * app's house style of never relying on a browser confirm for destructive
 * actions. The server re-checks the match regardless. */
export function DeleteJobControl({ jobId, jobNumber }: { jobId: string; jobNumber: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const boundAction = deleteJobAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);

  if (!open) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setOpen(true)}>
        Delete Job
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px" }}>
        <label className="label">
          Type <span className="mono">{jobNumber}</span> to permanently delete this job
        </label>
        <input
          className="input"
          name="confirmJobNumber"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </div>
      <ConfirmButton enabled={typed.trim() === jobNumber} />
      <button className="btn btn-sm" type="button" onClick={() => { setOpen(false); setTyped(""); }}>
        Never Mind
      </button>
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
