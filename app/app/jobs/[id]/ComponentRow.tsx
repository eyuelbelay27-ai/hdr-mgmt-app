"use client";

import { useId, useRef } from "react";
import { updateComponentAction, deleteComponentAction } from "./actions";
import { useAutosave } from "../../useAutosave";
import { SaveStatusBadge } from "../../SaveStatusBadge";
import { Lightbox } from "../../Lightbox";

interface Component {
  id: string;
  name: string;
  width: unknown;
  height: unknown;
  qty: number;
  ledColor: string | null;
  artName: string | null;
  artUrl: string | null;
  artKind: string | null;
}

/** Uses the hidden-form-plus-`form=` attribute trick (matching
 * BudgetItemRow/MaterialRow) since the Delete button needs its own real
 * `<form>` and HTML forbids nesting one form inside another. */
export function ComponentRow({ component: c, jobId }: { component: Component; jobId: string }) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const autosave = useAutosave((formData) => updateComponentAction(c.id, jobId, formData));
  const buildFormData = () => new FormData(formRef.current as HTMLFormElement);

  return (
    <div className="card form-row" style={{ padding: 12 }}>
      <form id={formId} ref={formRef} encType="multipart/form-data" style={{ display: "none" }} />
      <div>
        <label className="label">Name</label>
        <input className="input" form={formId} name="name" defaultValue={c.name} required onChange={() => autosave.schedule(buildFormData)} />
      </div>
      <div>
        <label className="label">Width (m)</label>
        <input
          className="input"
          form={formId}
          name="width"
          type="number"
          step="0.01"
          defaultValue={String(c.width)}
          required
          onChange={() => autosave.schedule(buildFormData)}
        />
      </div>
      <div>
        <label className="label">Height (m)</label>
        <input
          className="input"
          form={formId}
          name="height"
          type="number"
          step="0.01"
          defaultValue={String(c.height)}
          required
          onChange={() => autosave.schedule(buildFormData)}
        />
      </div>
      <div>
        <label className="label">Qty</label>
        <input
          className="input"
          form={formId}
          name="qty"
          type="number"
          step="1"
          defaultValue={c.qty}
          required
          onChange={() => autosave.schedule(buildFormData)}
        />
      </div>
      <div>
        <label className="label">LED Colour</label>
        <input
          className="input"
          form={formId}
          name="ledColor"
          defaultValue={c.ledColor ?? ""}
          onChange={() => autosave.schedule(buildFormData)}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <SaveStatusBadge status={autosave.status} error={autosave.error} />
        <form action={deleteComponentAction.bind(null, c.id, jobId)}>
          <button className="btn btn-sm btn-danger" type="submit">Delete</button>
        </form>
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center" }}>
        {c.artUrl && <Lightbox file={{ name: c.artName ?? "art", url: c.artUrl, kind: c.artKind ?? "" }} />}
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor={`art-${c.id}`}>Replace art (optional)</label>
          <input
            className="input"
            id={`art-${c.id}`}
            form={formId}
            name="art"
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => {
              if (e.target.files?.[0]) autosave.saveNow(buildFormData);
            }}
          />
        </div>
      </div>
    </div>
  );
}
