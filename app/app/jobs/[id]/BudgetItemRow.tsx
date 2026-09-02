"use client";

import { useId, useRef, useState } from "react";
import { updateBudgetItemAction, deleteBudgetItemAction } from "./budgetActions";
import { useAutosave } from "../../useAutosave";
import { SaveStatusBadge } from "../../SaveStatusBadge";

interface BudgetItem {
  id: string;
  label: string;
  category: string;
  amount: unknown;
  qty: unknown;
  unit: string | null;
  comment: string | null;
  source: string;
}

export function BudgetItemRow({ item, jobId, editable }: { item: BudgetItem; jobId: string; editable: boolean }) {
  const [category, setCategory] = useState(item.category);
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const deleteAction = deleteBudgetItemAction.bind(null, item.id, jobId);
  const autosave = useAutosave((formData) => updateBudgetItemAction(item.id, jobId, formData));

  const buildFormData = () => new FormData(formRef.current as HTMLFormElement);

  if (!editable) {
    return (
      <tr>
        <td data-label="Description">{item.label}</td>
        <td data-label="Category">{item.category === "cash" ? "Cash" : "Stock"}</td>
        <td className="mono" data-label="Amount / Qty+Unit">
          {item.category === "stock" ? `${String(item.qty)} ${item.unit ?? ""}` : String(item.amount)}
        </td>
        <td data-label="Comment">{item.comment ?? "—"}</td>
        <td data-label="Source" className="label">{item.source === "CostEstimate" ? "Cost Estimate" : "Manual"}</td>
      </tr>
    );
  }

  return (
    <>
      <tr style={{ display: "none" }}>
        <td>
          <form id={formId} ref={formRef} />
        </td>
      </tr>
      <tr>
        <td data-label="Description">
          <input
            className="input"
            form={formId}
            name="label"
            defaultValue={item.label}
            required
            onChange={() => autosave.schedule(buildFormData)}
          />
        </td>
        <td data-label="Category">
          <select
            className="input"
            form={formId}
            name="category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              autosave.saveNow(buildFormData);
            }}
          >
            <option value="cash">Cash</option>
            <option value="stock">Stock</option>
          </select>
        </td>
        <td data-label="Amount / Qty+Unit" data-span={category === "stock" ? "full" : undefined}>
          {category === "stock" ? (
            <div style={{ display: "flex", gap: 4 }}>
              <input
                className="input"
                form={formId}
                name="qty"
                type="number"
                step="0.01"
                style={{ width: 80 }}
                defaultValue={item.qty === null ? "" : String(item.qty)}
                onChange={() => autosave.schedule(buildFormData)}
              />
              <input
                className="input"
                form={formId}
                name="unit"
                style={{ width: 70 }}
                defaultValue={item.unit ?? ""}
                onChange={() => autosave.schedule(buildFormData)}
              />
            </div>
          ) : (
            <input
              className="input"
              form={formId}
              name="amount"
              type="number"
              step="0.01"
              defaultValue={item.amount === null ? "" : String(item.amount)}
              onChange={() => autosave.schedule(buildFormData)}
            />
          )}
        </td>
        <td data-label="Comment">
          <input
            className="input"
            form={formId}
            name="comment"
            defaultValue={item.comment ?? ""}
            onChange={() => autosave.schedule(buildFormData)}
          />
        </td>
        <td data-label="Actions" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <SaveStatusBadge status={autosave.status} error={autosave.error} />
          <form action={deleteAction}>
            <button className="btn btn-sm btn-danger" type="submit">Delete</button>
          </form>
        </td>
      </tr>
    </>
  );
}
