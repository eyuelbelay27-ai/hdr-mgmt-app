"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { submitOvertimeRequestAction, type ActionState, type OvertimeRequestData } from "./actions";
import { SubmitButton } from "../SubmitButton";
import { EmployeeNamesField } from "./EmployeeNamesField";

const initialState: ActionState = { error: null };

export function AddOvertimeForm({ onSubmitted }: { onSubmitted: (request: OvertimeRequestData) => void }) {
  const [state, formAction] = useFormState(submitOvertimeRequestAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state !== initialState && state.error === null && state.request) {
      formRef.current?.reset();
      onSubmitted(state.request);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form ref={formRef} action={formAction} className="card" style={{ padding: 16, display: "grid", gap: 12, marginTop: 12 }}>
      <div>
        <label className="label">Work Title</label>
        <input className="input" name="title" required />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input" name="description" rows={2} style={{ resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 150px" }}>
          <label className="label">Date</label>
          <input className="input" name="date" type="date" defaultValue={today} required />
        </div>
        <div style={{ flex: "1 1 130px" }}>
          <label className="label">Start Time</label>
          <input className="input" name="time" type="time" required />
        </div>
      </div>
      <EmployeeNamesField />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <SubmitButton label="Submit Request" pendingLabel="Submitting…" className="btn btn-sm btn-primary" />
        {state.error && <span className="login-error">{state.error}</span>}
      </div>
    </form>
  );
}
