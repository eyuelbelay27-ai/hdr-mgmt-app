"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { resetInventoryAction } from "./actions";
import type { ActionState } from "./actions";

const CONFIRM_PHRASE = "RESET INVENTORY";
const initialState: ActionState = { error: null };

/** Irreversible whole-ledger wipe — typing a fixed phrase replaces a native
 * confirm() dialog, matching this app's house style for its most destructive
 * actions (e.g. DeleteJobControl typing the exact job number). There's no
 * single natural identifier for "all of Inventory", so a fixed phrase
 * stands in for one. */
export function ResetInventoryControl() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction] = useFormState(resetInventoryAction, initialState);

  useEffect(() => {
    if (state !== initialState && state.error === null) {
      setOpen(false);
      setTyped("");
    }
  }, [state]);

  if (!open) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setOpen(true)}>
        Reset Inventory
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px" }}>
        <label className="label">
          Type <span className="mono">{CONFIRM_PHRASE}</span> to permanently delete the entire Inventory ledger
        </label>
        <input
          className="input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </div>
      <button className="btn btn-sm btn-danger" type="submit" disabled={typed.trim() !== CONFIRM_PHRASE}>
        Permanently Reset
      </button>
      <button className="btn btn-sm" type="button" onClick={() => { setOpen(false); setTyped(""); }}>
        Never Mind
      </button>
      {state.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}
