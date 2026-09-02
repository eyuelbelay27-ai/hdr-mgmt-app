"use client";

import { useId, useState } from "react";
import { updateBudgetItemAction, deleteBudgetItemAction } from "./budgetActions";

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
  const updateAction = updateBudgetItemAction.bind(null, item.id, jobId);
  const deleteAction = deleteBudgetItemAction.bind(null, item.id, jobId);

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
          <form id={formId} action={updateAction} />
        </td>
      </tr>
      <tr>
        <td data-label="Description"><input className="input" form={formId} name="label" defaultValue={item.label} required /></td>
        <td data-label="Category">
          <select
            className="input"
            form={formId}
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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
              />
              <input className="input" form={formId} name="unit" style={{ width: 70 }} defaultValue={item.unit ?? ""} />
            </div>
          ) : (
            <input
              className="input"
              form={formId}
              name="amount"
              type="number"
              step="0.01"
              defaultValue={item.amount === null ? "" : String(item.amount)}
            />
          )}
        </td>
        <td data-label="Comment"><input className="input" form={formId} name="comment" defaultValue={item.comment ?? ""} /></td>
        <td data-label="Actions" style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-sm" form={formId} type="submit">Save</button>
          <form action={deleteAction}>
            <button className="btn btn-sm btn-danger" type="submit">Delete</button>
          </form>
        </td>
      </tr>
    </>
  );
}
