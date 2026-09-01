"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { createUserAction, type CreateUserState } from "./actions";
import { SubmitButton } from "../SubmitButton";

const ROLES = ["Designer", "Supervisor", "Manager", "OwnerFinance", "Admin"] as const;
const ROLE_LABEL: Record<(typeof ROLES)[number], string> = {
  Designer: "Designer",
  Supervisor: "Supervisor",
  Manager: "Manager",
  OwnerFinance: "Owner/Finance",
  Admin: "Admin",
};

const initialState: CreateUserState = { error: null };

export function CreateUserForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createUserAction, initialState);

  useEffect(() => {
    if (state !== initialState && state.error === null) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)} type="button">
        New User
      </button>
    );
  }

  return (
    <form action={formAction} className="card" style={{ padding: 16, display: "grid", gap: 10, maxWidth: 380 }}>
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" required />
      </div>
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input className="input" id="username" name="username" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Temporary Password</label>
        <input className="input" id="password" name="password" type="password" minLength={8} required />
      </div>
      <div>
        <label className="label" htmlFor="role">Role</label>
        <select className="input" id="role" name="role" defaultValue="Designer">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      {state.error && <p className="login-error">{state.error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <SubmitButton label="Create User" pendingLabel="Creating…" />
        <button className="btn" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
