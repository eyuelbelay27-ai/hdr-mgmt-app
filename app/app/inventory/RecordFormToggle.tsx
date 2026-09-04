"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { RecordForm } from "./RecordForm";

/** Mobile-only: keeps the Record Stock In/Out form off-screen until asked
 * for, instead of it permanently eating vertical space (Section 4.4). */
export function RecordFormToggle({
  direction,
  materials,
}: {
  direction: "in" | "out";
  materials: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn btn-sm expense-add-toggle" onClick={() => setOpen(true)}>
        <Plus size={14} strokeWidth={2} /> Record Stock {direction === "in" ? "In" : "Out"}
      </button>
    );
  }
  return (
    <div>
      <RecordForm direction={direction} materials={materials} />
      <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
