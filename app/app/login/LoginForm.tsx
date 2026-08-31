"use client";

import { useFormState } from "react-dom";
import { loginAction } from "./actions";
import { SubmitButton } from "../SubmitButton";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction] = useFormState(loginAction, { error: null });

  return (
    <form action={formAction} className="login-form">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <label className="label" htmlFor="username">
        Username
      </label>
      <input
        className="input"
        id="username"
        name="username"
        type="text"
        autoComplete="username"
        required
      />

      <label className="label" htmlFor="password">
        Password
      </label>
      <input
        className="input"
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      {state.error && <p className="login-error">{state.error}</p>}

      <SubmitButton label="Sign In" pendingLabel="Signing in…" />
    </form>
  );
}
