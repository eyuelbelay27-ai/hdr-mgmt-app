"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, requirePage, PermissionError } from "@/lib/permissions";
import { toNumber } from "@/lib/money";

export interface ActionState {
  error: string | null;
}

/** Manual Stock In/Out recording (Section 8.5). */
export async function recordManualInventoryAction(
  direction: "in" | "out",
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requirePage(user, "inventory");
    requireAction(user, "manageInventory", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const materialId = String(formData.get("materialId") ?? "").trim() || null;
  const typedName = String(formData.get("itemName") ?? "").trim();
  const qty = toNumber(formData.get("qty"));
  const dateRaw = String(formData.get("date") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (qty <= 0) return { error: "Quantity must be greater than zero." };

  let itemName = typedName;
  let unit: string | null = null;
  if (materialId) {
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material) return { error: "Material not found." };
    itemName = material.name;
    unit = material.unit;
  }
  if (!itemName) return { error: "Pick a material or type an item name." };

  await prisma.inventoryEntry.create({
    data: {
      date: dateRaw ? new Date(dateRaw) : new Date(),
      direction,
      materialId,
      itemName,
      qty,
      unit,
      source: "Manual",
      note,
      createdBy: user.name,
    },
  });

  revalidatePath("/inventory");
  return { error: null };
}

/**
 * Reset Inventory — permanently deletes every entry in the Inventory
 * ledger, system-wide (not scoped to one job). Irreversible by design: a
 * true fresh start, not an offsetting reversal like the rest of the app's
 * undo actions. Approved Purchase Orders and Stock Expense rows keep
 * their own status/history untouched — only their linked Inventory
 * movement disappears along with everything else.
 */
export async function resetInventoryAction(_prevState: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requirePage(user, "inventory");
    requireAction(user, "resetInventory", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  await prisma.inventoryEntry.deleteMany({});
  revalidatePath("/inventory");
  return { error: null };
}
