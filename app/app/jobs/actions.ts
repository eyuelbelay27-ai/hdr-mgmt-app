"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, requirePage, PermissionError } from "@/lib/permissions";
import { nextJobNumber } from "@/lib/job-number";

export interface CreateJobState {
  error: string | null;
}

/**
 * Create Job (Section 7.8 / 8.2). Enforced server-side, not just hidden in
 * the UI (Section 2 / 10): a request from a user without `createJob` is
 * rejected here regardless of what the client sent.
 *
 * The prototype requires both an Advance Payment amount AND a picture of
 * the payment before the job can be created. The amount is enforced below;
 * the picture upload is deferred to build-order step 11 (file storage
 * integration isn't wired up yet) — `receiptUrl` stays nullable on the
 * created Advance payment until that lands.
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

  if (!clientName) return { error: "Client name is required." };
  if (!title) return { error: "Job title is required." };
  if (!advanceAmountRaw || !Number.isFinite(advanceAmount) || advanceAmount <= 0) {
    return { error: "Advance payment amount is required and must be greater than zero." };
  }

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
