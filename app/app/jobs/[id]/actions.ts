"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { isContentLocked } from "@/lib/job-status";
import { saveUpload, getUploadedFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

export interface ActionState {
  error: string | null;
}

async function loadJobForLockCheck(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true, adminUnlocked: true },
  });
  if (!job) throw new Error("Job not found");
  return job;
}

/** Design tab: job-level fields (Section 8.3). */
export async function updateDesignFieldsAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "editDesign", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const job = await loadJobForLockCheck(jobId);
  if (isContentLocked(job)) return { error: "This job's design is locked." };

  await prisma.job.update({
    where: { id: jobId },
    data: {
      designer: String(formData.get("designer") ?? "").trim() || null,
      supervisor: String(formData.get("supervisor") ?? "").trim() || null,
      productionNotes: String(formData.get("productionNotes") ?? "").trim() || null,
    },
  });
  await logActivity(jobId, `${user.name} updated design details.`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

/** Design tab: add a Sign Description component. */
export async function addComponentAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "editDesign", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const job = await loadJobForLockCheck(jobId);
  if (isContentLocked(job)) return { error: "This job's design is locked." };

  const name = String(formData.get("name") ?? "").trim();
  const width = Number(formData.get("width"));
  const height = Number(formData.get("height"));
  const qty = Number(formData.get("qty"));
  const ledColor = String(formData.get("ledColor") ?? "").trim() || null;
  const artFile = getUploadedFile(formData, "art");

  if (!name) return { error: "Component name is required." };
  if (!Number.isFinite(width) || width <= 0) return { error: "Width must be a positive number." };
  if (!Number.isFinite(height) || height <= 0) return { error: "Height must be a positive number." };
  if (!Number.isInteger(qty) || qty <= 0) return { error: "Quantity must be a positive whole number." };

  const art = artFile ? await saveUpload(artFile) : null;

  await prisma.jobComponent.create({
    data: {
      jobId,
      name,
      width,
      height,
      qty,
      ledColor,
      artName: art?.name,
      artUrl: art?.url,
      artKind: art?.kind,
    },
  });
  await logActivity(jobId, `${user.name} added component "${name}".`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

/** Design tab: update an existing component's fields. */
export async function updateComponentAction(
  componentId: string,
  jobId: string,
  formData: FormData
): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "editDesign", "edit");
  const job = await loadJobForLockCheck(jobId);
  if (isContentLocked(job)) throw new PermissionError("This job's design is locked.");

  const name = String(formData.get("name") ?? "").trim();
  const width = Number(formData.get("width"));
  const height = Number(formData.get("height"));
  const qty = Number(formData.get("qty"));
  const ledColor = String(formData.get("ledColor") ?? "").trim() || null;
  const artFile = getUploadedFile(formData, "art");
  const art = artFile ? await saveUpload(artFile) : null;

  await prisma.jobComponent.update({
    where: { id: componentId },
    data: {
      name,
      width,
      height,
      qty,
      ledColor,
      ...(art ? { artName: art.name, artUrl: art.url, artKind: art.kind } : {}),
    },
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteComponentAction(componentId: string, jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "editDesign", "edit");
  const job = await loadJobForLockCheck(jobId);
  if (isContentLocked(job)) throw new PermissionError("This job's design is locked.");

  await prisma.jobComponent.delete({ where: { id: componentId } });
  revalidatePath(`/jobs/${jobId}`);
}

/** Cut List tab: file-upload only, no structured data (Section 8.3). */
export async function addCutFileAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "editCutList", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const job = await loadJobForLockCheck(jobId);
  if (isContentLocked(job)) return { error: "This job's cut list is locked." };

  const file = getUploadedFile(formData, "file");
  if (!file) return { error: "Choose a file to upload." };

  const saved = await saveUpload(file);
  await prisma.cutFile.create({
    data: {
      jobId,
      name: saved.name,
      url: saved.url,
      kind: saved.kind,
      uploadedBy: user.name,
    },
  });
  await logActivity(jobId, `${user.name} uploaded cut file "${saved.name}".`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

export async function deleteCutFileAction(cutFileId: string, jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "editCutList", "edit");
  const job = await loadJobForLockCheck(jobId);
  if (isContentLocked(job)) throw new PermissionError("This job's cut list is locked.");

  await prisma.cutFile.delete({ where: { id: cutFileId } });
  revalidatePath(`/jobs/${jobId}`);
}

/** Admin's "Unlock for Editing" toggle on an Approved-Budget-or-later job (Section 6). */
export async function toggleAdminUnlockedAction(jobId: string, unlocked: boolean): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "editApprovedJob", "edit");
  await prisma.job.update({ where: { id: jobId }, data: { adminUnlocked: unlocked } });
  await logActivity(jobId, `${user.name} ${unlocked ? "unlocked" : "re-locked"} the job for editing.`);
  revalidatePath(`/jobs/${jobId}`);
}
