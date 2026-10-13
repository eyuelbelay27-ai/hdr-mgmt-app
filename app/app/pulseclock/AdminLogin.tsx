"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { setAdminPinAction, unlockAdminAction, type PulseState } from "./actions";

const INITIAL: PulseState = { error: null };

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="pc-button pc-primary pc-full" disabled={pending}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

function PinForm({ title }: { title: string }) {
  const [state, action] = useFormState(setAdminPinAction, INITIAL);
  return (
    <form action={action}>
      <label className="pc-field">
        New PIN (4–8 digits)
        <input name="pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="\d{4,8}" required />
      </label>
      <label className="pc-field">
        Repeat PIN
        <input name="confirm" type="password" inputMode="numeric" autoComplete="new-password" pattern="\d{4,8}" required />
      </label>
      {state.error && <p className="pc-error">{state.error}</p>}
      <Submit>{title}</Submit>
    </form>
  );
}

export function AdminLogin({ pinSet, isAppAdmin }: { pinSet: boolean; isAppAdmin: boolean }) {
  const [state, action] = useFormState(unlockAdminAction, INITIAL);
  const [resetting, setResetting] = useState(false);

  return (
    <div className="pc-loginwrap">
      <div className="pc-login">
        <div className="pc-shield" aria-hidden>🔐</div>
        <div className="pc-eyebrow">Restricted</div>
        <h1>PulseClock admin</h1>

        {!pinSet ? (
          isAppAdmin ? (
            <>
              <p>No admin PIN yet. Create one — anyone who should manage attendance will need it.</p>
              <PinForm title="Create PIN" />
            </>
          ) : (
            <p>No admin PIN has been set yet. Ask an app admin to open this page and create one.</p>
          )
        ) : resetting ? (
          <>
            <p>Set a new PIN. The old one stops working right away.</p>
            <PinForm title="Reset PIN" />
            <button type="button" className="pc-button pc-ghost pc-full" onClick={() => setResetting(false)}>
              Back
            </button>
          </>
        ) : (
          <>
            <p>Enter the admin PIN to manage employees, records and reports.</p>
            <form action={action}>
              <label className="pc-field">
                PIN
                <input name="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus required />
              </label>
              {state.error && <p className="pc-error">{state.error}</p>}
              <Submit>Unlock</Submit>
            </form>
            {isAppAdmin && (
              <button type="button" className="pc-button pc-ghost pc-full" style={{ marginTop: 8 }} onClick={() => setResetting(true)}>
                Forgot PIN? Reset it
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
