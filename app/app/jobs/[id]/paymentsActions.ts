"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { toNumber } from "@/lib/money";
import { getUploadedFile, saveUpload } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "./actions";

/**
 * Record Payment (Section 7.7-7.8). "Advance" is deliberately not a
 * selectable option here — it's auto-created exactly once, at job
 * creation. A genuine second advance/partial payment gets logged as
 * "Other" instead, per the brief.
 */
export async function recordPaymentAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "managePayments", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) return { error: "Job not found." };
  if (job.status === "Closed") {
    return { error: "This job is Closed. Revert to Reconciliation (then Flag for Review) to record more payments." };
  }

  const type = String(formData.get("type") ?? "");
  if (type !== "Final" && type !== "Other") return { error: "Invalid payment type." };

  const amount = toNumber(formData.get("amount"));
  if (amount <= 0) return { error: "Amount must be greater than zero." };

  const method = String(formData.get("method") ?? "").trim() || null;
  const dateRaw = String(formData.get("date") ?? "");
  const date = dateRaw ? new Date(dateRaw) : new Date();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const receiptFile = getUploadedFile(formData, "receipt");
  if (!receiptFile) return { error: "A receipt is required." };
  const receipt = await saveUpload(receiptFile);

  await prisma.payment.create({
    data: {
      jobId,
      amount,
      type,
      method,
      date,
      notes,
      receiptName: receipt.name,
      receiptUrl: receipt.url,
      receiptKind: receipt.kind,
    },
  });

  await logActivity(jobId, `${user.name} recorded a ${type} payment of ${amount} Br.`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

/**
 * Edit/delete a recorded payment — gated by its own permission
 * ("editDeletePayments"), separate from managePayments (recording new
 * payments), so an Admin can grant one without the other. Still respects
 * the Closed-job lock: a Closed job's payments can't change until it's
 * reverted to Reconciliation.
 */
export async function updatePaymentAction(paymentId: string, jobId: string, formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "editDeletePayments", "edit");

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw new Error("Job not found");
  if (job.status === "Closed") {
    throw new PermissionError("This job is Closed. Revert to Reconciliation to edit its payments.");
  }

  const amount = toNumber(formData.get("amount"));
  if (amount <= 0) throw new PermissionError("Amount must be greater than zero.");

  const method = String(formData.get("method") ?? "").trim() || null;
  const dateRaw = String(formData.get("date") ?? "");
  const date = dateRaw ? new Date(dateRaw) : new Date();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await prisma.payment.update({ where: { id: paymentId }, data: { amount, method, date, notes } });
  await logActivity(jobId, `${user.name} edited a payment record.`);
  revalidatePath(`/jobs/${jobId}`);
}

export async function deletePaymentAction(paymentId: string, jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "editDeletePayments", "edit");

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw new Error("Job not found");
  if (job.status === "Closed") {
    throw new PermissionError("This job is Closed. Revert to Reconciliation to delete its payments.");
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;

  await prisma.payment.delete({ where: { id: paymentId } });
  await logActivity(jobId, `${user.name} deleted a ${payment.type} payment of ${toNumber(payment.amount)} Br.`);
  revalidatePath(`/jobs/${jobId}`);
}
