import { JobStatus } from "@prisma/client";

/** Display labels matching the prototype's STATUSES strings (Section 6). */
export const STATUS_LABEL: Record<JobStatus, string> = {
  Draft: "Draft",
  WaitingForApproval: "Waiting for Approval",
  ApprovedBudget: "Approved Budget",
  WaitingForReconciliation: "Waiting for Reconciliation",
  Closed: "Closed",
  Cancelled: "Cancelled",
};

/** bg/fg pair per status, ported from the prototype's STATUS_COLOR map. */
export const STATUS_COLOR: Record<JobStatus, { bg: string; fg: string }> = {
  Draft: { bg: "var(--surface-3)", fg: "var(--text-dim)" },
  WaitingForApproval: { bg: "var(--info-soft)", fg: "#8FBEE8" },
  ApprovedBudget: { bg: "var(--accent-soft)", fg: "var(--accent-text)" },
  WaitingForReconciliation: { bg: "var(--warn-soft)", fg: "#F0C878" },
  Closed: { bg: "var(--success-soft)", fg: "#8FD1A8" },
  Cancelled: { bg: "var(--danger-soft)", fg: "#F0A99F" },
};

/**
 * Design/Cut List/Cost Estimate/Budget all lock together once a job leaves
 * Draft (Section 6) — Budget itself is filled in by the Admin during
 * Waiting for Approval, which is why BudgetItem editing uses its own rule
 * (see lib/permissions usage in the Budget tab) rather than this one.
 */
export function isContentLocked(job: { status: JobStatus; adminUnlocked: boolean }): boolean {
  return job.status !== "Draft" && !job.adminUnlocked;
}

const OPEN_STATUSES: JobStatus[] = [
  "Draft",
  "WaitingForApproval",
  "ApprovedBudget",
  "WaitingForReconciliation",
];

/** amber if upcoming, red if past-due and the job isn't Closed/Cancelled (Section 6.1). */
export function deadlineBadgeTone(
  deadline: Date,
  status: JobStatus
): "amber" | "red" | null {
  if (!OPEN_STATUSES.includes(status)) return null;
  return deadline.getTime() < Date.now() ? "red" : "amber";
}
