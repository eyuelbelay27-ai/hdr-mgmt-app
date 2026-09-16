import type { CrmLeadStatus, Prisma } from "@prisma/client";
import { toNumber, round2 } from "@/lib/money";
import { parseWeekRange, parseMonthRange, rangeFilter } from "@/lib/crm/week";

/**
 * Shared, non-action CRM helpers. This file deliberately has no
 * "use server" directive: such a file may only export async functions,
 * and the constants, types and synchronous mappers below are needed by
 * both the server actions and the client list.
 */

export const CRM_PAGE_SIZE = 50;

/** A lead as the client sees it — every Prisma Decimal already converted
 * to a plain number, since Decimals can't cross the server→client
 * boundary (React silently drops them). */
export interface CrmLeadData {
  id: string;
  phone: string;
  location: string;
  businessType: string;
  source: string | null;
  receivedAt: Date;
  status: CrmLeadStatus;
  seenAt: Date | null;
  saleAmount: number | null;
  profit: number | null;
  failureNote: string | null;
  assignedToId: string;
  assignedToName: string;
  createdBy: string | null;
}

export interface CrmLeadRow {
  id: string;
  phone: string;
  location: string;
  businessType: string;
  source: string | null;
  receivedAt: Date;
  status: CrmLeadStatus;
  seenAt: Date | null;
  saleAmount: unknown;
  profit: unknown;
  failureNote: string | null;
  assignedToId: string;
  assignedTo: { name: string };
  createdBy: string | null;
}

export function toLeadData(l: CrmLeadRow): CrmLeadData {
  return {
    id: l.id,
    phone: l.phone,
    location: l.location,
    businessType: l.businessType,
    source: l.source,
    receivedAt: l.receivedAt,
    status: l.status,
    seenAt: l.seenAt,
    saleAmount: l.saleAmount === null || l.saleAmount === undefined ? null : toNumber(l.saleAmount),
    profit: l.profit === null || l.profit === undefined ? null : toNumber(l.profit),
    failureNote: l.failureNote,
    assignedToId: l.assignedToId,
    assignedToName: l.assignedTo.name,
    createdBy: l.createdBy,
  };
}

/**
 * Lead filters. A rep never gets to set `repId` — the server pins it to
 * their own id regardless of what the client sends.
 *
 * `period` picks exactly one of a week or a month, both read against
 * `receivedAt` (when the lead came in), never `createdAt` — a lead typed
 * in late still lands in the week/month it was actually received. "all"
 * means no date restriction at all.
 */
export type CrmPeriod =
  | { mode: "all" }
  | { mode: "week"; value: string } // "yyyy-Www"
  | { mode: "month"; value: string }; // "yyyy-mm"

export interface CrmLeadFilters {
  repId?: string | null;
  period?: CrmPeriod;
}

function periodRange(period: CrmPeriod | undefined) {
  if (!period || period.mode === "all") return null;
  const range = period.mode === "week" ? parseWeekRange(period.value) : parseMonthRange(period.value);
  return range ? rangeFilter(range) : null;
}

export function buildLeadWhere(
  filters: CrmLeadFilters,
  forcedRepId: string | null
): Prisma.CrmLeadWhereInput {
  const where: Prisma.CrmLeadWhereInput = {};

  const repId = forcedRepId ?? (filters.repId || null);
  if (repId) where.assignedToId = repId;

  const range = periodRange(filters.period);
  if (range) where.receivedAt = range;

  return where;
}

/** Newest lead first, and never by an editable field — an Admin correcting
 * a lead's received date must not make it jump position mid-edit (the same
 * bug the Price Database and Overtime lists were fixed for). */
export const CRM_LEAD_ORDER: Prisma.CrmLeadOrderByWithRelationInput[] = [
  { createdAt: "desc" },
];

/**
 * Live totals for whatever filter is currently applied — computed across
 * every matching lead, not just the page that happens to be loaded, so the
 * numbers are right even when a period has more than one page of leads.
 * This is the same shape the old frozen weekly report showed; here it's
 * always current instead of a signed-off snapshot.
 */
export interface CrmPeriodSummary {
  leadsWorked: number;
  seenCount: number;
  unreachableCount: number;
  closedCount: number;
  failedCount: number;
  totalSale: number;
  totalProfit: number;
}

export function summarizeLeads(
  leads: { status: CrmLeadStatus; saleAmount: unknown; profit: unknown }[]
): CrmPeriodSummary {
  const closed = leads.filter((l) => l.status === "Closed");
  return {
    leadsWorked: leads.length,
    seenCount: leads.filter((l) => l.status === "Seen").length,
    unreachableCount: leads.filter((l) => l.status === "Unreachable").length,
    closedCount: closed.length,
    failedCount: leads.filter((l) => l.status === "Failed").length,
    totalSale: round2(closed.reduce((sum, l) => sum + toNumber(l.saleAmount), 0)),
    totalProfit: round2(closed.reduce((sum, l) => sum + toNumber(l.profit), 0)),
  };
}
