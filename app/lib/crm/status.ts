import type { CrmLeadStatus } from "@prisma/client";

/**
 * The lead pipeline, in board order. A lead arrives Unseen; the rep
 * acknowledges it (Seen) and then lands it on exactly one outcome —
 * Unreachable, Closed or Failed.
 */
export const CRM_STATUSES = ["Unseen", "Seen", "Unreachable", "Closed", "Failed"] as const;

export const CRM_STATUS_LABEL: Record<CrmLeadStatus, string> = {
  Unseen: "Unseen",
  Seen: "Seen",
  Unreachable: "Unreachable",
  Closed: "Closed",
  Failed: "Failed",
};

/** Colour per column/badge, all drawn from the theme tokens rather than
 * raw hex so the CRM tracks the rest of the app's palette. */
export const CRM_STATUS_TONE: Record<CrmLeadStatus, { bg: string; fg: string }> = {
  Unseen: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  Seen: { bg: "var(--info-soft)", fg: "var(--info)" },
  Unreachable: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  Closed: { bg: "var(--success-soft)", fg: "var(--success)" },
  Failed: { bg: "var(--danger-soft)", fg: "var(--danger)" },
};

/** Closing a lead needs a sale figure; failing one needs a reason. Both are
 * enforced server-side in actions.ts — this is what the UI keys off. */
export function requiresSaleFigures(status: CrmLeadStatus): boolean {
  return status === "Closed";
}

export function requiresFailureNote(status: CrmLeadStatus): boolean {
  return status === "Failed";
}

export function isCrmLeadStatus(value: unknown): value is CrmLeadStatus {
  return typeof value === "string" && (CRM_STATUSES as readonly string[]).includes(value);
}
