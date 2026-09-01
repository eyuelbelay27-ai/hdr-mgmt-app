"use client";

import { useFormState } from "react-dom";
import { resetPasswordAction, type ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";

const initialState: ActionState = { error: null };

export function PasswordResetForm({ userId }: { userId: string }) {
  const boundAction = resetPasswordAction.bind(null, userId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} style={{ display: "flex", gap: 8, alignItems: "end" }}>
      <div>
        <label className="label">New Password</label>
        <input className="input" name="password" type="password" minLength={8} required />
      </div>
      <SubmitButton label="Reset Password" pendingLabel="Saving…" className="btn btn-sm" />
      {state.error && <p className="login-error">{state.error}</p>}
      {!state.error && state !== initialState && <span className="label">Password updated.</span>}
    </form>
  );
}
