"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { deleteUpload } from "@/lib/storage";
import type { ActionState } from "./actions";

/** Draft → Waiting for Approval (Section 6). Clears any prior revision note. */
export async function submitForApprovalAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "submitForApproval", "edit");

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job || job.status !== "Draft") throw new PermissionError("Only a Draft job can be submitted for approval.");

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "WaitingForApproval", revisionNote: null, revisionNoteBy: null },
  });
  await logActivity(jobId, `${user.name} submitted the job for approval.`);
  revalidatePath(`/jobs/${jobId}`);
}

/**
 * Request Revision — sends a submitted job back to Draft (Section 6).
 * requestRevision is an implied permission reusing approveBudget, since
 * the person reviewing a submission is the one positioned to reject it.
 */
export async function requestRevisionAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "requestRevision", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job || job.status !== "WaitingForApproval") {
    return { error: "Only a job Waiting for Approval can be sent back for revision." };
  }

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "A reason is required." };

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "Draft", revisionNote: note, revisionNoteBy: user.name },
  });
  await logActivity(jobId, `${user.name} requested revision: ${note}`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

/**
 * Submit for Reconciliation — blocked until at least one expense has been
 * logged (Section 6, checked here too since the UI-disabled button alone
 * isn't enforcement).
 */
export async function submitForReconciliationAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "submitForReconciliation", "edit");

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { expenses: { select: { id: true }, take: 1 } },
  });
  if (!job || job.status !== "ApprovedBudget") {
    throw new PermissionError("Only an Approved Budget job can be submitted for reconciliation.");
  }
  if (job.expenses.length === 0) {
    throw new PermissionError("Log at least one expense before submitting for reconciliation.");
  }

  await prisma.job.update({ where: { id: jobId }, data: { status: "WaitingForReconciliation" } });
  await logActivity(jobId, `${user.name} submitted the job for reconciliation.`);
  revalidatePath(`/jobs/${jobId}`);
}

const TERMINAL_STATUSES = ["Closed", "Cancelled"];

/** Cancel Job — from any non-terminal status, restorable back to previousStatus (Section 6). */
export async function cancelJobAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "cancelJob", "edit");

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw new Error("Job not found");
  if (TERMINAL_STATUSES.includes(job.status)) {
    throw new PermissionError("This job is already in a terminal status.");
  }

  await prisma.job.update({ where: { id: jobId }, data: { status: "Cancelled", previousStatus: job.status } });
  await logActivity(jobId, `${user.name} cancelled the job.`);
  revalidatePath(`/jobs/${jobId}`);
}

export async function restoreCancelledJobAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "cancelJob", "edit");

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true, previousStatus: true } });
  if (!job || job.status !== "Cancelled") throw new PermissionError("This job isn't cancelled.");

  await prisma.job.update({
    where: { id: jobId },
    data: { status: job.previousStatus ?? "Draft", previousStatus: null },
  });
  await logActivity(jobId, `${user.name} restored the job from Cancelled.`);
  revalidatePath(`/jobs/${jobId}`);
}

/**
 * Permanently deletes a job and everything under it — every child row
 * (components, cut files, cost estimate items, budget items, expenses,
 * payments, activity log, inventory entries) cascades at the DB level
 * (schema.prisma `onDelete: Cascade`). Available at any job status, gated
 * by the separate `deleteJob` permission so it can be granted to specific
 * users independent of role. The client requires typing the exact job
 * number before submitting, but that's a UX nicety only — this re-checks
 * the match server-side since the client can't be trusted.
 */
export async function deleteJobAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "deleteJob", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      components: { select: { artUrl: true } },
      cutFiles: { select: { url: true } },
      expenses: { select: { receiptUrl: true } },
      payments: { select: { receiptUrl: true } },
    },
  });
  if (!job) throw new Error("Job not found");

  const confirmation = String(formData.get("confirmJobNumber") ?? "").trim();
  if (confirmation !== job.jobNumber) {
    return { error: `Type the exact job number (${job.jobNumber}) to confirm deletion.` };
  }

  const fileUrls = [
    job.costEstimatePriceListUrl,
    ...job.components.map((c) => c.artUrl),
    ...job.cutFiles.map((c) => c.url as string | null),
    ...job.expenses.map((e) => e.receiptUrl),
    ...job.payments.map((p) => p.receiptUrl),
  ];

  await prisma.job.delete({ where: { id: jobId } });
  await Promise.all(fileUrls.map((url) => deleteUpload(url)));

  redirect("/jobs");
}
