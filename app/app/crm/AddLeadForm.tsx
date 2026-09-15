"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { createCrmLeadAction, type CrmActionState } from "./actions";
import { SubmitButton } from "../SubmitButton";
import { LeadFormFields } from "./LeadFormFields";
import type { CrmLeadData } from "./listData";

const initialState: CrmActionState = { error: null };

export function AddLeadForm({
  reps,
  onCreated,
}: {
  reps: { id: string; name: string }[];
  onCreated: (lead: CrmLeadData) => void;
}) {
  const [state, formAction] = useFormState(createCrmLeadAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state !== initialState && state.error === null && state.lead) {
      formRef.current?.reset();
      onCreated(state.lead);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card" style={{ padding: 16, display: "grid", gap: 12, marginTop: 12 }}>
      <LeadFormFields reps={reps} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <SubmitButton label="Register Lead" pendingLabel="Saving…" className="btn btn-sm btn-primary" />
        {state.error && <span className="login-error">{state.error}</span>}
      </div>
    </form>
  );
}
