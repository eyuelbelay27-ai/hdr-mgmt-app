"use client";

import { useState } from "react";
import { updateCostEstimateNotesAction } from "./costEstimateActions";
import { useAutosave } from "../../useAutosave";
import { SaveStatusBadge } from "../../SaveStatusBadge";

export function CostEstimateNotesForm({ jobId, notes }: { jobId: string; notes: string | null }) {
  const [text, setText] = useState(notes ?? "");
  const autosave = useAutosave((formData) => updateCostEstimateNotesAction(jobId, { error: null }, formData));

  const buildFormData = (notesValue: string, file?: File | null) => {
    const fd = new FormData();
    fd.set("notes", notesValue);
    if (file) fd.set("priceListFile", file);
    return fd;
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          autosave.schedule(() => buildFormData(e.target.value));
        }}
      />
      <div>
        <label className="label" htmlFor="priceListFile">Price List File (optional)</label>
        <input
          className="input"
          id="priceListFile"
          type="file"
          accept="image/*,.pdf,.xlsx,.csv"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file) autosave.saveNow(() => buildFormData(text, file));
          }}
        />
      </div>
      <SaveStatusBadge status={autosave.status} error={autosave.error} />
    </div>
  );
}
