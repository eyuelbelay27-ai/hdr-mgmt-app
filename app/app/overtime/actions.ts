"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, requirePage, PermissionError } from "@/lib/permissions";
import { OVERTIME_PAGE_SIZE, toRequestData } from "./listData";

export interface OvertimeRequestData {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  employeeNames: string[];
  status: "Pending" | "Approved" | "Rejected";
  submittedById: string;
  submittedByName: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  rejectionNote: string | null;
}

export interface ActionState {
  error: string | null;
  request?: OvertimeRequestData;
}

/**
 * Overtime Control — a fully standalone module (Section: user request).
 * Nothing here reads from or writes to Job/Budget/Expense/Inventory/
 * PurchaseOrder/Material; the only shared piece is the existing User/auth
 * system, used purely to know who's submitting or deciding.
 */

/** Fetches one page of requests, `skip` rows in, most-recently-submitted
 * first. Returns one extra row beyond OVERTIME_PAGE_SIZE (trimmed off) so
 * the caller knows whether a further page exists. */
export async function loadMoreOvertimeRequestsAction(
  skip: number
): Promise<{ requests: OvertimeRequestData[]; hasMore: boolean }> {
  const user = await requireCurrentUser();
  requirePage(user, "overtime");

  const rows = await prisma.overtimeRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { submittedBy: { select: { name: true } } },
    skip,
    take: OVERTIME_PAGE_SIZE + 1,
  });
  const hasMore = rows.length > OVERTIME_PAGE_SIZE;
  return { requests: rows.slice(0, OVERTIME_PAGE_SIZE).map(toRequestData), hasMore };
}

function parseEmployeeNames(formData: FormData): string[] {
  return formData
    .getAll("employeeNames")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
}

function parseStartAt(formData: FormData): Date | null {
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  if (!date || !time) return null;
  const startAt = new Date(`${date}T${time}:00`);
  return Number.isNaN(startAt.getTime()) ? null : startAt;
}

export async function submitOvertimeRequestAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requirePage(user, "overtime");
    requireAction(user, "submitOvertimeRequest", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const startAt = parseStartAt(formData);
  const employeeNames = parseEmployeeNames(formData);

  if (!title) return { error: "Work title is required." };
  if (!startAt) return { error: "A start date and time are required." };
  if (employeeNames.length === 0) return { error: "Add at least one employee name." };

  const created = await prisma.overtimeRequest.create({
    data: { title, description, startAt, employeeNames, submittedById: user.id },
  });

  revalidatePath("/overtime");
  return {
    error: null,
    request: {
      id: created.id,
      title: created.title,
      description: created.description,
      startAt: created.startAt,
      employeeNames: created.employeeNames,
      status: created.status,
      submittedById: created.submittedById,
      submittedByName: user.name,
      decidedBy: created.decidedBy,
      decidedAt: created.decidedAt,
      rejectionNote: created.rejectionNote,
    },
  };
}

/** Edit — only the original submitter, and only while still Pending. */
export async function updateOvertimeRequestAction(
  requestId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requirePage(user, "overtime");
    requireAction(user, "submitOvertimeRequest", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const existing = await prisma.overtimeRequest.findUnique({ where: { id: requestId } });
  if (!existing) return { error: "Request not found." };
  if (existing.submittedById !== user.id) return { error: "You can only edit your own requests." };
  if (existing.status !== "Pending") return { error: "This request has already been decided and can't be edited." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const startAt = parseStartAt(formData);
  const employeeNames = parseEmployeeNames(formData);

  if (!title) return { error: "Work title is required." };
  if (!startAt) return { error: "A start date and time are required." };
  if (employeeNames.length === 0) return { error: "Add at least one employee name." };

  await prisma.overtimeRequest.update({
    where: { id: requestId },
    data: { title, description, startAt, employeeNames },
  });

  revalidatePath("/overtime");
  return { error: null };
}

/** Withdraw — only the original submitter, and only while still Pending. Matches how a Pending/Rejected Purchase Order can be deleted outright. */
export async function withdrawOvertimeRequestAction(requestId: string): Promise<void> {
  const user = await requireCurrentUser();
  requirePage(user, "overtime");
  requireAction(user, "submitOvertimeRequest", "edit");

  const existing = await prisma.overtimeRequest.findUnique({ where: { id: requestId } });
  if (!existing) return;
  if (existing.submittedById !== user.id) {
    throw new PermissionError("You can only withdraw your own requests.");
  }
  if (existing.status !== "Pending") {
    throw new PermissionError("This request has already been decided and can't be withdrawn.");
  }

  await prisma.overtimeRequest.delete({ where: { id: requestId } });
  revalidatePath("/overtime");
}

export async function approveOvertimeRequestAction(requestId: string): Promise<void> {
  const user = await requireCurrentUser();
  requirePage(user, "overtime");
  requireAction(user, "approveOvertimeRequest", "edit");

  const existing = await prisma.overtimeRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw new Error("Request not found");
  if (existing.status !== "Pending") throw new PermissionError("Only a Pending request can be approved.");

  await prisma.overtimeRequest.update({
    where: { id: requestId },
    data: { status: "Approved", decidedBy: user.name, decidedAt: new Date(), rejectionNote: null },
  });
  revalidatePath("/overtime");
}

/** Revert an Approved ("registered") request back to Pending — approver-only.
 * Reversible by design: it re-enters the normal approve/reject workflow. */
export async function unapproveOvertimeRequestAction(requestId: string): Promise<void> {
  const user = await requireCurrentUser();
  requirePage(user, "overtime");
  requireAction(user, "approveOvertimeRequest", "edit");

  const existing = await prisma.overtimeRequest.findUnique({ where: { id: requestId } });
  if (!existing) return;
  if (existing.status !== "Approved") throw new PermissionError("Only an Approved request can be unapproved.");

  await prisma.overtimeRequest.update({
    where: { id: requestId },
    data: { status: "Pending", decidedBy: null, decidedAt: null, rejectionNote: null },
  });
  revalidatePath("/overtime");
}

/** Approver can delete a request in any status — the only way a Pending
 * request they don't own, or an already-decided one, can be removed
 * outright (an owner can still only Withdraw their own Pending request). */
export async function deleteOvertimeRequestAction(requestId: string): Promise<void> {
  const user = await requireCurrentUser();
  requirePage(user, "overtime");
  requireAction(user, "approveOvertimeRequest", "edit");

  await prisma.overtimeRequest.deleteMany({ where: { id: requestId } });
  revalidatePath("/overtime");
}

/** Rejecting requires a typed reason (matches rejecting a Purchase Order). */
export async function rejectOvertimeRequestAction(
  requestId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requirePage(user, "overtime");
    requireAction(user, "approveOvertimeRequest", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const existing = await prisma.overtimeRequest.findUnique({ where: { id: requestId } });
  if (!existing) return { error: "Request not found." };
  if (existing.status !== "Pending") return { error: "Only a Pending request can be rejected." };

  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "A rejection reason is required." };

  await prisma.overtimeRequest.update({
    where: { id: requestId },
    data: { status: "Rejected", decidedBy: user.name, decidedAt: new Date(), rejectionNote: note },
  });
  revalidatePath("/overtime");
  return { error: null };
}
