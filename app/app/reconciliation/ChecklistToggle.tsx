"use client";

import { toggleChecklistAction, type ChecklistField } from "./actions";
import { useAutosave } from "../useAutosave";
import { SaveStatusBadge } from "../SaveStatusBadge";

/** A checklist item toggles the moment it's clicked — no separate Check/Uncheck button. */
export function ChecklistToggle({
  jobId,
  field,
  checked,
  label,
  editable,
}: {
  jobId: string;
  field: ChecklistField;
  checked: boolean;
  label: string;
  editable: boolean;
}) {
  const autosave = useAutosave((formData) =>
    toggleChecklistAction(jobId, field, formData.get("value") === "1")
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: editable ? "pointer" : "default" }}>
        <input
          type="checkbox"
          defaultChecked={checked}
          disabled={!editable}
          onChange={(e) => {
            const fd = new FormData();
            fd.set("value", e.target.checked ? "1" : "0");
            autosave.saveNow(() => fd);
          }}
        />
        {label}
      </label>
      <SaveStatusBadge status={autosave.status} error={autosave.error} />
    </div>
  );
}
