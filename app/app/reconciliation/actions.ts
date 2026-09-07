"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { saveUpload, deleteUpload } from "@/lib/storage";

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

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) return { error: "Job not found." };

  // Flagging for review sends the job back a step: out of the reconciliation
  // queue and back to Approved Budget, where Expenses unlock again for the
  // requested revision (Section 6).
  const revertingToApprovedBudget = job.status === "WaitingForReconciliation";

  await prisma.job.update({
    where: { id: jobId },
    data: {
      reconciliationStatus: "Flagged",
      reconciliationNote: note,
      reconciledBy: user.name,
      reconciledAt: new Date(),
      ...(revertingToApprovedBudget ? { status: "ApprovedBudget" } : {}),
    },
  });
  await logActivity(
    jobId,
    `${user.name} flagged reconciliation for review${revertingToApprovedBudget ? " and sent the job back to Approved Budget" : ""}: ${note}`
  );
  revalidatePath(`/reconciliation/${jobId}`);
  revalidatePath("/reconciliation");
  revalidatePath(`/jobs/${jobId}`);
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

export type ChecklistField =
  | "checklistWithholdingCollected"
  | "checklistReceiptAttached"
  | "checklistVatReceiptIssued"
  | "checklistBudgetVarianceSettled";

export async function toggleChecklistAction(jobId: string, field: ChecklistField, value: boolean): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "reconcileBudget", "edit");
  await prisma.job.update({ where: { id: jobId }, data: { [field]: value } });
  revalidatePath(`/reconciliation/${jobId}`);
}

/** Which checklist item an uploaded image is attached to. */
export type ChecklistItemKey = "withholding" | "receipts" | "vat" | "variance";

/**
 * Optional proof pictures per checklist item (Section 6) — never required,
 * multiple images allowed per item. Uploads every non-empty file picked in
 * one submit.
 */
export async function uploadChecklistImagesAction(
  jobId: string,
  itemKey: ChecklistItemKey,
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

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one picture to upload." };

  for (const file of files) {
    const saved = await saveUpload(file);
    await prisma.reconciliationChecklistImage.create({
      data: { jobId, itemKey, name: saved.name, url: saved.url, kind: saved.kind },
    });
  }

  await logActivity(jobId, `${user.name} attached ${files.length} picture(s) to the ${itemKey} checklist item.`);
  revalidatePath(`/reconciliation/${jobId}`);
  return { error: null };
}

export async function deleteChecklistImageAction(imageId: string, jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "reconcileBudget", "edit");
  const image = await prisma.reconciliationChecklistImage.findUnique({ where: { id: imageId } });
  if (!image) return;
  await prisma.reconciliationChecklistImage.delete({ where: { id: imageId } });
  await deleteUpload(image.url);
  revalidatePath(`/reconciliation/${jobId}`);
}

/**
 * Close Job — only once Reconciled, and only after the three required
 * checklist items are checked (Section 6). "Issue VAT Receipt" is
 * deliberately excluded — it doesn't apply to every job, so it's optional
 * and never blocks closing.
 */
export async function closeJobAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "closeJob", "edit");

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (job.reconciliationStatus !== "Reconciled") {
    throw new PermissionError("The job must be Reconciled before it can be closed.");
  }
  if (!job.checklistWithholdingCollected || !job.checklistReceiptAttached || !job.checklistBudgetVarianceSettled) {
    throw new PermissionError("Withholding Collected, Expense Receipts Received, and Receive/Pay Overbudget-Underbudget must all be checked before closing.");
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

/**
 * Reopen — back to Waiting for Reconciliation (Section 6). Resets
 * reconciliationStatus to Pending (clearing the Reconciled marker) so the
 * job must be re-verified — Mark Reconciled again — before it can be
 * re-closed, rather than being instantly closeable again. From here, Flag
 * for Review can send it a further step back to Approved Budget for
 * actual editing.
 */
export async function reopenJobAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "reopenJob", "edit");

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "WaitingForReconciliation",
      reconciliationStatus: "Pending",
      reconciliationNote: null,
      reconciledBy: null,
      reconciledAt: null,
      monitoringClosed: false,
      monitoringClosedAt: null,
      monitoringClosedBy: null,
    },
  });
  await logActivity(jobId, `${user.name} reopened the job — sent back to Waiting for Reconciliation.`);
  revalidatePath(`/reconciliation/${jobId}`);
  revalidatePath("/reconciliation");
  revalidatePath(`/jobs/${jobId}`);
}
