"use client";

import { useState } from "react";
import { updateActualSpentAction } from "./expensesActions";
import { useAutosave } from "../../useAutosave";
import { SaveStatusBadge } from "../../SaveStatusBadge";

export function ActualSpentCell({
  expenseId,
  jobId,
  actualSpent,
  placeholder,
}: {
  expenseId: string;
  jobId: string;
  actualSpent: unknown;
  placeholder: string;
}) {
  const [value, setValue] = useState(actualSpent === null ? "" : String(actualSpent));
  const autosave = useAutosave((formData) => updateActualSpentAction(expenseId, jobId, formData));

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      <input
        className="input"
        type="number"
        step="0.01"
        value={value}
        style={{ width: 90 }}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          autosave.schedule(() => {
            const fd = new FormData();
            fd.set("actualSpent", e.target.value);
            return fd;
          });
        }}
      />
      <SaveStatusBadge status={autosave.status} error={autosave.error} />
    </div>
  );
}
