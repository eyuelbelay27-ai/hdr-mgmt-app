"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { toNumber, round2 } from "@/lib/money";
import { nextPoNumber } from "@/lib/po-number";

export interface ActionState {
  error: string | null;
}

/** Purchase Order create (Section 8.7) — standalone, job-independent. */
export async function createPurchaseOrderAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "submitPurchaseOrder", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const purchaser = String(formData.get("purchaser") ?? "").trim() || user.name;
  const item = String(formData.get("item") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "cash") as "cash" | "stock";
  const qty = toNumber(formData.get("qty"));
  const price = toNumber(formData.get("price"));
  const dateRaw = String(formData.get("date") ?? "");

  if (!item) return { error: "Item is required." };
  if (qty <= 0) return { error: "Quantity must be greater than zero." };
  if (price < 0) return { error: "Price can't be negative." };

  const poNumber = await nextPoNumber();

  await prisma.purchaseOrder.create({
    data: {
      poNumber,
      date: dateRaw ? new Date(dateRaw) : new Date(),
      purchaser,
      item,
      description,
      category,
      qty,
      price,
      total: round2(qty * price),
      history: { create: { text: `${user.name} submitted ${poNumber} for approval.` } },
    },
  });

  revalidatePath("/");
  return { error: null };
}

export async function approvePurchaseOrderAction(poId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "approvePurchaseOrder", "edit");

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: "Approved",
      approvedBy: user.name,
      approvedAt: new Date(),
      history: { create: { text: `${user.name} approved this purchase order.` } },
    },
  });
  revalidatePath("/");
}

/** Rejecting a Purchase Order requires a typed reason (Section 7.9). */
export async function rejectPurchaseOrderAction(
  poId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "approvePurchaseOrder", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "A rejection reason is required." };

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: "Rejected",
      approvedBy: user.name,
      approvedAt: new Date(),
      note,
      history: { create: { text: `${user.name} rejected this purchase order: ${note}` } },
    },
  });
  revalidatePath("/");
  return { error: null };
}
