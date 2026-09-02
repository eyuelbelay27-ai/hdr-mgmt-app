"use client";

import { useState } from "react";
import { updateSoldPriceAction } from "./costEstimateActions";
import { useAutosave } from "../../useAutosave";
import { SaveStatusBadge } from "../../SaveStatusBadge";

export function SoldPriceForm({
  jobId,
  soldPrice,
  commissionActive,
}: {
  jobId: string;
  soldPrice: number;
  commissionActive: boolean;
}) {
  const [price, setPrice] = useState(String(soldPrice));
  const [commission, setCommission] = useState(commissionActive);
  const autosave = useAutosave((formData) => updateSoldPriceAction(jobId, { error: null }, formData));

  const buildFormData = (priceValue: string, commissionValue: boolean) => {
    const fd = new FormData();
    fd.set("soldPrice", priceValue);
    if (commissionValue) fd.set("commissionActive", "on");
    return fd;
  };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
      <div>
        <label className="label" htmlFor="soldPrice">Sold Price (Br)</label>
        <input
          className="input"
          id="soldPrice"
          type="number"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            autosave.schedule(() => buildFormData(e.target.value, commission));
          }}
        />
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={commission}
          onChange={(e) => {
            setCommission(e.target.checked);
            autosave.saveNow(() => buildFormData(price, e.target.checked));
          }}
        />
        <span>Commission Active (7%)</span>
      </label>
      <SaveStatusBadge status={autosave.status} error={autosave.error} />
    </div>
  );
}
