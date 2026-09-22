import type { CrmLeadStatus } from "@prisma/client";

/**
 * The lead pipeline, set only by the assigned rep — never the Admin. A
 * lead arrives Unseen; from there the rep lands it on Ongoing (actively
 * being worked), Unreachable, or one of the two outcomes, Closed or
 * Failed. Seeing the phone number is a one-time reveal, not a pipeline
 * state — see lib/crm/week.ts's `formatSeenAt` and the `seenAt` field.
 */
export const CRM_STATUSES = ["Unseen", "Ongoing", "Unreachable", "Closed", "Failed"] as const;

/** The four real outcomes a rep can actually pick — Unseen is a starting
 * point, never a destination. */
export const CRM_DESTINATIONS = ["Ongoing", "Unreachable", "Closed", "Failed"] as const;

export const CRM_STATUS_LABEL: Record<CrmLeadStatus, string> = {
  Unseen: "Unseen",
  Ongoing: "Ongoing",
  Unreachable: "Unreachable",
  Closed: "Closed",
  Failed: "Failed",
};

/** Colour per badge, all drawn from the theme tokens rather than raw hex
 * so the CRM tracks the rest of the app's palette. */
export const CRM_STATUS_TONE: Record<CrmLeadStatus, { bg: string; fg: string }> = {
  Unseen: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  Ongoing: { bg: "var(--info-soft)", fg: "var(--info)" },
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

/** Once a lead is Closed or Failed there's nothing left to confirm — the
 * twice-weekly check only ever flags leads still open. */
export function isOpenStatus(status: CrmLeadStatus): boolean {
  return status !== "Closed" && status !== "Failed";
}
