"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { addCutFileAction, type ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";
import { FileField } from "../../FileField";

const initialState: ActionState = { error: null };

export function AddCutFileForm({ jobId }: { jobId: string }) {
  const boundAction = addCutFileAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (state !== initialState && state.error === null) {
      formRef.current?.reset();
      setKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form
      key={key}
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="card"
      style={{ padding: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
    >
      <div style={{ flex: 1 }}>
        <FileField id="file" name="file" label="Upload cut file (JPEG/PDF/AI)" accept="image/*,.pdf,.ai" required />
      </div>
      {state.error && <p className="login-error">{state.error}</p>}
      <SubmitButton label="Upload" pendingLabel="Uploading…" />
    </form>
  );
}
