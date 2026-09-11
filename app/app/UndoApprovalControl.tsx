"use client";

import { useState } from "react";
import { revertPurchaseOrderApprovalAction } from "./poActions";

/** Two-step destructive confirm (Section 9) — no native confirm() dialog. */
export function UndoApprovalControl({ poId, onReverted }: { poId: string; onReverted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setConfirming(true)}>
        Undo Approval
      </button>
    );
  }

  const handleUndo = async () => {
    setBusy(true);
    await revertPurchaseOrderApprovalAction(poId);
    onReverted();
  };

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={handleUndo}>
        {busy ? "Undoing…" : "Confirm Undo"}
      </button>
      <button className="btn btn-sm" type="button" onClick={() => setConfirming(false)}>Never Mind</button>
    </div>
  );
}
