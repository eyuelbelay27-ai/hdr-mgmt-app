"use server";

import { revalidatePath } from "next/cache";
import { ItemCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, requirePage, PermissionError } from "@/lib/permissions";
import { toNumber } from "@/lib/money";

export interface ActionState {
  error: string | null;
}

/**
 * Editing a price here updates every job's Cost Estimate display live
 * (Section 8.4) because the Cost Estimate tab always reads the Material's
 * current `rate`, never a frozen snapshot — see CostEstimateTab.
 */
export async function updateMaterialAction(
  materialId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requirePage(user, "calculator");
    requireAction(user, "manageSignagePrices", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "") as ItemCategory;
  const unit = String(formData.get("unit") ?? "").trim();
  const rateRaw = String(formData.get("rate") ?? "").trim();
  const defaultQtyRaw = String(formData.get("defaultQty") ?? "").trim();
  const active = formData.get("active") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { error: "Name is required." };
  if (category !== "cash" && category !== "stock") return { error: "Invalid category." };

  const newRate = rateRaw === "" ? null : toNumber(rateRaw);
  const defaultQty = defaultQtyRaw === "" ? null : toNumber(defaultQtyRaw);

  const existing = await prisma.material.findUnique({ where: { id: materialId } });
  if (!existing) return { error: "Material not found." };

  const priceChanged =
    (existing.rate === null && newRate !== null) ||
    (existing.rate !== null && newRate === null) ||
    (existing.rate !== null && newRate !== null && toNumber(existing.rate) !== newRate);

  await prisma.material.update({
    where: { id: materialId },
    data: {
      name,
      category,
      unit,
      rate: newRate,
      defaultQty,
      active,
      notes,
      ...(priceChanged
        ? {
            priceHistory: {
              create: {
                oldPrice: existing.rate,
                newPrice: newRate,
                changedById: user.id,
              },
            },
          }
        : {}),
    },
  });

  revalidatePath("/calculator");
  return { error: null };
}

export async function createMaterialAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requirePage(user, "calculator");
    requireAction(user, "manageSignagePrices", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "") as ItemCategory;
  const unit = String(formData.get("unit") ?? "").trim();
  const rateRaw = String(formData.get("rate") ?? "").trim();

  if (!name) return { error: "Name is required." };
  if (category !== "cash" && category !== "stock") return { error: "Invalid category." };

  const rate = rateRaw === "" ? null : toNumber(rateRaw);

  await prisma.material.create({
    data: { name, category, unit, rate, active: true },
  });

  revalidatePath("/calculator");
  return { error: null };
}
