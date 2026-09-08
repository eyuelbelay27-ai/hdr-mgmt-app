"use server";

import { revalidatePath } from "next/cache";
import { ItemCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, requirePage, PermissionError } from "@/lib/permissions";
import { toNumber } from "@/lib/money";

export interface ActionState {
  error: string | null;
  material?: {
    id: string;
    name: string;
    category: string;
    unit: string;
    rate: number | null;
    defaultQty: number | null;
    active: boolean;
  };
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

  const material = await prisma.material.create({
    data: { name, category, unit, rate, active: true },
  });

  revalidatePath("/calculator");
  return {
    error: null,
    material: {
      id: material.id,
      name: material.name,
      category: material.category,
      unit: material.unit,
      rate: material.rate === null ? null : toNumber(material.rate),
      defaultQty: material.defaultQty === null ? null : toNumber(material.defaultQty),
      active: material.active,
    },
  };
}

/**
 * Delete — always allowed, regardless of whether the material has ever
 * been used (Expenses/Budget/Cost Estimate/Inventory/Purchase Orders all
 * store their own snapshot at the time and only hold an optional link back
 * here, which the database clears to null on delete — see the materialId
 * foreign keys' ON DELETE SET NULL). Past records keep their own correct
 * numbers either way. Re-registering the same real-world item later gets a
 * new id with no history — that's an accepted tradeoff of allowing delete
 * unconditionally, not a bug.
 */
export async function deleteMaterialAction(materialId: string): Promise<void> {
  const user = await requireCurrentUser();
  requirePage(user, "calculator");
  requireAction(user, "manageSignagePrices", "edit");

  const existing = await prisma.material.findUnique({ where: { id: materialId } });
  if (!existing) return;

  await prisma.material.delete({ where: { id: materialId } });
  revalidatePath("/calculator");
}
