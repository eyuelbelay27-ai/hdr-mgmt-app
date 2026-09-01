"use client";

import { useFormState } from "react-dom";
import { updateCostEstimateNotesAction } from "./costEstimateActions";
import type { ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";
import { FileField } from "../../FileField";

const initialState: ActionState = { error: null };

export function CostEstimateNotesForm({ jobId, notes }: { jobId: string; notes: string | null }) {
  const boundAction = updateCostEstimateNotesAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" style={{ display: "grid", gap: 8 }}>
      <textarea className="input" name="notes" rows={3} defaultValue={notes ?? ""} />
      <FileField id="priceListFile" name="priceListFile" label="Price List File (optional)" accept="image/*,.pdf,.xlsx,.csv" />
      {state.error && <p className="login-error">{state.error}</p>}
      <div>
        <SubmitButton label="Save Notes" pendingLabel="Saving…" className="btn btn-sm" />
      </div>
    </form>
  );
}
