"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, PermissionError } from "@/lib/permissions";
import { toNumber } from "@/lib/money";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "./actions";

async function assertBudgetEditable(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { budgetStatus: true, status: true },
  });
  if (!job) throw new Error("Job not found");
  if (job.status === "Closed" || job.status === "Cancelled") {
    throw new PermissionError("This job is closed/cancelled.");
  }
  if (job.budgetStatus !== "Draft") {
    throw new PermissionError("The budget is already approved — unlock or undo approval first.");
  }
}

export async function addBudgetItemAction(
  jobId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "manageBudget", "edit");
    await assertBudgetEditable(jobId);
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const label = String(formData.get("label") ?? "").trim();
  const category = String(formData.get("category") ?? "cash") as "cash" | "stock";
  const comment = String(formData.get("comment") ?? "").trim() || null;

  if (!label) return { error: "Description is required." };

  if (category === "stock") {
    const qty = toNumber(formData.get("qty"));
    const unit = String(formData.get("unit") ?? "").trim();
    if (qty <= 0) return { error: "Quantity must be greater than zero." };
    await prisma.budgetItem.create({
      data: { jobId, label, category, qty, unit, comment, source: "Manual" },
    });
  } else {
    const amount = toNumber(formData.get("amount"));
    if (amount <= 0) return { error: "Amount must be greater than zero." };
    await prisma.budgetItem.create({
      data: { jobId, label, category, amount, comment, source: "Manual" },
    });
  }

  await logActivity(jobId, `${user.name} added budget line "${label}".`);
  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

export async function updateBudgetItemAction(itemId: string, jobId: string, formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "manageBudget", "edit");
  await assertBudgetEditable(jobId);

  const label = String(formData.get("label") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "cash") as "cash" | "stock";

  if (category === "stock") {
    await prisma.budgetItem.update({
      where: { id: itemId },
      data: {
        label,
        comment,
        qty: toNumber(formData.get("qty")),
        unit: String(formData.get("unit") ?? "").trim(),
        amount: null,
      },
    });
  } else {
    await prisma.budgetItem.update({
      where: { id: itemId },
      data: { label, comment, amount: toNumber(formData.get("amount")), qty: null, unit: null },
    });
  }
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteBudgetItemAction(itemId: string, jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "manageBudget", "edit");
  await assertBudgetEditable(jobId);
  await prisma.budgetItem.delete({ where: { id: itemId } });
  revalidatePath(`/jobs/${jobId}`);
}

/**
 * "Pull From Cost Estimate" (Section 7.3) — idempotent and non-destructive:
 * re-running it only refreshes rows it previously generated (matched via
 * the unique costEstimateItemId link), never touching manually-added rows.
 */
export async function pullFromCostEstimateAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "manageBudget", "edit");
  await assertBudgetEditable(jobId);

  const items = await prisma.costEstimateItem.findMany({ where: { jobId } });

  for (const item of items) {
    const qty = toNumber(item.qty);
    const total = toNumber(item.total);
    await prisma.budgetItem.upsert({
      where: { costEstimateItemId: item.id },
      create: {
        jobId,
        label: item.name,
        category: item.category,
        source: "CostEstimate",
        materialId: item.materialId,
        costEstimateItemId: item.id,
        ...(item.category === "cash" ? { amount: total } : { qty, unit: item.unit }),
      },
      update: {
        label: item.name,
        ...(item.category === "cash"
          ? { amount: total, qty: null, unit: null }
          : { qty, unit: item.unit, amount: null }),
      },
    });
  }

  await logActivity(jobId, `${user.name} pulled budget lines from the Cost Estimate.`);
  revalidatePath(`/jobs/${jobId}`);
}

export interface ApproveBudgetState {
  error: string | null;
}

/**
 * Two-step deadline-approval flow (Section 6.1). Both entry points (the
 * header shortcut and the Budget tab button) call this same action so
 * they behave identically. On confirm: job -> Approved Budget, budget ->
 * Approved, deadline set, and every Stock-category budget line with a
 * real quantity is automatically deducted from Inventory.
 */
export async function approveBudgetAction(
  jobId: string,
  _prevState: ApproveBudgetState,
  formData: FormData
): Promise<ApproveBudgetState> {
  const user = await requireCurrentUser();
  try {
    requireAction(user, "approveBudget", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const deadlineRaw = String(formData.get("deadline") ?? "");
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  if (!deadline || Number.isNaN(deadline.getTime())) return { error: "Choose a deadline." };

  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { budgetItems: true } });
  if (!job) return { error: "Job not found." };
  if (job.status !== "WaitingForApproval") {
    return { error: "Only a job Waiting for Approval can have its budget approved." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        status: "ApprovedBudget",
        budgetStatus: "Approved",
        budgetApprovedBy: user.name,
        budgetApprovedAt: new Date(),
        deadline,
      },
    });

    const stockLines = job.budgetItems.filter((b) => b.category === "stock" && b.qty && toNumber(b.qty) > 0);
    for (const line of stockLines) {
      await tx.inventoryEntry.create({
        data: {
          date: new Date(),
          direction: "out",
          materialId: line.materialId,
          itemName: line.label,
          qty: line.qty as unknown as number,
          unit: line.unit,
          source: `Budget approved — ${job.jobNumber}`,
          jobId,
        },
      });
    }

    await tx.activityEntry.create({
      data: { jobId, text: `${user.name} approved the budget with a deadline of ${deadline.toISOString().slice(0, 10)}.` },
    });
  });

  revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}

/**
 * Undo Approval — only available after an Admin unlock (Section 6.1). The
 * automatic Inventory deductions are reversed by adding offsetting Stock
 * In entries, never by deleting the original Stock Out entries, so the
 * ledger always reads as a complete, honest audit trail.
 */
export async function undoBudgetApprovalAction(jobId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireAction(user, "approveBudget", "edit");

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (!job.adminUnlocked) {
    throw new PermissionError("Undo Approval is only available after an Admin unlocks the job.");
  }
  if (job.budgetStatus !== "Approved") {
    throw new PermissionError("This budget isn't approved.");
  }

  const deductions = await prisma.inventoryEntry.findMany({
    where: { jobId, source: `Budget approved — ${job.jobNumber}`, direction: "out" },
  });

  await prisma.$transaction(async (tx) => {
    for (const d of deductions) {
      await tx.inventoryEntry.create({
        data: {
          date: new Date(),
          direction: "in",
          materialId: d.materialId,
          itemName: d.itemName,
          qty: d.qty as unknown as number,
          unit: d.unit,
          source: `Budget approval undone — ${job.jobNumber}`,
          jobId,
        },
      });
    }

    await tx.job.update({
      where: { id: jobId },
      data: {
        status: "WaitingForApproval",
        budgetStatus: "Draft",
        budgetApprovedBy: null,
        budgetApprovedAt: null,
        deadline: null,
      },
    });

    await tx.activityEntry.create({
      data: { jobId, text: `${user.name} undid the budget approval; ${deductions.length} inventory deduction(s) reversed.` },
    });
  });

  revalidatePath(`/jobs/${jobId}`);
}
