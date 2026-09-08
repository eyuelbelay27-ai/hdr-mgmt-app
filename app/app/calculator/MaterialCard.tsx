"use client";

import { useState } from "react";
import { Package, Wallet, ChevronRight } from "lucide-react";
import { updateMaterialAction, deleteMaterialAction } from "./actions";
import { useAutosave } from "../useAutosave";
import { SaveStatusBadge } from "../SaveStatusBadge";
import { toNumber } from "@/lib/money";

interface HistoryEntry {
  id: string;
  oldPrice: unknown;
  newPrice: unknown;
  effectiveDate: Date | string;
  changedBy: { name: string } | null;
}

export interface MaterialData {
  id: string;
  name: string;
  category: string;
  unit: string;
  rate: unknown;
  defaultQty: unknown;
  active: boolean;
  priceHistory: HistoryEntry[];
}

/** Compact single-row card, mobile only — same expense-row layout language
 * as the Expenses tab (tap to expand in place), but every field inside is
 * editable instead of read-only, plus History and Delete. */
export function MaterialCard({
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
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isStock = material.category === "stock";
  const autosave = useAutosave((formData) => updateMaterialAction(material.id, { error: null }, formData));

  const buildFormData = (overrides?: Record<string, string>) => {
    const fd = new FormData();
    fd.set("name", overrides?.name ?? material.name);
    fd.set("category", overrides?.category ?? material.category);
    fd.set("unit", overrides?.unit ?? material.unit);
    fd.set("rate", overrides?.rate ?? (material.rate === null ? "" : String(material.rate)));
    fd.set("defaultQty", overrides?.defaultQty ?? (material.defaultQty === null ? "" : String(material.defaultQty)));
    fd.set("active", (overrides?.active ?? String(material.active)) === "true" ? "on" : "");
    return fd;
  };

  const handleChange = (field: keyof MaterialData, value: string, immediate = false) => {
    onUpdate(material.id, { [field]: value } as Partial<MaterialData>);
    const fd = buildFormData({ [field]: value });
    if (immediate) autosave.saveNow(() => fd);
    else autosave.schedule(() => fd);
  };

  const handleActiveToggle = (checked: boolean) => {
    onUpdate(material.id, { active: checked });
    const fd = buildFormData({ active: String(checked) });
    autosave.saveNow(() => fd);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await deleteMaterialAction(material.id);
    onDelete(material.id);
  };

  return (
    <div className="card expense-row">
      <button type="button" className="expense-row-header" onClick={() => setOpen((o) => !o)}>
        <span className={`pricedb-row-icon ${isStock ? "stock" : "cash"}`}>
          {isStock ? <Package size={15} strokeWidth={2} /> : <Wallet size={15} strokeWidth={2} />}
        </span>
        <div className="expense-row-main">
          <div className="expense-row-item">{material.name}</div>
          <span
            className="badge"
            style={isStock ? { background: "var(--info-soft)", color: "var(--info)" } : { background: "var(--accent-soft)", color: "var(--accent-text)" }}
          >
            {isStock ? "Stock" : "Cash"}
          </span>
        </div>
        <div className="expense-row-amounts">
          <div className="expense-row-total">{material.rate === null ? "—" : `${toNumber(material.rate).toLocaleString()} Br`}</div>
          <div>{material.unit || "—"}</div>
        </div>
        <ChevronRight size={16} strokeWidth={2} className="expense-row-chevron" style={{ transform: open ? "rotate(90deg)" : undefined }} />
      </button>

      {open && (
        <div className="expense-row-detail">
          {editable ? (
            <div className="pricedb-field-grid">
              <div className="pricedb-field-full">
                <div className="label" style={{ marginBottom: 2 }}>Name</div>
                <input
                  className="input"
                  defaultValue={material.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Category</div>
                <select
                  className="input"
                  defaultValue={material.category}
                  onChange={(e) => handleChange("category", e.target.value, true)}
                >
                  <option value="cash">Cash</option>
                  <option value="stock">Stock</option>
                </select>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Unit</div>
                <input className="input" defaultValue={material.unit} onChange={(e) => handleChange("unit", e.target.value)} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Rate</div>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={material.rate === null ? "" : String(material.rate)}
                  onChange={(e) => handleChange("rate", e.target.value)}
                />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Default Qty</div>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={material.defaultQty === null ? "" : String(material.defaultQty)}
                  onChange={(e) => handleChange("defaultQty", e.target.value)}
                />
              </div>
              <div className="pricedb-field-full" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  defaultChecked={material.active}
                  onChange={(e) => handleActiveToggle(e.target.checked)}
                />
                <span className="label" style={{ marginBottom: 0 }}>Active</span>
                <SaveStatusBadge status={autosave.status} error={autosave.error} />
              </div>
            </div>
          ) : (
            <div className="pricedb-field-grid">
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Category</div>
                <div style={{ fontSize: 13.5 }}>{isStock ? "Stock" : "Cash"}</div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Unit</div>
                <div style={{ fontSize: 13.5 }}>{material.unit || "—"}</div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Default Qty</div>
                <div style={{ fontSize: 13.5 }}>{material.defaultQty === null ? "—" : String(material.defaultQty)}</div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Active</div>
                <div style={{ fontSize: 13.5 }}>{material.active ? "Active" : "Inactive"}</div>
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ marginTop: 10 }}
            onClick={() => setHistoryOpen((v) => !v)}
          >
            History ({material.priceHistory.length})
          </button>
          {historyOpen && (
            <div style={{ marginTop: 8 }}>
              {material.priceHistory.length === 0 ? (
                <span className="label">No price changes recorded.</span>
              ) : (
                material.priceHistory.map((h) => (
                  <div key={h.id} style={{ fontSize: 12.5, padding: "4px 0", borderTop: "1px solid var(--border-soft)" }}>
                    <span className="mono">
                      {(typeof h.effectiveDate === "string" ? h.effectiveDate : h.effectiveDate.toISOString()).slice(0, 10)}
                    </span>
                    {" — "}
                    {h.oldPrice === null ? "—" : String(h.oldPrice)} &rarr; {h.newPrice === null ? "—" : String(h.newPrice)}
                    {h.changedBy && ` (${h.changedBy.name})`}
                  </div>
                ))
              )}
            </div>
          )}

          {editable && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              style={{ marginTop: 10 }}
            >
              <button className="btn btn-sm btn-danger" type="submit" disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
