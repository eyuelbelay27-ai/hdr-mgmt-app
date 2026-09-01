"use client";

import { useFormState } from "react-dom";
import { updateDesignFieldsAction, type ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";

const initialState: ActionState = { error: null };

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
  const boundAction = updateDesignFieldsAction.bind(null, jobId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="label" htmlFor="designer">Designer</label>
          <input className="input" id="designer" name="designer" defaultValue={designer ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="supervisor">Supervisor</label>
          <input className="input" id="supervisor" name="supervisor" defaultValue={supervisor ?? ""} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="productionNotes">
          Production Notes
        </label>
        <textarea
          className="input"
          id="productionNotes"
          name="productionNotes"
          rows={4}
          defaultValue={productionNotes ?? ""}
        />
      </div>
      {state.error && <p className="login-error">{state.error}</p>}
      <div>
        <SubmitButton label="Save" pendingLabel="Saving…" />
      </div>
    </form>
  );
}
