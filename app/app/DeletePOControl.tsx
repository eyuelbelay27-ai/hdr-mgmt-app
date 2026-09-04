"use client";

import { useState } from "react";
import { deletePurchaseOrderAction } from "./poActions";

/** Two-step destructive confirm (Section 9), same pattern as Undo Approval. */
export function DeletePOControl({ poId }: { poId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setConfirming(true)}>
        Delete
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <form action={deletePurchaseOrderAction.bind(null, poId)}>
        <button className="btn btn-sm btn-danger" type="submit">Confirm Delete</button>
      </form>
      <button className="btn btn-sm" type="button" onClick={() => setConfirming(false)}>Never Mind</button>
    </div>
  );
}
