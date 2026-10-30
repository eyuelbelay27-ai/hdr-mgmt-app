"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { updateJobPlanAction } from "./planActions";
import { EthDateField } from "../../EthDateField";
import { SubmitButton } from "../../SubmitButton";
import type { ActionState } from "./actions";

const initial: ActionState = { error: null };

/** Edit the sales rep and requested deadline while the job is a Draft. */
export function JobPlanEditor({ jobId, salesRep, requestedDeadline }: { jobId: string; salesRep: string | null; requestedDeadline: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(updateJobPlanAction.bind(null, jobId), initial);

  useEffect(() => {
    if (state !== initial && state.error === null) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
        Edit sales rep &amp; deadline
      </button>
    );
  }
  return (
    <form action={formAction} className="card" style={{ padding: 12, display: "grid", gap: 10, maxWidth: 420 }}>
      <div>
        <label className="label" htmlFor="editSalesRep">Sales Rep</label>
        <input className="input" id="editSalesRep" name="salesRep" defaultValue={salesRep ?? ""} required autoComplete="off" />
      </div>
      <EthDateField id="editRequestedDeadline" name="requestedDeadline" label="Deadline" defaultValue={requestedDeadline} required />
      {state.error && <p className="login-error">{state.error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <SubmitButton label="Save" pendingLabel="Saving…" />
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
