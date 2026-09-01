"use client";

import { useId, useState } from "react";
import { useFormState } from "react-dom";
import { updateMaterialAction, type ActionState } from "./actions";
import { SubmitButton } from "../SubmitButton";

interface HistoryEntry {
  id: string;
  oldPrice: unknown;
  newPrice: unknown;
  effectiveDate: Date;
  changedBy: { name: string } | null;
}

interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  rate: unknown;
  defaultQty: unknown;
  active: boolean;
  notes: string | null;
  priceHistory: HistoryEntry[];
}

const initialState: ActionState = { error: null };

export function MaterialRow({ material, editable }: { material: Material; editable: boolean }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const boundAction = updateMaterialAction.bind(null, material.id);
  const [state, formAction] = useFormState(boundAction, initialState);
  const formId = useId();

  return (
    <>
      {editable && (
        <tr style={{ display: "none" }}>
          <td>
            <form id={formId} action={formAction} />
          </td>
        </tr>
      )}
      <tr>
        {editable ? (
          <>
            <td data-label="Name"><input className="input" form={formId} name="name" defaultValue={material.name} required /></td>
            <td data-label="Category">
              <select className="input" form={formId} name="category" defaultValue={material.category}>
                <option value="cash">Cash</option>
                <option value="stock">Stock</option>
              </select>
            </td>
            <td data-label="Unit"><input className="input" form={formId} name="unit" defaultValue={material.unit} /></td>
            <td data-label="Rate">
              <input
                className="input"
                form={formId}
                name="rate"
                type="number"
                step="0.01"
                min="0"
                defaultValue={material.rate === null ? "" : String(material.rate)}
              />
            </td>
            <td data-label="Default Qty">
              <input
                className="input"
                form={formId}
                name="defaultQty"
                type="number"
                step="0.01"
                min="0"
                defaultValue={material.defaultQty === null ? "" : String(material.defaultQty)}
              />
            </td>
            <td data-label="Active">
              <input type="checkbox" form={formId} name="active" defaultChecked={material.active} />
            </td>
            <td data-label="Actions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <SubmitButton label="Save" pendingLabel="…" className="btn btn-sm" />
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setHistoryOpen((v) => !v)}
              >
                History ({material.priceHistory.length})
              </button>
            </td>
          </>
        ) : (
          <>
            <td data-label="Name">{material.name}</td>
            <td data-label="Category">{material.category === "cash" ? "Cash" : "Stock"}</td>
            <td data-label="Unit">{material.unit}</td>
            <td className="mono" data-label="Rate">{material.rate === null ? "—" : String(material.rate)}</td>
            <td className="mono" data-label="Default Qty">{material.defaultQty === null ? "—" : String(material.defaultQty)}</td>
            <td data-label="Active">{material.active ? "Active" : "Inactive"}</td>
            <td>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHistoryOpen((v) => !v)}>
                History ({material.priceHistory.length})
              </button>
            </td>
          </>
        )}
      </tr>
      {state.error && (
        <tr>
          <td colSpan={7} className="login-error">{state.error}</td>
        </tr>
      )}
      {historyOpen && (
        <tr>
          <td colSpan={7}>
            {material.priceHistory.length === 0 ? (
              <span className="label">No price changes recorded.</span>
            ) : (
              <div className="dtable-wrap">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Old Price</th>
                    <th>New Price</th>
                    <th>Changed By</th>
                  </tr>
                </thead>
                <tbody>
                  {material.priceHistory.map((h) => (
                    <tr key={h.id}>
                      <td data-label="Date">{h.effectiveDate.toISOString().slice(0, 10)}</td>
                      <td className="mono" data-label="Old Price">{h.oldPrice === null ? "—" : String(h.oldPrice)}</td>
                      <td className="mono" data-label="New Price">{h.newPrice === null ? "—" : String(h.newPrice)}</td>
                      <td data-label="Changed By">{h.changedBy?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
