"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { addBudgetItemAction } from "./budgetActions";
import type { ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";

const initialState: ActionState = { error: null };

export function AddBudgetItemForm({ jobId }: { jobId: string }) {
  const boundAction = addBudgetItemAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);
  const [category, setCategory] = useState<"cash" | "stock">("cash");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state !== initialState && state.error === null) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="card"
      style={{ padding: 16, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginTop: 12 }}
    >
      <div style={{ flex: "1 1 160px" }}>
        <label className="label">Description</label>
        <input className="input" name="label" required />
      </div>
      <div style={{ flex: "1 1 140px" }}>
        <label className="label">Category</label>
        <select
          className="input"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as "cash" | "stock")}
        >
          <option value="cash">Cash</option>
          <option value="stock">Stock</option>
        </select>
      </div>
      {category === "cash" ? (
        <div style={{ flex: "1 1 140px" }}>
          <label className="label">Amount (ETB)</label>
          <input className="input" name="amount" type="number" step="0.01" min="0" required />
        </div>
      ) : (
        <>
          <div style={{ flex: "1 1 120px" }}>
            <label className="label">Qty</label>
            <input className="input" name="qty" type="number" step="0.01" min="0" required />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label className="label">Unit</label>
            <input className="input" name="unit" required />
          </div>
        </>
      )}
      <div style={{ flex: "1 1 160px" }}>
        <label className="label">Comment</label>
        <input className="input" name="comment" />
      </div>
      <SubmitButton label="Add Line" pendingLabel="Adding…" className="btn btn-sm btn-primary" />
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
