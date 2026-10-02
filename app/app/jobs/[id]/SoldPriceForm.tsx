"use client";

import { useState } from "react";
import { updateSoldPriceAction } from "./costEstimateActions";
import { useAutosave } from "../../useAutosave";
import { SaveStatusBadge } from "../../SaveStatusBadge";

type CommissionMode = "Percentage" | "Manual";

export function SoldPriceForm({
  jobId,
  soldPrice,
  commissionActive,
  commissionMode,
  commissionPercent,
  commissionAmount,
}: {
  jobId: string;
  soldPrice: number;
  commissionActive: boolean;
  commissionMode: CommissionMode;
  commissionPercent: number;
  commissionAmount: number;
}) {
  const [price, setPrice] = useState(String(soldPrice));
  const [commission, setCommission] = useState(commissionActive);
  const [mode, setMode] = useState<CommissionMode>(commissionMode);
  const [percent, setPercent] = useState(String(commissionPercent));
  const [amount, setAmount] = useState(String(commissionAmount));
  const autosave = useAutosave((formData) => updateSoldPriceAction(jobId, { error: null }, formData));

  const buildFormData = (
    priceValue: string,
    commissionValue: boolean,
    modeValue: CommissionMode,
    percentValue: string,
    amountValue: string
  ) => {
    const fd = new FormData();
    fd.set("soldPrice", priceValue);
    if (commissionValue) fd.set("commissionActive", "on");
    fd.set("commissionMode", modeValue);
    fd.set("commissionPercent", percentValue);
    fd.set("commissionAmount", amountValue);
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
            autosave.schedule(() => buildFormData(e.target.value, commission, mode, percent, amount));
          }}
        />
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={commission}
          onChange={(e) => {
            setCommission(e.target.checked);
            autosave.saveNow(() => buildFormData(price, e.target.checked, mode, percent, amount));
          }}
        />
        <span>Commission Active</span>
      </label>
      {commission && (
        <>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="radio"
              name="commissionMode"
              checked={mode === "Percentage"}
              onChange={() => {
                setMode("Percentage");
                autosave.saveNow(() => buildFormData(price, commission, "Percentage", percent, amount));
              }}
            />
            <span>Percentage</span>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="radio"
              name="commissionMode"
              checked={mode === "Manual"}
              onChange={() => {
                setMode("Manual");
                autosave.saveNow(() => buildFormData(price, commission, "Manual", percent, amount));
              }}
            />
            <span>Manual</span>
          </label>
          {mode === "Percentage" ? (
            <div>
              <label className="label" htmlFor="commissionPercent">Commission (%)</label>
              <input
                className="input"
                id="commissionPercent"
                type="number"
                value={percent}
                onChange={(e) => {
                  setPercent(e.target.value);
                  autosave.schedule(() => buildFormData(price, commission, mode, e.target.value, amount));
                }}
              />
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="commissionAmount">Commission (Br)</label>
              <input
                className="input"
                id="commissionAmount"
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  autosave.schedule(() => buildFormData(price, commission, mode, percent, e.target.value));
                }}
              />
            </div>
          )}
        </>
      )}
      <SaveStatusBadge status={autosave.status} error={autosave.error} />
    </div>
  );
}
