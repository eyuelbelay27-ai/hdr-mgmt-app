"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { saveUpload, getUploadedFile, deleteUpload } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "./actions";

/**
 * Budget Paid indicator — a user request, not part of the original brief.
 * A manager's own record of whether cheques have actually gone out for a
 * job's approved budget, so nothing gets forgotten. Deliberately isolated:
 * nothing here is read by, or feeds into, any cost/budget/profit
 * calculation, and no other action reads or writes these fields. Reuses
 * the existing `approveBudget` permission — whoever can approve a budget
 * can also say whether it's been paid.
 */

async function assertBudgetApproved(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { budgetStatus: true },
  });
  if (!job) throw new Error("Job not found");
  if (job.budgetStatus !== "Approved") {
    throw new PermissionError("Only a job with an approved budget can be marked paid.");
  }
  return job;
}

/**
 * Toggles Paid/Unpaid. The confirm step lives in the client control (two
 * clicks, like Cancel Job) — by the time this runs the manager has already
 * confirmed, so it just flips the flag and logs it.
 *
 * Un-marking never touches the cheque photo/description — they're kept in
 * case the flip was a mistake, and simply stop being shown while Unpaid.
 */
export async function setBudgetPaidAction(jobId: string, paid: boolean): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "approveBudget", "edit");
  await assertBudgetApproved(jobId);

  await prisma.job.update({
    where: { id: jobId },
    data: paid
      ? { budgetPaid: true, budgetPaidAt: new Date(), budgetPaidBy: user.name }
      : { budgetPaid: false, budgetPaidAt: null, budgetPaidBy: null },
  });

  await logActivity(jobId, `${user.name} marked the budget as ${paid ? "Paid" : "Unpaid"}.`);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

/**
 * Attaches or replaces the cheque photo and/or edits the description, any
 * time the job is currently marked Paid. Either field is optional and
 * independent — leaving the file blank keeps the existing photo, and the
 * description is simply set to whatever was typed (blank clears it).
 */
export async function upsertChequeAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "approveBudget", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { budgetPaid: true, chequeImageUrl: true },
  });
  if (!job) return { error: "Job not found." };
  if (!job.budgetPaid) return { error: "Mark the budget Paid before attaching a cheque photo." };

  const file = getUploadedFile(formData, "chequeImage");
  const description = String(formData.get("chequeDescription") ?? "").trim() || null;

  if (!file && description === null) {
    return { error: "Add a photo, a description, or both." };
  }

  let imageFields: { chequeImageName: string; chequeImageUrl: string; chequeImageKind: string } | undefined;
  if (file) {
    const uploaded = await saveUpload(file);
    imageFields = { chequeImageName: uploaded.name, chequeImageUrl: uploaded.url, chequeImageKind: uploaded.kind };
    // Replacing a photo — drop the old object so it doesn't sit orphaned
    // in storage forever.
    if (job.chequeImageUrl) await deleteUpload(job.chequeImageUrl);
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { ...imageFields, chequeDescription: description },
  });

  const what = file && description !== null ? "cheque photo and description" : file ? "cheque photo" : "cheque description";
  await logActivity(jobId, `${user.name} updated the ${what}.`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

/** Removes just the photo — the description, if any, is left as-is. */
export async function deleteChequeImageAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "approveBudget", "edit");

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { chequeImageUrl: true } });
  if (!job?.chequeImageUrl) return;

  await deleteUpload(job.chequeImageUrl);
  await prisma.job.update({
    where: { id: jobId },
    data: { chequeImageName: null, chequeImageUrl: null, chequeImageKind: null },
  });

  await logActivity(jobId, `${user.name} deleted the cheque photo.`);
  revalidatePath(`/jobs/${jobId}`);
}
