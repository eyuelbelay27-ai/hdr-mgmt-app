"use server";

import { revalidatePath } from "next/cache";
import type { CrmLeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { can, requirePage, PermissionError, type PermissionSubject } from "@/lib/permissions";
import { isCrmLeadStatus } from "@/lib/crm/status";
import { getCrmSettings } from "@/lib/crm/settings";
import { buildReportSnapshot } from "@/lib/crm/report";
import {
  dueReportWeek,
  normalizeReportDay,
  parseDateOnly,
  toDateInputValue,
  weekRangeFilter,
} from "@/lib/crm/week";
import {
  CRM_LEAD_ORDER,
  CRM_PAGE_SIZE,
  buildLeadWhere,
  toLeadData,
  type CrmLeadData,
  type CrmLeadFilters,
} from "./listData";

/**
 * CRM — a standalone module, like Overtime Control. Nothing here reads from
 * or writes to Job/Budget/Expense/Inventory/PurchaseOrder/Material; the only
 * shared piece is the existing User/auth system, used purely to know who a
 * lead belongs to.
 *
 * Two permissions split the module in half:
 *   manageCrmLeads — the Admin side: register and assign every lead, see
 *     every rep's leads and reports, set the report day.
 *   workCrmLeads   — the sales rep side: see only leads assigned to you,
 *     move them through the pipeline, generate your own weekly report.
 */

export interface CrmActionState {
  error: string | null;
  lead?: CrmLeadData;
}

export interface CrmReportActionState {
  error: string | null;
  generated?: boolean;
}

const LEAD_INCLUDE = { assignedTo: { select: { name: true } } } as const;

function canManage(user: PermissionSubject): boolean {
  return can(user, "manageCrmLeads");
}

function canWork(user: PermissionSubject): boolean {
  return can(user, "workCrmLeads");
}

/** Everyone who reaches CRM needs the page plus one of the two roles. */
function requireCrm(user: PermissionSubject): void {
  requirePage(user, "crm");
  if (!canManage(user) && !canWork(user)) {
    throw new PermissionError("You don't have a CRM role.");
  }
}

/** Admins see everything; a rep is pinned to their own leads no matter what
 * the client asks for. */
function forcedRepIdFor(user: PermissionSubject & { id: string }): string | null {
  return canManage(user) ? null : user.id;
}

function trimmed(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Parses a money field. Returns undefined for blank, null for unparseable. */
function parseMoney(value: unknown): number | null | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// -----------------------------------------------------------------------
// Reading
// -----------------------------------------------------------------------

/** One page of leads, `skip` rows in. Returns one row beyond CRM_PAGE_SIZE
 * (trimmed off) so the caller knows whether a further page exists. */
export async function loadMoreCrmLeadsAction(
  skip: number,
  filters: CrmLeadFilters
): Promise<{ leads: CrmLeadData[]; hasMore: boolean }> {
  const user = await requireCurrentUser();
  requireCrm(user);

  const rows = await prisma.crmLead.findMany({
    where: buildLeadWhere(filters ?? {}, forcedRepIdFor(user)),
    orderBy: CRM_LEAD_ORDER,
    include: LEAD_INCLUDE,
    skip,
    take: CRM_PAGE_SIZE + 1,
  });
  const hasMore = rows.length > CRM_PAGE_SIZE;
  return { leads: rows.slice(0, CRM_PAGE_SIZE).map(toLeadData), hasMore };
}

// -----------------------------------------------------------------------
// Admin: registering, editing and deleting leads
// -----------------------------------------------------------------------

function readLeadForm(formData: FormData): { error: string } | {
  phone: string;
  location: string;
  businessType: string;
  source: string | null;
  receivedAt: Date;
  assignedToId: string;
} {
  const phone = trimmed(formData, "phone");
  const location = trimmed(formData, "location");
  const businessType = trimmed(formData, "businessType");
  const source = trimmed(formData, "source") || null;
  const assignedToId = trimmed(formData, "assignedToId");
  const receivedAt = parseDateOnly(trimmed(formData, "receivedAt"));

  if (!phone) return { error: "A phone number is required." };
  if (!location) return { error: "A location is required." };
  if (!businessType) return { error: "A business type is required." };
  if (!receivedAt) return { error: "A valid date received is required." };
  if (!assignedToId) return { error: "Assign the lead to a sales rep." };

  return { phone, location, businessType, source, receivedAt, assignedToId };
}

/** A rep must actually hold workCrmLeads — otherwise a lead could be parked
 * on someone who can never see it. */
async function assertAssignable(userId: string): Promise<string | null> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || !target.active) return "That sales rep no longer exists.";
  if (!can(target, "workCrmLeads")) return "That user isn't a CRM sales rep.";
  return null;
}

