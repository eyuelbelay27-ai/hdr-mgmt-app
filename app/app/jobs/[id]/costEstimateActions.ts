"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { isContentLocked } from "@/lib/job-status";
import { round2, toNumber } from "@/lib/money";
import { logActivity } from "@/lib/activity";
import { getUploadedFile, saveUpload } from "@/lib/storage";
import type { ActionState } from "./actions";

async function assertEditable(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true, adminUnlocked: true },
  });
  if (!job) throw new Error("Job not found");
  if (isContentLocked(job)) throw new PermissionError("This job's Cost Estimate is locked.");
}

/**
 * Batch-saves every quantity typed into one category's fill-in sheet
 * (Section 8.3): a qty > 0 upserts a Price-Database-sourced
 * CostEstimateItem for that material; a blank/zero qty removes it. Each
 * field is named `qty_<materialId>`.
 */
export async function saveCostEstimateQuantitiesAction(
  jobId: string,
  category: "cash" | "stock",
  formData: FormData
): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "manageCostEstimate", "edit");
  await assertEditable(jobId);

  const materials = await prisma.material.findMany({ where: { active: true, category } });

  for (const material of materials) {
    const raw = formData.get(`qty_${material.id}`);
    const qty = raw === null ? 0 : toNumber(raw);

    if (qty > 0) {
      const rate = toNumber(material.rate);
      const total = round2(qty * rate);
      await prisma.costEstimateItem.upsert({
        where: { jobId_materialId: { jobId, materialId: material.id } },
        create: {
          jobId,
          materialId: material.id,
          name: material.name,
          category: material.category,
          unit: material.unit,
          qty,
          unitPrice: rate,
          total,
          source: "PriceDatabase",
        },
        update: { qty, unitPrice: rate, total },
      });
    } else {
      await prisma.costEstimateItem.deleteMany({ where: { jobId, materialId: material.id } });
    }
  }

  await logActivity(jobId, `${user.name} updated Cost Estimate ${category} quantities.`);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addCostEstimateItemAction(
  jobId: string,
  category: "cash" | "stock",
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "addCostEstimateItem", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  try {
    await assertEditable(jobId);
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const qty = toNumber(formData.get("qty"));
  const unitPrice = toNumber(formData.get("unitPrice"));
  const comment = String(formData.get("comment") ?? "").trim() || null;

  if (!name) return { error: "Item name is required." };
  if (qty <= 0) return { error: "Quantity must be greater than zero." };
  if (unitPrice < 0) return { error: "Unit price can't be negative." };

  await prisma.costEstimateItem.create({
    data: {
      jobId,
      name,
      unit,
      qty,
      unitPrice,
      total: round2(qty * unitPrice),
      category,
      source: "Manual",
      comment,
    },
  });
  await logActivity(jobId, `${user.name} added ad-hoc Cost Estimate item "${name}".`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

export async function deleteCostEstimateItemAction(itemId: string, jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "addCostEstimateItem", "edit");
  await assertEditable(jobId);
  await prisma.costEstimateItem.delete({ where: { id: itemId } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateSoldPriceAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "manageSalePriceProfit", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const soldPrice = toNumber(formData.get("soldPrice"));
  const commissionActive = formData.get("commissionActive") === "on";
  if (soldPrice < 0) return { error: "Sold price can't be negative." };

  await prisma.job.update({
    where: { id: jobId },
    data: { costEstimateSoldPrice: soldPrice, costEstimateCommissionActive: commissionActive },
  });
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

export async function updateCostEstimateNotesAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "manageCostEstimateNotes", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const priceListFile = getUploadedFile(formData, "priceListFile");
  const priceList = priceListFile ? await saveUpload(priceListFile) : null;

  await prisma.job.update({
    where: { id: jobId },
    data: {
      costEstimateNotes: String(formData.get("notes") ?? "").trim() || null,
      ...(priceList
        ? {
            costEstimatePriceListName: priceList.name,
            costEstimatePriceListUrl: priceList.url,
            costEstimatePriceListKind: priceList.kind,
          }
        : {}),
    },
  });
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}
