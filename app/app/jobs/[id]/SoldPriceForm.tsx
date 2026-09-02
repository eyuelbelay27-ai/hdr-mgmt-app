"use client";

import { useFormState } from "react-dom";
import { updateSoldPriceAction } from "./costEstimateActions";
import type { ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";

const initialState: ActionState = { error: null };

export function SoldPriceForm({
  jobId,
  soldPrice,
  commissionActive,
}: {
  jobId: string;
  soldPrice: number;
  commissionActive: boolean;
}) {
  const boundAction = updateSoldPriceAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
      <div>
        <label className="label" htmlFor="soldPrice">Sold Price (Br)</label>
        <input className="input" id="soldPrice" name="soldPrice" type="number" step="0.01" min="0" defaultValue={soldPrice} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <input type="checkbox" name="commissionActive" defaultChecked={commissionActive} />
        <span className="label" style={{ margin: 0 }}>Commission Active (7%)</span>
      </label>
      <SubmitButton label="Save" pendingLabel="Saving…" className="btn btn-sm btn-primary" />
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
