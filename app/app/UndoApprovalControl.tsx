"use client";

import { useState } from "react";
import { revertPurchaseOrderApprovalAction } from "./poActions";

/** Two-step destructive confirm (Section 9) — no native confirm() dialog. */
export function UndoApprovalControl({ poId }: { poId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setConfirming(true)}>
        Undo Approval
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <form action={revertPurchaseOrderApprovalAction.bind(null, poId)}>
        <button className="btn btn-sm btn-danger" type="submit">Confirm Undo</button>
      </form>
      <button className="btn btn-sm" type="button" onClick={() => setConfirming(false)}>Never Mind</button>
    </div>
  );
}
