"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { approveBudgetAction, type ApproveBudgetState } from "./budgetActions";

const initialState: ApproveBudgetState = { error: null };

function ConfirmButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary btn-sm" type="submit" disabled={pending || !enabled}>
      {pending ? "Approving…" : "Confirm Approval"}
    </button>
  );
}

/**
 * The exact same control renders at both entry points (header shortcut and
 * Budget tab button — Section 6.1) so they behave identically: click
 * Approve Budget, an inline date picker appears, Confirm Approval stays
 * disabled until a date is chosen.
 */
export function ApproveBudgetControl({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState("");
  const boundAction = approveBudgetAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" type="button" onClick={() => setOpen(true)}>
        Approve Budget & Move to Implementation
      </button>
    );
  }

  return (
    <form action={formAction} className="card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
      <div>
        <label className="label" htmlFor={`deadline-${jobId}`}>Deadline</label>
        <input
          className="input"
          id={`deadline-${jobId}`}
          name="deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      <ConfirmButton enabled={!!deadline} />
      <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {!deadline && <span className="label">Choose a date to enable Confirm Approval.</span>}
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
