"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { ethLong, requestedDeadlineError } from "@/lib/ethiopian";
import type { ActionState } from "./actions";

/** Sales rep + requested deadline — editable while the job is still a Draft. */
export async function updateJobPlanAction(jobId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "manageDraftJobs", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true, salesRep: true, requestedDeadline: true } });
  if (!job) return { error: "Job not found." };
  if (job.status !== "Draft") return { error: "The sales rep and deadline can only be changed while the job is a Draft." };

  const salesRep = String(formData.get("salesRep") ?? "").trim();
  const requested = String(formData.get("requestedDeadline") ?? "").trim();
  if (!salesRep) return { error: "The sales rep's name is required." };
  const bad = requestedDeadlineError(requested);
  if (bad) return { error: bad };

  const changes: string[] = [];
  if ((job.salesRep ?? "") !== salesRep) changes.push(`sales rep to ${salesRep}`);
  if (job.requestedDeadline?.toISOString().slice(0, 10) !== requested) changes.push(`requested deadline to ${ethLong(requested)}`);
  if (!changes.length) return { error: null };

  await prisma.job.update({ where: { id: jobId }, data: { salesRep, requestedDeadline: new Date(requested) } });
  await logActivity(jobId, `${user.name} changed the ${changes.join(" and the ")}.`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}
