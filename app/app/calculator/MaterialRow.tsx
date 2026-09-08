"use client";

import { useId, useRef, useState } from "react";
import { updateMaterialAction, deleteMaterialAction } from "./actions";
import { useAutosave } from "../useAutosave";
import { SaveStatusBadge } from "../SaveStatusBadge";
import type { MaterialData } from "./MaterialCard";

export function MaterialRow({
  material,
  editable,
  onUpdate,
  onDelete,
}: {
  material: MaterialData;
  editable: boolean;
  onUpdate: (id: string, patch: Partial<MaterialData>) => void;
  onDelete: (id: string) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useAutosave((formData) => updateMaterialAction(material.id, { error: null }, formData));
  const buildFormData = () => new FormData(formRef.current as HTMLFormElement);

  const handleDelete = async () => {
    setDeleting(true);
    await deleteMaterialAction(material.id);
    onDelete(material.id);
  };

  return (
    <>
      {editable && (
        <tr style={{ display: "none" }}>
          <td>
            <form id={formId} ref={formRef} />
          </td>
        </tr>
      )}
      <tr>
        {editable ? (
          <>
            <td data-label="Name">
              <input
                className="input"
                form={formId}
                name="name"
                defaultValue={material.name}
                required
                onChange={(e) => {
                  onUpdate(material.id, { name: e.target.value });
                  autosave.schedule(buildFormData);
                }}
              />
            </td>
            <td data-label="Category">
              <select
                className="input"
                form={formId}
                name="category"
                defaultValue={material.category}
                onChange={(e) => {
                  onUpdate(material.id, { category: e.target.value });
                  autosave.saveNow(buildFormData);
                }}
              >
                <option value="cash">Cash</option>
                <option value="stock">Stock</option>
              </select>
            </td>
            <td data-label="Unit">
              <input
                className="input"
                form={formId}
                name="unit"
                defaultValue={material.unit}
                onChange={(e) => {
                  onUpdate(material.id, { unit: e.target.value });
                  autosave.schedule(buildFormData);
                }}
              />
            </td>
            <td data-label="Rate">
              <input
                className="input"
                form={formId}
                name="rate"
                type="number"
                step="0.01"
                min="0"
                defaultValue={material.rate === null ? "" : String(material.rate)}
                onChange={(e) => {
                  onUpdate(material.id, { rate: e.target.value === "" ? null : e.target.value });
                  autosave.schedule(buildFormData);
                }}
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
                onChange={(e) => {
                  onUpdate(material.id, { defaultQty: e.target.value === "" ? null : e.target.value });
                  autosave.schedule(buildFormData);
                }}
              />
            </td>
            <td data-label="Actions" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <SaveStatusBadge status={autosave.status} error={autosave.error} />
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHistoryOpen((v) => !v)}>
                History ({material.priceHistory.length})
              </button>
              <button type="button" className="btn btn-sm btn-danger" disabled={deleting} onClick={handleDelete}>
                {deleting ? "Deleting…" : "Delete"}
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
            <td>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHistoryOpen((v) => !v)}>
                History ({material.priceHistory.length})
              </button>
            </td>
          </>
        )}
      </tr>
      {historyOpen && (
        <tr>
          <td colSpan={6}>
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
                      <td data-label="Date">{(typeof h.effectiveDate === "string" ? h.effectiveDate : h.effectiveDate.toISOString()).slice(0, 10)}</td>
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
