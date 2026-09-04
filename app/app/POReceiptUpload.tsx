"use client";

import { uploadPurchaseOrderReceiptAction } from "./poActions";
import { useAutosave } from "./useAutosave";
import { SaveStatusBadge } from "./SaveStatusBadge";

/** Immediate upload on file selection, matching the house pattern for
 * single-file attachments (no separate Save button — picking a file is
 * the action). */
export function POReceiptUpload({ poId }: { poId: string }) {
  const autosave = useAutosave((formData) => uploadPurchaseOrderReceiptAction(poId, { error: null }, formData));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
      <input
        className="input"
        type="file"
        accept="image/*,.pdf"
        style={{ fontSize: 11.5 }}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (!file) return;
          const fd = new FormData();
          fd.set("receipt", file);
          autosave.saveNow(() => fd);
        }}
      />
      <SaveStatusBadge status={autosave.status} error={autosave.error} />
    </div>
  );
}
