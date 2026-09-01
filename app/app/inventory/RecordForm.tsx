"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { recordManualInventoryAction, type ActionState } from "./actions";
import { SubmitButton } from "../SubmitButton";

const initialState: ActionState = { error: null };

export function RecordForm({
  direction,
  materials,
}: {
  direction: "in" | "out";
  materials: { id: string; name: string }[];
}) {
  const boundAction = recordManualInventoryAction.bind(null, direction);
  const [state, formAction] = useFormState(boundAction, initialState);
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
      <div>
        <label className="label">Material</label>
        <select className="input" name="materialId" defaultValue="">
          <option value="">— type a name instead —</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Or Item Name</label>
        <input className="input" name="itemName" />
      </div>
      <div>
        <label className="label">Qty</label>
        <input className="input" name="qty" type="number" step="0.01" min="0" required />
      </div>
      <div>
        <label className="label">Date</label>
        <input className="input" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <label className="label">Note</label>
        <input className="input" name="note" />
      </div>
      <SubmitButton label={`Record Stock ${direction === "in" ? "In" : "Out"}`} pendingLabel="Saving…" className="btn btn-sm btn-primary" />
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
