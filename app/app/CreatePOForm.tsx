"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { createPurchaseOrderAction, type ActionState } from "./poActions";
import { SubmitButton } from "./SubmitButton";
import { StockMaterialSelect } from "./StockMaterialSelect";
import type { StockMaterial } from "@/lib/materials";
import { round2, toNumber } from "@/lib/money";

const initialState: ActionState = { error: null };

export function CreatePOForm({ stockMaterials }: { stockMaterials: StockMaterial[] }) {
  const [state, formAction] = useFormState(createPurchaseOrderAction, initialState);
  const [category, setCategory] = useState<"cash" | "stock">("cash");
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState("");
  const [key, setKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state !== initialState && state.error === null) {
      formRef.current?.reset();
      setKey((k) => k + 1);
      setMaterialId("");
      setQty("");
    }
  }, [state]);

  const selectedMaterial = stockMaterials.find((m) => m.id === materialId);
  const rate = selectedMaterial ? toNumber(selectedMaterial.rate) : 0;
  const computedTotal = round2(toNumber(qty) * rate);

  return (
    <form
      key={key}
      ref={formRef}
      action={formAction}
      className="card"
      style={{ padding: 16, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}
    >
      <div style={{ flex: "1 1 150px" }}>
        <label className="label">Date</label>
        <input className="input" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div style={{ flex: "1 1 140px" }}>
        <label className="label">Purchaser</label>
        <input className="input" name="purchaser" />
      </div>
      {category === "stock" ? (
        <div style={{ flex: "1 1 160px" }}>
          <label className="label">Item</label>
          <StockMaterialSelect materials={stockMaterials} onChange={setMaterialId} />
        </div>
      ) : (
        <div style={{ flex: "1 1 140px" }}>
          <label className="label">Item</label>
          <input className="input" name="item" required />
        </div>
      )}
      <div style={{ flex: "1 1 160px" }}>
        <label className="label">Description</label>
        <input className="input" name="description" />
      </div>
      <div style={{ flex: "1 1 130px" }}>
        <label className="label">Category</label>
        <select
          className="input"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as "cash" | "stock")}
        >
          <option value="cash">Cash</option>
          <option value="stock">Stock</option>
        </select>
      </div>
      <div style={{ flex: "1 1 90px" }}>
        <label className="label">Qty</label>
        <input
          className="input"
          name="qty"
          type="number"
          step="0.01"
          min="0"
          required
          style={{ width: "100%" }}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </div>
      {category === "stock" ? (
        // Price always comes from the Price Database, never typed — a
        // read-only preview, matching the Expenses tab.
        <div style={{ flex: "1 1 150px" }}>
          <label className="label">Price (from Price Database)</label>
          <div className="mono" style={{ padding: "8px 0", fontSize: 13.5 }}>
            {selectedMaterial ? `${rate.toLocaleString()} Br × ${qty || 0} = ${computedTotal.toLocaleString()} Br` : "Choose an item first"}
          </div>
        </div>
      ) : (
        <div style={{ flex: "1 1 110px" }}>
          <label className="label">Price</label>
          <input className="input" name="price" type="number" step="0.01" min="0" required style={{ width: "100%" }} />
        </div>
      )}
      <SubmitButton label="Submit for Approval" pendingLabel="Submitting…" className="btn btn-sm btn-primary" />
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
