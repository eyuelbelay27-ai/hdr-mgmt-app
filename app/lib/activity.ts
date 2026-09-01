import { prisma } from "@/lib/prisma";

/** Appends one entry to a job's audit trail (Section 4.1 `activity[]`). */
export async function logActivity(jobId: string, text: string): Promise<void> {
  await prisma.activityEntry.create({ data: { jobId, text } });
}