export async function createCrmLeadAction(
  _prevState: CrmActionState,
  formData: FormData
): Promise<CrmActionState> {
  const user = await requireCurrentUser();
  try {
    requireCrm(user);
    if (!canManage(user)) throw new PermissionError("Only a CRM admin can register leads.");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const parsed = readLeadForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const assignError = await assertAssignable(parsed.assignedToId);
  if (assignError) return { error: assignError };

  const created = await prisma.crmLead.create({
    data: { ...parsed, createdBy: user.name },
    include: LEAD_INCLUDE,
  });

  revalidatePath("/crm");
  return { error: null, lead: toLeadData(created) };
}

/** Editing a lead's details, including reassigning it, is Admin-only — a rep
 * changes a lead's status, never its facts. */
export async function updateCrmLeadAction(
  leadId: string,
  _prevState: CrmActionState,
  formData: FormData
): Promise<CrmActionState> {
  const user = await requireCurrentUser();
  try {
    requireCrm(user);
    if (!canManage(user)) throw new PermissionError("Only a CRM admin can edit a lead.");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const existing = await prisma.crmLead.findUnique({ where: { id: leadId } });
  if (!existing) return { error: "Lead not found." };

  const parsed = readLeadForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  if (parsed.assignedToId !== existing.assignedToId) {
    const assignError = await assertAssignable(parsed.assignedToId);
    if (assignError) return { error: assignError };
  }

  const updated = await prisma.crmLead.update({
    where: { id: leadId },
    data: parsed,
    include: LEAD_INCLUDE,
  });

  revalidatePath("/crm");
  return { error: null, lead: toLeadData(updated) };
}

export async function deleteCrmLeadAction(leadId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireCrm(user);
  if (!canManage(user)) throw new PermissionError("Only a CRM admin can delete a lead.");

  await prisma.crmLead.deleteMany({ where: { id: leadId } });
  revalidatePath("/crm");
}

// -----------------------------------------------------------------------
// Rep: moving a lead through the pipeline
// -----------------------------------------------------------------------

export interface CrmStatusPayload {
  saleAmount?: string | number | null;
  profit?: string | number | null;
  failureNote?: string | null;
}

/**
 * The single write a rep makes. `seenAt` is stamped the first time a lead
 * leaves Unseen and then left alone — it records when the rep first picked
 * the lead up, which must survive every later move.
 *
 * Unseen is a system state, not a destination: a lead that has been
 * acknowledged can be moved back to Seen but never back to Unseen, so the
 * "waiting for the rep" column always means exactly that.
 */
export async function setCrmLeadStatusAction(
  leadId: string,
  status: string,
  payload: CrmStatusPayload = {}
): Promise<CrmActionState> {
  const user = await requireCurrentUser();
  try {
    requireCrm(user);
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  if (!isCrmLeadStatus(status)) return { error: "Unknown status." };
  if (status === "Unseen") return { error: "A lead can't be moved back to Unseen." };

  const existing = await prisma.crmLead.findUnique({ where: { id: leadId } });
  if (!existing) return { error: "Lead not found." };
  if (!canManage(user) && existing.assignedToId !== user.id) {
    return { error: "That lead isn't assigned to you." };
  }

  let saleAmount: number | null = null;
  let profit: number | null = null;
  let failureNote: string | null = null;

  if (status === "Closed") {
    const sale = parseMoney(payload.saleAmount);
    const prof = parseMoney(payload.profit);
    if (sale === undefined) return { error: "Enter the sale amount." };
    if (sale === null || sale < 0) return { error: "Sale amount must be a number." };
    if (prof === undefined) return { error: "Enter the profit." };
    if (prof === null) return { error: "Profit must be a number." };
    saleAmount = sale;
    profit = prof;
  }

  if (status === "Failed") {
    const note = String(payload.failureNote ?? "").trim();
    if (!note) return { error: "Write down why this lead failed." };
    failureNote = note;
  }

  const updated = await prisma.crmLead.update({
    where: { id: leadId },
    data: {
      status: status as CrmLeadStatus,
      // Only ever set once — the first acknowledgement is the one that counts.
      seenAt: existing.seenAt ?? new Date(),
      // Figures belong to the outcome that produced them; moving off Closed
      // or Failed clears them rather than leaving stale numbers behind.
      saleAmount,
      profit,
      failureNote,
    },
    include: LEAD_INCLUDE,
  });

  revalidatePath("/crm");
  return { error: null, lead: toLeadData(updated) };
}

// -----------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------

/** The one company-wide day that closes a reporting week (0 = Sunday). */
export async function setCrmReportDayAction(day: number): Promise<void> {
  const user = await requireCurrentUser();
  requireCrm(user);
  if (!canManage(user)) throw new PermissionError("Only a CRM admin can change the report day.");

  const reportDay = normalizeReportDay(day);
  await prisma.crmSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", reportDay },
    update: { reportDay },
  });
  revalidatePath("/crm");
}

// -----------------------------------------------------------------------
// Weekly report
// -----------------------------------------------------------------------

/**
 * Generates the calling rep's report for the week currently owed. A report
 * is a frozen snapshot: it's written once and never recomputed, so it keeps
 * saying what the rep confirmed on the day they signed it off.
 *
 * Only leads *received* in that week are covered — a lead that arrives one
 * week and closes the next belongs to neither week's closed total. That's a
 * deliberate choice: the report answers "what came in this week and what
 * happened to it", not "what closed this week".
 */
export async function generateCrmWeeklyReportAction(
  _prevState: CrmReportActionState,
  formData: FormData
): Promise<CrmReportActionState> {
  const user = await requireCurrentUser();
  try {
    requireCrm(user);
    if (!canWork(user)) throw new PermissionError("Only a CRM sales rep generates a report.");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  if (!formData.get("confirm")) {
    return { error: "Tick the confirmation first — the report is frozen once generated." };
  }

  const { reportDay } = await getCrmSettings();
  const week = dueReportWeek(reportDay);

  // The client tells us which week it thinks it's reporting on; if the
  // report day rolled over between page load and submit, say so rather
  // than silently filing the wrong week.
  const claimed = trimmed(formData, "weekEnd");
  if (claimed && claimed !== toDateInputValue(week.end)) {
    return { error: "The reporting week has moved on. Reload the page and try again." };
  }

  const existing = await prisma.crmWeeklyReport.findUnique({
    where: { repId_weekEnd: { repId: user.id, weekEnd: week.end } },
  });
  if (existing) return { error: "This week's report has already been generated." };

  const leads = await prisma.crmLead.findMany({
    where: { assignedToId: user.id, receivedAt: weekRangeFilter(week) },
    orderBy: { receivedAt: "asc" },
  });

  if (leads.length === 0) {
    return { error: "No leads were received this week, so there's nothing to report." };
  }

  const unseen = leads.filter((l) => l.status === "Unseen").length;
  if (unseen > 0) {
    return {
      error: `${unseen} lead${unseen === 1 ? " is" : "s are"} still Unseen. Set every lead's status before generating.`,
    };
  }

  const { rows, totals } = buildReportSnapshot(leads);

  await prisma.crmWeeklyReport.create({
    data: {
      repId: user.id,
      weekStart: week.start,
      weekEnd: week.end,
      leadsWorked: totals.leadsWorked,
      closedCount: totals.closedCount,
      failedCount: totals.failedCount,
      unreachableCount: totals.unreachableCount,
      totalSale: totals.totalSale,
      totalProfit: totals.totalProfit,
      // Prisma types a Json column as an index-signature object; the
      // frozen rows are a plain array of plain values, which satisfies
      // that at runtime but not structurally.
      rows: rows as unknown as Prisma.InputJsonValue,
    },
  });

  // The banner lives outside /crm too, so the whole shell has to re-render.
  revalidatePath("/", "layout");
  return { error: null, generated: true };
}

/** Deleting a generated report — Admin-only, and the only way a rep gets to
 * re-file a week they signed off by mistake. */
export async function deleteCrmWeeklyReportAction(reportId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireCrm(user);
  if (!canManage(user)) throw new PermissionError("Only a CRM admin can delete a report.");

  await prisma.crmWeeklyReport.deleteMany({ where: { id: reportId } });
  revalidatePath("/", "layout");
}

/** Used by the Admin lead form to populate the "assign to" list. */
export async function listCrmRepsAction(): Promise<{ id: string; name: string }[]> {
  const user = await requireCurrentUser();
  requireCrm(user);
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return users.filter((u) => can(u, "workCrmLeads")).map((u) => ({ id: u.id, name: u.name }));
}
