"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { addExpenseAction } from "./expensesActions";
import type { ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";
import { FileField } from "../../FileField";
import { StockMaterialSelect } from "../../StockMaterialSelect";
import type { StockMaterial } from "@/lib/materials";
import { round2, toNumber } from "@/lib/money";

const initialState: ActionState = { error: null };

export function AddExpenseForm({
  jobId,
  entryType,
  stockMaterials,
}: {
  jobId: string;
  entryType: "purchase" | "receipt";
  stockMaterials: StockMaterial[];
}) {
  const boundAction = addExpenseAction.bind(null, jobId, entryType);
  const [state, formAction] = useFormState(boundAction, initialState);
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
      encType="multipart/form-data"
      className="card"
      style={{ padding: 16, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginTop: 12 }}
    >
      <div style={{ flex: "1 1 150px" }}>
        <label className="label">Date</label>
        <input className="input" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div style={{ flex: "1 1 140px" }}>
        <label className="label">Purchaser</label>
        <input className="input" name="purchaser" />
      </div>
      {entryType === "purchase" && category === "stock" ? (
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
      {entryType === "purchase" && (
        <div style={{ flex: "1 1 130px" }}>
          <label className="label">Category</label>
          <select className="input" name="category" value={category} onChange={(e) => setCategory(e.target.value as "cash" | "stock")}>
            <option value="cash">Cash</option>
            <option value="stock">Stock</option>
          </select>
        </div>
      )}
      {entryType === "purchase" && category === "stock" ? (
        <>
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
          {/* Unit price always comes from the Price Database, never typed —
              this is a read-only preview, not an input. */}
          <div style={{ flex: "1 1 150px" }}>
            <label className="label">Unit Price (from Price Database)</label>
            <div className="mono" style={{ padding: "8px 0", fontSize: 13.5 }}>
              {selectedMaterial ? `${rate.toLocaleString()} Br × ${qty || 0} = ${computedTotal.toLocaleString()} Br` : "Choose an item first"}
            </div>
          </div>
        </>
      ) : (
        <div style={{ flex: "1 1 140px" }}>
          <label className="label">Total Price (Br)</label>
          <input className="input" name="totalPrice" type="number" step="0.01" min="0" required />
        </div>
      )}
      {entryType === "receipt" && <FileField id={`receipt-${entryType}`} name="receipt" label="Receipt" required />}
      <SubmitButton
        label={entryType === "purchase" ? "Add Purchase" : "Add Receipt"}
        pendingLabel="Adding…"
        className="btn btn-sm btn-primary"
      />
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
