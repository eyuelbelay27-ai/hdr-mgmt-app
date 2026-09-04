"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { toNumber, round2 } from "@/lib/money";
import { nextPoNumber } from "@/lib/po-number";
import { saveUpload, getUploadedFile } from "@/lib/storage";

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

/**
 * Delete — only ever available for Pending or Rejected orders (Section
 * 8.7 addendum). An Approved order must be reverted first (Undo Approval,
 * which already reverses its linked Inventory entry) before it can be
 * deleted, so this never needs to touch Inventory itself.
 */
export async function deletePurchaseOrderAction(poId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "deletePurchaseOrder", "edit");

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new Error("Purchase order not found");
  if (po.status !== "Pending" && po.status !== "Rejected") {
    throw new PermissionError("Only a Pending or Rejected purchase order can be deleted. Undo its approval first.");
  }

  await prisma.purchaseOrder.delete({ where: { id: poId } });
  revalidatePath("/");
}

/**
 * Approving a Stock-category PO also posts a stock-in to the Inventory
 * Ledger (Section 4.4), linked back via fromPurchaseOrderId so an Undo can
 * find and remove exactly this entry.
 */
export async function approvePurchaseOrderAction(poId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "approvePurchaseOrder", "edit");

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new Error("Purchase order not found");

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: "Approved",
      approvedBy: user.name,
      approvedAt: new Date(),
      history: { create: { text: `${user.name} approved this purchase order.` } },
      ...(po.category === "stock"
        ? {
            inventoryEntry: {
              create: {
                date: new Date(),
                direction: "in",
                itemName: po.item,
                qty: po.qty,
                source: `Purchase Order — ${po.poNumber}`,
              },
            },
          }
        : {}),
    },
  });
  revalidatePath("/");
}

/**
 * Undo Approval — always available regardless of Audited state (Section
 * 8.7 addendum). Reverses the inventory stock-in the approval posted (if
 * any) so stock counts don't drift, and clears the Audited flag since it
 * only makes sense for an Approved order.
 */
export async function revertPurchaseOrderApprovalAction(poId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "revertPurchaseOrderApproval", "edit");

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new Error("Purchase order not found");
  if (po.status !== "Approved") throw new PermissionError("Only an approved purchase order can be undone.");

  await prisma.inventoryEntry.deleteMany({ where: { fromPurchaseOrderId: poId } });
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: "Pending",
      approvedBy: null,
      approvedAt: null,
      audited: false,
      auditedBy: null,
      auditedAt: null,
      history: { create: { text: `${user.name} undid the approval of this purchase order.` } },
    },
  });
  revalidatePath("/");
}

/** Receipt upload is only meaningful once a PO is Approved (proof of an actual purchase). */
export async function uploadPurchaseOrderReceiptAction(
  poId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "uploadPurchaseOrderReceipt", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, select: { status: true, poNumber: true } });
  if (!po) return { error: "Purchase order not found." };
  if (po.status !== "Approved") return { error: "Only an approved purchase order can have a receipt attached." };

  const file = getUploadedFile(formData, "receipt");
  if (!file) return { error: "A receipt file is required." };
  const receipt = await saveUpload(file);

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      receiptName: receipt.name,
      receiptUrl: receipt.url,
      receiptKind: receipt.kind,
      history: { create: { text: `${user.name} uploaded a receipt for this purchase order.` } },
    },
  });
  revalidatePath("/");
  return { error: null };
}

/** Audited requires a receipt on file to review first (Section 8.7 addendum). */
export async function markPurchaseOrderAuditedAction(poId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "auditPurchaseOrder", "edit");

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) throw new Error("Purchase order not found");
  if (po.status !== "Approved") throw new PermissionError("Only an approved purchase order can be audited.");

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      audited: true,
      auditedBy: user.name,
      auditedAt: new Date(),
      history: { create: { text: `${user.name} marked this purchase order audited.` } },
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
