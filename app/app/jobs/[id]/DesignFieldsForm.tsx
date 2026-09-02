"use client";

import { useState } from "react";
import { updateDesignFieldsAction } from "./actions";
import { useAutosave } from "../../useAutosave";
import { SaveStatusBadge } from "../../SaveStatusBadge";

export function DesignFieldsForm({
  jobId,
  designer,
  supervisor,
  productionNotes,
}: {
  jobId: string;
  designer: string | null;
  supervisor: string | null;
  productionNotes: string | null;
}) {
  const [fields, setFields] = useState({
    designer: designer ?? "",
    supervisor: supervisor ?? "",
    productionNotes: productionNotes ?? "",
  });
  const autosave = useAutosave((formData) => updateDesignFieldsAction(jobId, { error: null }, formData));

  const buildFormData = (values: typeof fields) => {
    const fd = new FormData();
    fd.set("designer", values.designer);
    fd.set("supervisor", values.supervisor);
    fd.set("productionNotes", values.productionNotes);
    return fd;
  };

  const update = (key: keyof typeof fields, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    autosave.schedule(() => buildFormData(next));
  };

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div className="form-row">
        <div>
          <label className="label" htmlFor="designer">Designer</label>
          <input
            className="input"
            id="designer"
            value={fields.designer}
            onChange={(e) => update("designer", e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="supervisor">Supervisor</label>
          <input
            className="input"
            id="supervisor"
            value={fields.supervisor}
            onChange={(e) => update("supervisor", e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="productionNotes">
          Production Notes
        </label>
        <textarea
          className="input"
          id="productionNotes"
          rows={4}
          value={fields.productionNotes}
          onChange={(e) => update("productionNotes", e.target.value)}
        />
      </div>
      <SaveStatusBadge status={autosave.status} error={autosave.error} />
    </div>
  );
}
