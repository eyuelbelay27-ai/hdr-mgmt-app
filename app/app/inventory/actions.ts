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

  // A stock item is always chosen from the Price Database, never typed —
  // this is what keeps the same real item from splitting into two
  // inventory cards over a spelling variant.
  const materialId = String(formData.get("materialId") ?? "").trim() || null;
  const qty = toNumber(formData.get("qty"));
  const dateRaw = String(formData.get("date") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (qty <= 0) return { error: "Quantity must be greater than zero." };
  if (!materialId) return { error: "Choose a stock item." };

  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material || material.category !== "stock") return { error: "That stock item couldn't be found." };
  const itemName = material.name;
  const unit = material.unit;

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
 * Delete a single manually-registered entry (Section 8.5 addendum). Only
 * ever allowed for an entry with no Expense or Purchase Order link — one
 * driven by an Expense row or an approved PO reflects a real transaction
 * recorded elsewhere, and must be corrected there instead (its own delete/
 * undo already keeps Inventory in sync); a standalone manual entry has no
 * such source to correct, so it can just be removed directly.
 */
export async function deleteInventoryEntryAction(entryId: string): Promise<void> {
  const user = await requireCurrentUser();
  requirePage(user, "inventory");
  requireAction(user, "manageInventory", "edit");

  const entry = await prisma.inventoryEntry.findUnique({ where: { id: entryId } });
  if (!entry) return;
  if (entry.expenseId || entry.fromPurchaseOrderId) {
    throw new PermissionError("This entry came from an Expense or Purchase Order — correct it there instead.");
  }

  await prisma.inventoryEntry.delete({ where: { id: entryId } });
  revalidatePath("/inventory");
}

/**
 * Reset Inventory — permanently deletes every entry in the Inventory
 * ledger, system-wide (not scoped to one job). Irreversible by design: a
 * true fresh start, not an offsetting reversal like the rest of the app's
 * undo actions. Approved Purchase Orders and Stock Expense rows keep
 * their own status/history untouched — only their linked Inventory
 * movement disappears along with everything else.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useFormState requires this exact (prevState, formData) signature
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
