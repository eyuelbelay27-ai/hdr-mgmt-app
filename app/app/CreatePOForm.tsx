"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { createPurchaseOrderAction, type ActionState } from "./poActions";
import { SubmitButton } from "./SubmitButton";

const initialState: ActionState = { error: null };

export function CreatePOForm() {
  const [state, formAction] = useFormState(createPurchaseOrderAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state !== initialState && state.error === null) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="card"
      style={{ padding: 16, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}
    >
      <div style={{ flex: "1 1 150px" }}>
        <label className="label">Date</label>
        <input className="input" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div style={{ flex: "1 1 140px" }}>
        <label className="label">Purchaser</label>
        <input className="input" name="purchaser" />
      </div>
      <div style={{ flex: "1 1 140px" }}>
        <label className="label">Item</label>
        <input className="input" name="item" required />
      </div>
      <div style={{ flex: "1 1 160px" }}>
        <label className="label">Description</label>
        <input className="input" name="description" />
      </div>
      <div style={{ flex: "1 1 130px" }}>
        <label className="label">Category</label>
        <select className="input" name="category" defaultValue="cash">
          <option value="cash">Cash</option>
          <option value="stock">Stock</option>
        </select>
      </div>
      <div style={{ flex: "1 1 90px" }}>
        <label className="label">Qty</label>
        <input className="input" name="qty" type="number" step="0.01" min="0" required style={{ width: "100%" }} />
      </div>
      <div style={{ flex: "1 1 110px" }}>
        <label className="label">Price</label>
        <input className="input" name="price" type="number" step="0.01" min="0" required style={{ width: "100%" }} />
      </div>
      <SubmitButton label="Submit for Approval" pendingLabel="Submitting…" className="btn btn-sm btn-primary" />
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
