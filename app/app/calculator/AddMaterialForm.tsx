"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { createMaterialAction, type ActionState } from "./actions";
import { SubmitButton } from "../SubmitButton";
import type { MaterialData } from "./MaterialCard";

const initialState: ActionState = { error: null };

export function AddMaterialForm({ onCreated }: { onCreated: (material: MaterialData) => void }) {
  const [state, formAction] = useFormState(createMaterialAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state !== initialState && state.error === null && state.material) {
      onCreated({ ...state.material, priceHistory: [] });
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="card"
      style={{ padding: 16, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginTop: 12 }}
    >
      <div>
        <label className="label">Name</label>
        <input className="input" name="name" required />
      </div>
      <div>
        <label className="label">Category</label>
        <select className="input" name="category" defaultValue="cash">
          <option value="cash">Cash</option>
          <option value="stock">Stock</option>
        </select>
      </div>
      <div>
        <label className="label">Unit</label>
        <input className="input" name="unit" />
      </div>
      <div>
        <label className="label">Rate (leave blank if unpriced)</label>
        <input className="input" name="rate" type="number" step="0.01" min="0" />
      </div>
      <SubmitButton label="Add Material" pendingLabel="Adding…" />
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
