"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { addComponentAction, type ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";
import { FileField } from "../../FileField";

const initialState: ActionState = { error: null };

export function AddComponentForm({ jobId }: { jobId: string }) {
  const boundAction = addComponentAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (state !== initialState && state.error === null) {
      formRef.current?.reset();
      setKey((k) => k + 1); // remount the file input so it clears too
    }
  }, [state]);

  return (
    <form
      key={key}
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="card"
      style={{ padding: 16, display: "grid", gap: 10 }}
    >
      <div className="label">Add Component</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 10 }}>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input className="input" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="width">Width (m)</label>
          <input className="input" id="width" name="width" type="number" step="0.01" min="0" required />
        </div>
        <div>
          <label className="label" htmlFor="height">Height (m)</label>
          <input className="input" id="height" name="height" type="number" step="0.01" min="0" required />
        </div>
        <div>
          <label className="label" htmlFor="qty">Qty</label>
          <input className="input" id="qty" name="qty" type="number" step="1" min="1" required />
        </div>
        <div>
          <label className="label" htmlFor="ledColor">LED Colour</label>
          <input className="input" id="ledColor" name="ledColor" />
        </div>
      </div>
      <FileField id="art" name="art" label="Art (optional)" />
      {state.error && <p className="login-error">{state.error}</p>}
      <div>
        <SubmitButton label="Add Component" pendingLabel="Adding…" />
      </div>
    </form>
  );
}
