"use client";

import type { SaveStatus } from "./useAutosave";

const LABELS: Record<Exclude<SaveStatus, "idle">, string> = {
  pending: "Editing…",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't save",
};

/** Small inline status text replacing manual "Save" buttons now that edits autosave. */
export function SaveStatusBadge({ status, error }: { status: SaveStatus; error?: string | null }) {
  if (status === "idle") return null;
  return (
    <span
      className="label"
      style={{ textTransform: "none", fontWeight: 500, color: status === "error" ? "var(--danger)" : "var(--text-dim)" }}
    >
      {status === "error" && error ? error : LABELS[status]}
    </span>
  );
}
