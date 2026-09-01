"use client";

import { useFormState } from "react-dom";
import { updateSettingsAction, type ActionState } from "./actions";
import { SubmitButton } from "../SubmitButton";

const initialState: ActionState = { error: null };

export function SettingsForm({ ratePercent, threshold }: { ratePercent: number; threshold: number }) {
  const [state, formAction] = useFormState(updateSettingsAction, initialState);

  return (
    <form action={formAction} className="card" style={{ padding: 16, display: "grid", gap: 10, maxWidth: 360 }}>
      <div>
        <label className="label" htmlFor="withholdingRatePercent">Withholding Rate (%)</label>
        <input
          className="input"
          id="withholdingRatePercent"
          name="withholdingRatePercent"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={ratePercent}
        />
      </div>
      <div>
        <label className="label" htmlFor="withholdingThreshold">Withholding Threshold (ETB)</label>
        <input
          className="input"
          id="withholdingThreshold"
          name="withholdingThreshold"
          type="number"
          step="0.01"
          min="0"
          defaultValue={threshold}
        />
        <p className="label" style={{ textTransform: "none", fontWeight: 400, marginTop: 4 }}>
          Withholding applies only when a purchase/receipt total exceeds this amount (Section 7.1).
        </p>
      </div>
      {state.error && <p className="login-error">{state.error}</p>}
      <div>
        <SubmitButton label="Save Settings" pendingLabel="Saving…" />
      </div>
    </form>
  );
}
