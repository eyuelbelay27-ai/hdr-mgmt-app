"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { MaterialRow } from "./MaterialRow";
import { MaterialCard, type MaterialData } from "./MaterialCard";
import { AddMaterialForm } from "./AddMaterialForm";

/**
 * Owns the materials list as local state, seeded once from the server on
 * first render. This is what actually fixes the "list jumps around while
 * you're typing a name" bug: the old page re-fetched and re-sorted
 * alphabetically from the server on every autosave (since a name edit
 * changes sort position immediately), reshuffling the row out from under
 * whatever you were mid-edit on. Local state never re-sorts on its own —
 * an edited row simply stays where it started until the next full page
 * load, exactly like every other editable list in this app (Budget,
 * Expenses, Inventory).
 */
export function PriceDatabaseBoard({
  initialMaterials,
  editable,
}: {
  initialMaterials: MaterialData[];
  editable: boolean;
}) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [addOpen, setAddOpen] = useState(false);

  const handleUpdate = (id: string, patch: Partial<MaterialData>) => {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const handleDelete = (id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCreated = (material: MaterialData) => {
    setMaterials((prev) => [...prev, material]);
    setAddOpen(false);
  };

  return (
    <div>
      <div className="pricedb-desktop-table">
        <div className="card dtable-wrap">
        <table className="dtable">
          <thead>
            <tr>
              {["Name", "Category", "Unit", "Rate", "Default Qty", ""].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <MaterialRow key={m.id} material={m} editable={editable} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
            {materials.length === 0 && (
              <tr>
                <td className="label" colSpan={6}>No materials registered yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="pricedb-mobile-cards">
        {materials.map((m) => (
          <MaterialCard key={m.id} material={m} editable={editable} onUpdate={handleUpdate} onDelete={handleDelete} />
        ))}
        {materials.length === 0 && <p className="label">No materials registered yet.</p>}
      </div>

      {editable && (
        addOpen ? (
          <div>
            <AddMaterialForm onCreated={handleCreated} />
            <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-sm expense-add-toggle" onClick={() => setAddOpen(true)}>
            <Plus size={14} strokeWidth={2} /> Add Material
          </button>
        )
      )}
    </div>
  );
}
