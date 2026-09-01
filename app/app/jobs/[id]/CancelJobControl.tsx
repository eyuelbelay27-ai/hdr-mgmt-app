"use client";

import { useState } from "react";
import { cancelJobAction } from "./statusActions";

/** Two-step destructive confirm (Section 9) — no native confirm() dialog. */
export function CancelJobControl({ jobId }: { jobId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setConfirming(true)}>
        Cancel Job
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <form action={cancelJobAction.bind(null, jobId)}>
        <button className="btn btn-sm btn-danger" type="submit">Confirm Cancel</button>
      </form>
      <button className="btn btn-sm" type="button" onClick={() => setConfirming(false)}>Never Mind</button>
    </div>
  );
}
