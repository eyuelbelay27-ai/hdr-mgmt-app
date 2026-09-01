"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export interface ActionState {
  error: string | null;
}

export async function markReconciledAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "reconcileBudget", "edit");
  await prisma.job.update({
    where: { id: jobId },
    data: { reconciliationStatus: "Reconciled", reconciledBy: user.name, reconciledAt: new Date(), reconciliationNote: null },
  });
  await logActivity(jobId, `${user.name} marked the job Reconciled.`);
  revalidatePath(`/reconciliation/${jobId}`);
}

export async function flagForReviewAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "reconcileBudget", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "A reason is required to flag this job for review." };

  await prisma.job.update({
    where: { id: jobId },
    data: { reconciliationStatus: "Flagged", reconciliationNote: note, reconciledBy: user.name, reconciledAt: new Date() },
  });
  await logActivity(jobId, `${user.name} flagged reconciliation for review: ${note}`);
  revalidatePath(`/reconciliation/${jobId}`);
  return { error: null };
}

export async function revertToPendingAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "reconcileBudget", "edit");
  await prisma.job.update({
    where: { id: jobId },
    data: { reconciliationStatus: "Pending", reconciliationNote: null, reconciledBy: null, reconciledAt: null },
  });
  await logActivity(jobId, `${user.name} reverted reconciliation to Pending.`);
  revalidatePath(`/reconciliation/${jobId}`);
}

export async function toggleChecklistAction(
  jobId: string,
  field: "checklistWithholdingCollected" | "checklistReceiptAttached",
  value: boolean
): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "reconcileBudget", "edit");
  await prisma.job.update({ where: { id: jobId }, data: { [field]: value } });
  revalidatePath(`/reconciliation/${jobId}`);
}

/** Close Job — only once Reconciled, and only after both checklist items are checked (Section 6). */
export async function closeJobAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "closeJob", "edit");

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (job.reconciliationStatus !== "Reconciled") {
    throw new PermissionError("The job must be Reconciled before it can be closed.");
  }
  if (!job.checklistWithholdingCollected || !job.checklistReceiptAttached) {
    throw new PermissionError("Both Final Checklist items must be checked before closing.");
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "Closed",
      monitoringClosed: true,
      monitoringClosedAt: new Date(),
      monitoringClosedBy: user.name,
    },
  });
  await logActivity(jobId, `${user.name} closed the job.`);
  revalidatePath(`/reconciliation/${jobId}`);
  revalidatePath(`/jobs/${jobId}`);
}

/** Reopen — back to Waiting for Reconciliation (Section 6). */
export async function reopenJobAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "reopenJob", "edit");

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "WaitingForReconciliation", monitoringClosed: false, monitoringClosedAt: null, monitoringClosedBy: null },
  });
  await logActivity(jobId, `${user.name} reopened the job.`);
  revalidatePath(`/reconciliation/${jobId}`);
  revalidatePath(`/jobs/${jobId}`);
}
