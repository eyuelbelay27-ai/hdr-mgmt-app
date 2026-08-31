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
