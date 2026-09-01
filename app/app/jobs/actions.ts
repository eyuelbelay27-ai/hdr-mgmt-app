"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, requirePage, PermissionError } from "@/lib/permissions";
import { nextJobNumber } from "@/lib/job-number";
import { saveUpload, getUploadedFile } from "@/lib/storage";

export interface CreateJobState {
  error: string | null;
}

/**
 * Create Job (Section 7.8 / 8.2). Enforced server-side, not just hidden in
 * the UI (Section 2 / 10): a request from a user without `createJob` is
 * rejected here regardless of what the client sent. Both the Advance
 * Payment amount AND a picture of the payment are mandatory before the job
 * can be created — the picture is stored via lib/storage.ts and attached
 * as the Advance payment's receipt.
 */
export async function createJobAction(
  _prevState: CreateJobState,
  formData: FormData
): Promise<CreateJobState> {
  const user = await requireCurrentUser();

  try {
    requirePage(user, "jobs");
    requireAction(user, "createJob", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const clientName = String(formData.get("clientName") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const advanceAmountRaw = String(formData.get("advanceAmount") ?? "").trim();
  const advanceAmount = Number(advanceAmountRaw);
  const proofFile = getUploadedFile(formData, "advanceProof");

  if (!clientName) return { error: "Client name is required." };
  if (!title) return { error: "Job title is required." };
  if (!advanceAmountRaw || !Number.isFinite(advanceAmount) || advanceAmount <= 0) {
    return { error: "Advance payment amount is required and must be greater than zero." };
  }
  if (!proofFile) {
    return { error: "A picture of the advance payment (receipt or transfer screenshot) is required." };
  }

  const proof = await saveUpload(proofFile);
  const jobNumber = await nextJobNumber();

  await prisma.job.create({
    data: {
      jobNumber,
      clientName,
      title,
      payments: {
        create: {
          amount: advanceAmount,
          type: "Advance",
          date: new Date(),
          receiptName: proof.name,
          receiptUrl: proof.url,
          receiptKind: proof.kind,
        },
      },
      activity: {
        create: {
          text: `Job ${jobNumber} created by ${user.name} with an advance payment of ${advanceAmount} ETB.`,
        },
      },
    },
  });

  revalidatePath("/jobs");
  return { error: null };
}
