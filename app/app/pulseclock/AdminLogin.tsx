"use client";

import { useFormState, useFormStatus } from "react-dom";
import { setAdminPinAction, unlockAdminAction, type PulseState } from "./actions";
import { markUnlocked } from "./AdminGuard";

const INITIAL: PulseState = { error: null };

// Mark this page load as unlocked before the action runs: the server only
// renders the admin side if the PIN was actually right.
async function unlock(prev: PulseState, fd: FormData) {
  markUnlocked();
  return unlockAdminAction(prev, fd);
}

async function createPin(prev: PulseState, fd: FormData) {
  markUnlocked();
  return setAdminPinAction(prev, fd);
}

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="pc-button pc-primary pc-full" disabled={pending}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

function PinForm({ title }: { title: string }) {
  const [state, action] = useFormState(createPin, INITIAL);
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
  const [state, action] = useFormState(unlock, INITIAL);

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
          </>
        )}
      </div>
    </div>
  );
}
