"use client";

import { useState } from "react";
import { deletePurchaseOrderAction } from "./poActions";

/** Two-step destructive confirm (Section 9), same pattern as Undo Approval. */
export function DeletePOControl({ poId, onDeleted }: { poId: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setConfirming(true)}>
        Delete
      </button>
    );
  }

  const handleDelete = async () => {
    setBusy(true);
    await deletePurchaseOrderAction(poId);
    onDeleted();
  };

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={handleDelete}>
        {busy ? "Deleting…" : "Confirm Delete"}
      </button>
      <button className="btn btn-sm" type="button" onClick={() => setConfirming(false)}>Never Mind</button>
    </div>
  );
}
