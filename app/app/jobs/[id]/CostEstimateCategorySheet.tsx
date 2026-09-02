"use client";

import { useMemo, useState } from "react";
import { round2, toNumber } from "@/lib/money";
import { saveCostEstimateQuantitiesAction, deleteCostEstimateItemAction } from "./costEstimateActions";
import { AddCostEstimateItemForm } from "./AddCostEstimateItemForm";

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

/**
 * A client component (not the whole tab) so the Qty → Total math updates
 * as you type, instead of only after "Save Quantities" round-trips to the
 * server. Save still persists via the same server action and `name`d
 * inputs as before — this only adds a live local preview on top.
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

  const rowTotal = (materialId: string, rate: unknown) => {
    const qty = Number(qtys[materialId]);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    return round2(qty * toNumber(rate));
  };

  const categoryTotal =
    manualTotal + materials.reduce((sum, m) => sum + rowTotal(m.id, m.rate), 0);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{label} Items</h3>
        <div className="mono">{categoryTotal.toLocaleString()} ETB</div>
      </div>

      <form action={saveCostEstimateQuantitiesAction.bind(null, jobId, category)} style={{ marginTop: 10 }}>
        <div className="dtable-wrap">
        <table className="dtable">
          <thead>
            <tr>
              <th>Material</th>
              <th>Unit</th>
              <th>Rate</th>
              <th>Qty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => {
              const existing = itemsByMaterial.get(m.id);
              const total = rowTotal(m.id, m.rate);
              return (
                <tr key={m.id}>
                  <td data-label="Material">{m.name}</td>
                  <td data-label="Unit">{m.unit}</td>
                  <td className="mono" data-label="Rate">{m.rate === null ? "—" : toNumber(m.rate).toLocaleString()}</td>
                  <td data-label="Qty">
                    {editable ? (
                      <input
                        className="input"
                        style={{ width: 90 }}
                        type="number"
                        step="0.01"
                        min="0"
                        name={`qty_${m.id}`}
                        value={qtys[m.id] ?? ""}
                        onChange={(e) => setQtys((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        disabled={m.rate === null}
                      />
                    ) : (
                      (existing && String(existing.qty)) || "—"
                    )}
                  </td>
                  <td className="mono" data-label="Total">{total > 0 ? total.toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {editable && (
          <button className="btn btn-sm btn-primary" type="submit" style={{ marginTop: 8 }}>
            Save {label} Quantities
          </button>
        )}
      </form>

      {manualItems.length > 0 && (
        <div className="dtable-wrap" style={{ marginTop: 12 }}>
        <table className="dtable">
          <thead>
            <tr>
              <th>Ad-hoc Item</th>
              <th>Unit</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Comment</th>
              {canAddAdhoc && <th />}
            </tr>
          </thead>
          <tbody>
            {manualItems.map((i) => (
              <tr key={i.id}>
                <td data-label="Ad-hoc Item">{i.name}</td>
                <td data-label="Unit">{i.unit}</td>
                <td className="mono" data-label="Qty">{String(i.qty)}</td>
                <td className="mono" data-label="Unit Price">{toNumber(i.unitPrice).toLocaleString()}</td>
                <td className="mono" data-label="Total">{toNumber(i.total).toLocaleString()}</td>
                <td data-label="Comment">{i.comment ?? "—"}</td>
                {canAddAdhoc && (
                  <td>
                    <form action={deleteCostEstimateItemAction.bind(null, i.id, jobId)}>
                      <button className="btn btn-sm btn-danger" type="submit">Delete</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {canAddAdhoc && <AddCostEstimateItemForm jobId={jobId} category={category} />}
    </div>
  );
}
