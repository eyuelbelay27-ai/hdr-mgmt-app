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
            <td><input className="input" form={formId} name="name" defaultValue={material.name} required /></td>
            <td>
              <select className="input" form={formId} name="category" defaultValue={material.category}>
                <option value="cash">Cash</option>
                <option value="stock">Stock</option>
              </select>
            </td>
            <td><input className="input" form={formId} name="unit" defaultValue={material.unit} /></td>
            <td>
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
            <td>
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
            <td>
              <input type="checkbox" form={formId} name="active" defaultChecked={material.active} />
            </td>
            <td>
              <SubmitButton label="Save" pendingLabel="…" className="btn btn-sm" />
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setHistoryOpen((v) => !v)}
                style={{ marginLeft: 4 }}
              >
                History ({material.priceHistory.length})
              </button>
            </td>
          </>
        ) : (
          <>
            <td>{material.name}</td>
            <td>{material.category === "cash" ? "Cash" : "Stock"}</td>
            <td>{material.unit}</td>
            <td className="mono">{material.rate === null ? "—" : String(material.rate)}</td>
            <td className="mono">{material.defaultQty === null ? "—" : String(material.defaultQty)}</td>
            <td>{material.active ? "Active" : "Inactive"}</td>
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
                      <td>{h.effectiveDate.toISOString().slice(0, 10)}</td>
                      <td className="mono">{h.oldPrice === null ? "—" : String(h.oldPrice)}</td>
                      <td className="mono">{h.newPrice === null ? "—" : String(h.newPrice)}</td>
                      <td>{h.changedBy?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
