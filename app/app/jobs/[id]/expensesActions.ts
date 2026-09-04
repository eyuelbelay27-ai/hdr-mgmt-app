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
 * "Pull From Budget" (Section 8.3) — pulls both Cash and Stock lines,
 * idempotent via the unique budgetItemId link: re-running only refreshes
 * previously-generated Purchase rows, never manually-added ones.
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

    await prisma.expense.upsert({
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
      update: { item: line.label, qty, unit: line.unit, unitPrice, totalPrice, budgetRef: line.label, materialId: line.materialId },
    });
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

  const receiptFile = getUploadedFile(formData, "receipt");
  if (!receiptFile) return { error: "A receipt is required." };
  const receipt = await saveUpload(receiptFile);

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobNumber: true } });
  if (!job) return { error: "Job not found." };

  await prisma.expense.create({
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
      receiptName: receipt.name,
      receiptUrl: receipt.url,
      receiptKind: receipt.kind,
    },
  });

  // A Manual Stock purchase deducts Inventory immediately at creation time
  // (Section 4.4 / 7.5) — Budget-pulled Stock rows were already deducted
  // when the budget was approved (Section 6.1).
  if (entryType === "purchase" && category === "stock" && qty) {
    await prisma.inventoryEntry.create({
      data: {
        date,
        direction: "out",
        itemName: item,
        qty,
        unit,
        source: `Manual purchase — ${job.jobNumber}`,
        jobId,
      },
    });
  }

  await logActivity(jobId, `${user.name} logged a ${entryType} of ${totalPrice} Br ("${item}").`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

/**
 * Stock Actual Spent → automatic Inventory reconciliation (Section 7.5).
 * Re-editing Actual Spent replaces the previous correction rather than
 * stacking a new one, via the unique adjustmentForExpenseId link.
 */
export async function updateActualSpentAction(expenseId: string, jobId: string, formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "manageExpenses", "edit");

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new Error("Expense not found");

  const raw = String(formData.get("actualSpent") ?? "").trim();
  const actualSpent = raw === "" ? null : toNumber(raw);

  await prisma.expense.update({ where: { id: expenseId }, data: { actualSpent } });

  if (expense.category === "stock") {
    const committedQty = toNumber(expense.qty);
    const actualQty = actualSpent ?? committedQty;
    const delta = round2(actualQty - committedQty);

    await prisma.inventoryEntry.deleteMany({ where: { adjustmentForExpenseId: expenseId } });

    if (delta !== 0) {
      const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobNumber: true } });
      await prisma.inventoryEntry.create({
        data: {
          date: new Date(),
          direction: delta > 0 ? "out" : "in",
          materialId: expense.materialId,
          itemName: expense.item,
          unit: expense.unit,
          qty: Math.abs(delta),
          source: `Actual spent adjustment — ${job?.jobNumber ?? ""}`,
          jobId,
          adjustmentForExpenseId: expenseId,
        },
      });
    }
  }

  await logActivity(jobId, `${user.name} recorded Actual Spent on "${expense.item}".`);
  revalidatePath(`/jobs/${jobId}`);
}

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
