"use client";

import { useFormState } from "react-dom";
import { resetRoleAction, type ActionState } from "./actions";
import { SubmitButton } from "../../SubmitButton";

const ROLES = ["Designer", "Supervisor", "Manager", "OwnerFinance", "Admin"] as const;
const ROLE_LABEL: Record<string, string> = {
  Designer: "Designer",
  Supervisor: "Supervisor",
  Manager: "Manager",
  OwnerFinance: "Owner/Finance",
  Admin: "Admin",
};

const initialState: ActionState = { error: null };

export function RoleForm({ userId, role }: { userId: string; role: string }) {
  const boundAction = resetRoleAction.bind(null, userId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} style={{ display: "flex", gap: 8, alignItems: "end" }}>
      <div>
        <label className="label">Role</label>
        <select className="input" name="role" defaultValue={role}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>
      <SubmitButton label="Change Role (resets permissions)" pendingLabel="Applying…" className="btn btn-sm" />
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
