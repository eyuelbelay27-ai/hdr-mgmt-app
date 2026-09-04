"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { createJobAction, type CreateJobState } from "./actions";
import { SubmitButton } from "../SubmitButton";
import { FileField } from "../FileField";

const initialState: CreateJobState = { error: null };

export function NewJobForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createJobAction, initialState);

  useEffect(() => {
    if (state !== initialState && state.error === null) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)} type="button">
        New Job
      </button>
    );
  }

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="card"
      style={{ padding: 16, display: "grid", gap: 10, maxWidth: 420 }}
    >
      <div>
        <label className="label" htmlFor="clientName">Client Name</label>
        <input className="input" id="clientName" name="clientName" required />
      </div>
      <div>
        <label className="label" htmlFor="title">Job Title</label>
        <input className="input" id="title" name="title" required />
      </div>
      <div>
        <label className="label" htmlFor="clientPhone">Client Phone</label>
        <input className="input" id="clientPhone" name="clientPhone" type="tel" required />
      </div>
      <div>
        <label className="label" htmlFor="clientAddress">Client Address</label>
        <input className="input" id="clientAddress" name="clientAddress" required />
      </div>
      <div>
        <label className="label" htmlFor="advanceAmount">Advance Payment (Br)</label>
        <input className="input" id="advanceAmount" name="advanceAmount" type="number" min="0" step="0.01" required />
      </div>
      <FileField id="advanceProof" name="advanceProof" label="Advance Payment Proof (receipt/screenshot)" required />
      {state.error && <p className="login-error">{state.error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <SubmitButton label="Create Job" pendingLabel="Creating…" />
        <button className="btn" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
