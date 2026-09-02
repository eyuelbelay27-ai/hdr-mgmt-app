"use client";

import { useState } from "react";
import { updateSettingsAction } from "./actions";
import { useAutosave } from "../useAutosave";
import { SaveStatusBadge } from "../SaveStatusBadge";

export function SettingsForm({ ratePercent, threshold }: { ratePercent: number; threshold: number }) {
  const [fields, setFields] = useState({ rate: String(ratePercent), threshold: String(threshold) });
  const autosave = useAutosave((formData) => updateSettingsAction({ error: null }, formData));

  const buildFormData = (values: typeof fields) => {
    const fd = new FormData();
    fd.set("withholdingRatePercent", values.rate);
    fd.set("withholdingThreshold", values.threshold);
    return fd;
  };

  const update = (key: keyof typeof fields, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    autosave.schedule(() => buildFormData(next));
  };

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 10, maxWidth: 360 }}>
      <div>
        <label className="label" htmlFor="withholdingRatePercent">Withholding Rate (%)</label>
        <input
          className="input"
          id="withholdingRatePercent"
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={fields.rate}
          onChange={(e) => update("rate", e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="withholdingThreshold">Withholding Threshold (Br)</label>
        <input
          className="input"
          id="withholdingThreshold"
          type="number"
          step="0.01"
          min="0"
          value={fields.threshold}
          onChange={(e) => update("threshold", e.target.value)}
        />
        <p className="label" style={{ textTransform: "none", fontWeight: 400, marginTop: 4 }}>
          Withholding applies only when a purchase/receipt total exceeds this amount (Section 7.1).
        </p>
      </div>
      <SaveStatusBadge status={autosave.status} error={autosave.error} />
    </div>
  );
}
