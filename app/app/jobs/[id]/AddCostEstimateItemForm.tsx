"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { addCostEstimateItemAction } from "./costEstimateActions";
import type { ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";

const initialState: ActionState = { error: null };

export function AddCostEstimateItemForm({ jobId, category }: { jobId: string; category: "cash" | "stock" }) {
  const boundAction = addCostEstimateItemAction.bind(null, jobId, category);
  const [state, formAction] = useFormState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state !== initialState && state.error === null) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr auto", gap: 8, alignItems: "end", marginTop: 8 }}
    >
      <div>
        <label className="label">Name</label>
        <input className="input" name="name" required />
      </div>
      <div>
        <label className="label">Unit</label>
        <input className="input" name="unit" required />
      </div>
      <div>
        <label className="label">Qty</label>
        <input className="input" name="qty" type="number" step="0.01" min="0" required />
      </div>
      <div>
        <label className="label">Unit Price</label>
        <input className="input" name="unitPrice" type="number" step="0.01" min="0" required />
      </div>
      <div>
        <label className="label">Comment</label>
        <input className="input" name="comment" />
      </div>
      <SubmitButton label="Add Item" pendingLabel="Adding…" className="btn btn-sm" />
      {state.error && (
        <p className="login-error" style={{ gridColumn: "1 / -1" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
