"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddExpenseForm } from "./AddExpenseForm";

/** Mobile-only: keeps the Add Purchase/Add Receipt form off-screen until asked for,
 * instead of it permanently eating vertical space (Section 7.4/7.6). */
export function AddExpenseToggle({ jobId, entryType }: { jobId: string; entryType: "purchase" | "receipt" }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn btn-sm expense-add-toggle" onClick={() => setOpen(true)}>
        <Plus size={14} strokeWidth={2} /> {entryType === "purchase" ? "Add Purchase" : "Add Receipt"}
      </button>
    );
  }
  return (
    <div>
      <AddExpenseForm jobId={jobId} entryType={entryType} />
      <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
