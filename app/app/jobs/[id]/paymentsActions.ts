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
