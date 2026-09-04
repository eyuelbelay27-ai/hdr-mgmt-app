"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { toNumber, round2 } from "@/lib/money";
import { computeWithholding } from "@/lib/calc/expenses";
import { getSettings } from "@/lib/settings";
import { getUploadedFile, saveUpload } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "./actions";

/**
 * Keeps Inventory in sync with a Stock Expense row (Section 4.4/7.4/7.5) —
 * the single source of truth for Inventory movements caused by Expenses,
 * called after every create/update of a Stock row so there is exactly one
 * linked InventoryEntry per row, always holding Actual Spent once it's
 * recorded (falling back to the originally registered qty until then).
 * Deleting the Expense row cascade-deletes this entry automatically
 * (schema-level onDelete: Cascade) — Inventory only ever reacts to what's
 * currently registered in Expenses, never to Budget approval.
 */
async function syncStockInventory(expense: {
  id: string;
  jobId: string;
  jobNumber: string;
  category: string | null;
  source: string;
  item: string;
  qty: unknown;
  unit: string | null;
  materialId: string | null;
  actualSpent: unknown;
}): Promise<void> {
  if (expense.category !== "stock") {
    await prisma.inventoryEntry.deleteMany({ where: { expenseId: expense.id } });
    return;
  }

  const committedQty = toNumber(expense.qty);
  const hasActual = expense.actualSpent !== null && expense.actualSpent !== undefined;
  const qty = round2(hasActual ? toNumber(expense.actualSpent) : committedQty);

  if (qty <= 0) {
    await prisma.inventoryEntry.deleteMany({ where: { expenseId: expense.id } });
    return;
  }

  await prisma.inventoryEntry.upsert({
    where: { expenseId: expense.id },
    create: {
      date: new Date(),
      direction: "out",
      materialId: expense.materialId,
      itemName: expense.item,
      qty,
      unit: expense.unit,
      source: `${expense.source === "Manual" ? "Manual purchase" : "Budget pull"} — ${expense.jobNumber}`,
      jobId: expense.jobId,
      expenseId: expense.id,
    },
    update: { qty, itemName: expense.item, unit: expense.unit, materialId: expense.materialId },
  });
}

/**
 * "Pull From Budget" (Section 8.3) — pulls both Cash and Stock lines,
 * idempotent via the unique budgetItemId link: re-running only refreshes
 * previously-generated Purchase rows, never manually-added ones. Stock
 * lines drive Inventory here (and only here, or via a Manual add) —
 * Budget approval itself no longer touches Inventory.
 */
export async function pullExpensesFromBudgetAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "manageExpenses", "edit");

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { budgetItems: { include: { material: true } } },
  });
  if (!job) throw new Error("Job not found");

  for (const line of job.budgetItems) {
    const isStock = line.category === "stock";
    const unitPrice = isStock ? toNumber(line.material?.rate) : null;
    const qty = isStock ? toNumber(line.qty) : null;
    const totalPrice = isStock ? round2((qty ?? 0) * (unitPrice ?? 0)) : toNumber(line.amount);

    const expense = await prisma.expense.upsert({
      where: { budgetItemId: line.id },
      create: {
        jobId,
        entryType: "purchase",
        category: line.category,
        source: "Budget",
        date: new Date(),
        item: line.label,
        qty,
        unit: line.unit,
        unitPrice,
        totalPrice,
        budgetRef: line.label,
        budgetItemId: line.id,
        materialId: line.materialId,
      },
      update: {
        item: line.label,
        category: line.category,
        qty,
        unit: line.unit,
        unitPrice,
        totalPrice,
        budgetRef: line.label,
        materialId: line.materialId,
      },
    });

    await syncStockInventory({ ...expense, jobNumber: job.jobNumber });
  }

  await logActivity(jobId, `${user.name} pulled expenses from the Budget.`);
  revalidatePath(`/jobs/${jobId}`);
}

export async function addExpenseAction(
  jobId: string,
  entryType: "purchase" | "receipt",
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "manageExpenses", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const item = String(formData.get("item") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const purchaser = String(formData.get("purchaser") ?? "").trim() || null;
  const dateRaw = String(formData.get("date") ?? "");
  const date = dateRaw ? new Date(dateRaw) : new Date();
  if (!item) return { error: "Item is required." };

  const category = entryType === "purchase" ? (String(formData.get("category") ?? "cash") as "cash" | "stock") : null;

  let qty: number | null = null;
  let unit: string | null = null;
  let unitPrice: number | null = null;
  let totalPrice: number;

  if (category === "stock") {
    qty = toNumber(formData.get("qty"));
    unit = String(formData.get("unit") ?? "").trim();
    unitPrice = toNumber(formData.get("unitPrice"));
    if (qty <= 0) return { error: "Quantity must be greater than zero." };
    totalPrice = round2(qty * unitPrice);
  } else {
    totalPrice = toNumber(formData.get("totalPrice"));
    if (totalPrice <= 0) return { error: "Total price must be greater than zero." };
  }

  const settings = await getSettings();
  const withholding = computeWithholding(totalPrice, settings.withholdingRatePercent, settings.withholdingThreshold);

  // A Purchase never carries its own receipt — receipts are only ever
  // registered in the Receipts tab (Section 7.6).
  let receiptName: string | null = null;
  let receiptUrl: string | null = null;
  let receiptKind: string | null = null;
  if (entryType === "receipt") {
    const receiptFile = getUploadedFile(formData, "receipt");
    if (!receiptFile) return { error: "A receipt is required." };
    const receipt = await saveUpload(receiptFile);
    receiptName = receipt.name;
    receiptUrl = receipt.url;
    receiptKind = receipt.kind;
  }

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobNumber: true } });
  if (!job) return { error: "Job not found." };

  const expense = await prisma.expense.create({
    data: {
      jobId,
      entryType,
      category,
      source: "Manual",
      purchaser,
      date,
      item,
      description,
      qty,
      unit,
      unitPrice,
      totalPrice,
      withholding,
      receiptName,
      receiptUrl,
      receiptKind,
    },
  });

  await syncStockInventory({ ...expense, jobNumber: job.jobNumber });

  await logActivity(jobId, `${user.name} logged a ${entryType} of ${totalPrice} Br ("${item}").`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

/** Stock Actual Spent → automatic Inventory reconciliation (Section 7.5). */
export async function updateActualSpentAction(expenseId: string, jobId: string, formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "manageExpenses", "edit");

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new Error("Expense not found");

  const raw = String(formData.get("actualSpent") ?? "").trim();
  const actualSpent = raw === "" ? null : toNumber(raw);

  await prisma.expense.update({ where: { id: expenseId }, data: { actualSpent } });

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobNumber: true } });
  await syncStockInventory({ ...expense, actualSpent, jobNumber: job?.jobNumber ?? "" });

  await logActivity(jobId, `${user.name} recorded Actual Spent on "${expense.item}".`);
  revalidatePath(`/jobs/${jobId}`);
}

/** Deleting a Stock row cascade-deletes its linked InventoryEntry (schema-level onDelete: Cascade). */
export async function deleteExpenseAction(expenseId: string, jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "manageExpenses", "edit");
  await prisma.expense.delete({ where: { id: expenseId } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleExpenseFlaggedAction(expenseId: string, jobId: string, flagged: boolean): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "manageExpenses", "edit");
  await prisma.expense.update({ where: { id: expenseId }, data: { flagged } });
  revalidatePath(`/jobs/${jobId}`);
}
