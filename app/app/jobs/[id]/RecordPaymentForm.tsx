"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { recordPaymentAction } from "./paymentsActions";
import type { ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";
import { FileField } from "../../FileField";

const initialState: ActionState = { error: null };

export function RecordPaymentForm({ jobId }: { jobId: string }) {
  const boundAction = recordPaymentAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);
  const [key, setKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state !== initialState && state.error === null) {
      formRef.current?.reset();
      setKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form
      key={key}
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="card"
      style={{ padding: 16, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}
    >
      <div>
        <label className="label">Type</label>
        <select className="input" name="type" defaultValue="Final">
          <option value="Final">Final</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label className="label">Amount (ETB)</label>
        <input className="input" name="amount" type="number" step="0.01" min="0" required />
      </div>
      <div>
        <label className="label">Method</label>
        <input className="input" name="method" />
      </div>
      <div>
        <label className="label">Date</label>
        <input className="input" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <label className="label">Notes</label>
        <input className="input" name="notes" />
      </div>
      <FileField id="payment-receipt" name="receipt" label="Receipt (optional)" />
      <SubmitButton label="Record Payment" pendingLabel="Saving…" className="btn btn-sm btn-primary" />
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
