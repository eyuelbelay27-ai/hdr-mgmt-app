"use client";

import { useMemo, useState } from "react";
import { round2, toNumber } from "@/lib/money";
import { saveCostEstimateQuantitiesAction, deleteCostEstimateItemAction } from "./costEstimateActions";
import { AddCostEstimateItemForm } from "./AddCostEstimateItemForm";
import { useAutosave } from "../../useAutosave";
import { SaveStatusBadge } from "../../SaveStatusBadge";

interface CostItem {
  id: string;
  materialId: string | null;
  name: string;
  category: string;
  unit: string;
  qty: number;
  unitPrice: number;
  total: number;
  source: string;
  comment: string | null;
}

const ROW_GRID = "1fr 56px 84px";

/**
 * A client component (not the whole tab) so the Qty → Total math updates
 * as you type, instead of only after "Save Quantities" round-trips to the
 * server. Save still persists via the same server action and `name`d
 * inputs as before — this only adds an instant local preview on top.
 *
 * Collapsible, one-line-per-material layout: the previous version was a
 * real <table> with Material/Unit/Rate/Qty/Total as five separate
 * columns, which on a phone became five stacked label/value lines per
 * material — scrolling a 50-item Price Database meant scrolling past
 * hundreds of lines. Rate+unit is now a subtitle under the material name
 * instead of two columns, the whole category collapses to one row when
 * you're not touching it, and a small header row above the list keeps
 * the Qty/Total columns readable like a table, at every screen width.
 */
export function CostEstimateCategorySheet({
  category,
  label,
  materials,
  items,
  jobId,
  editable,
  canAddAdhoc,
}: {
  category: "cash" | "stock";
  label: string;
  materials: { id: string; name: string; unit: string; rate: number | null }[];
  items: CostItem[];
  jobId: string;
  editable: boolean;
  canAddAdhoc: boolean;
}) {
  const [open, setOpen] = useState(true);

  const itemsByMaterial = useMemo(
    () => new Map(items.filter((i) => i.materialId).map((i) => [i.materialId as string, i])),
    [items]
  );
  const manualItems = items.filter((i) => !i.materialId && i.category === category);
  const manualTotal = manualItems.reduce((sum, i) => sum + toNumber(i.total), 0);

  const [qtys, setQtys] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const m of materials) {
      const existing = itemsByMaterial.get(m.id);
      if (existing) init[m.id] = String(existing.qty);
    }
    return init;
  });

  const rowTotal = (materialId: string, rate: number | null) => {
    const qty = Number(qtys[materialId]);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    return round2(qty * toNumber(rate));
  };

  const categoryTotal = manualTotal + materials.reduce((sum, m) => sum + rowTotal(m.id, m.rate), 0);

  const autosave = useAutosave((formData) => saveCostEstimateQuantitiesAction(jobId, category, formData));
  const buildQtyFormData = (values: Record<string, string>) => {
    const fd = new FormData();
    for (const m of materials) fd.set(`qty_${m.id}`, values[m.id] ?? "");
    return fd;
  };

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}
      >
        <span
          style={{
            display: "inline-block",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            color: "var(--text-dim)",
            fontSize: 12,
          }}
        >
          &#9656;
        </span>
        <h3 style={{ margin: 0, flex: 1, fontSize: 15 }}>{label} Items</h3>
        {editable && <SaveStatusBadge status={autosave.status} error={autosave.error} />}
        <div className="mono" style={{ fontWeight: 600 }}>{categoryTotal.toLocaleString()} Br</div>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "4px 16px 16px" }}>
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: ROW_GRID,
                gap: 8,
                padding: "8px 4px 6px",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.02em",
              }}
            >
              <span>Material</span>
              <span style={{ textAlign: "right" }}>Qty</span>
              <span style={{ textAlign: "right" }}>Total</span>
            </div>

            {materials.map((m) => {
              const existing = itemsByMaterial.get(m.id);
              const total = rowTotal(m.id, m.rate);
              return (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: ROW_GRID,
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 4px",
                    borderTop: "1px solid var(--border-soft)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>{m.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {m.rate === null ? "no rate set" : `${toNumber(m.rate).toLocaleString()}/${m.unit}`}
                    </div>
                  </div>
                  {editable ? (
                    <input
                      className="input"
                      style={{ width: "100%", textAlign: "right", padding: "6px 4px", minHeight: 34 }}
                      type="number"
                      step="0.01"
                      min="0"
                      name={`qty_${m.id}`}
                      value={qtys[m.id] ?? ""}
                      onChange={(e) => {
                        const next = { ...qtys, [m.id]: e.target.value };
                        setQtys(next);
                        autosave.schedule(() => buildQtyFormData(next));
                      }}
                      disabled={m.rate === null}
                    />
                  ) : (
                    <div className="mono" style={{ textAlign: "right", fontSize: 13.5 }}>
                      {(existing && String(existing.qty)) || "—"}
                    </div>
                  )}
                  <div
                    className="mono"
                    style={{
                      textAlign: "right",
                      fontSize: 13.5,
                      fontWeight: total > 0 ? 600 : 400,
                      color: total > 0 ? "var(--text)" : "var(--text-faint)",
                    }}
                  >
                    {total > 0 ? total.toLocaleString() : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          {manualItems.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="label" style={{ marginBottom: 4 }}>Ad-hoc Items</div>
              {manualItems.map((i) => (
                <div
                  key={i.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderTop: "1px solid var(--border-soft)" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{i.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {toNumber(i.qty)} {i.unit} &times; {toNumber(i.unitPrice).toLocaleString()}
                      {i.comment ? ` · ${i.comment}` : ""}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 13.5, fontWeight: 600, flexShrink: 0 }}>
                    {toNumber(i.total).toLocaleString()}
                  </div>
                  {canAddAdhoc && (
                    <form action={deleteCostEstimateItemAction.bind(null, i.id, jobId)}>
                      <button className="btn btn-sm btn-danger" type="submit">Delete</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {canAddAdhoc && (
            <div style={{ marginTop: 16 }}>
              <AddCostEstimateItemForm jobId={jobId} category={category} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
