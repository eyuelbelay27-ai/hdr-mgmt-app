import type { CrmLeadStatus, Prisma } from "@prisma/client";
import { toNumber } from "@/lib/money";
import { parseDateOnly, addDays } from "@/lib/crm/week";
import { parseReportRows, type CrmReportRow } from "@/lib/crm/report";

/**
 * Shared, non-action CRM helpers. This file deliberately has no
 * "use server" directive: such a file may only export async functions,
 * and the constants, types and synchronous mappers below are needed by
 * both the server actions and the client board.
 */

export const CRM_PAGE_SIZE = 50;

/** A lead as the client board sees it — every Prisma Decimal already
 * converted to a plain number, since Decimals can't cross the
 * server→client boundary (React silently drops them). */
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

/** Admin-side filters. A rep never gets to set `repId` — the server pins it
 * to their own id regardless of what the client sends. */
export interface CrmLeadFilters {
  repId?: string | null;
  /** "yyyy-mm-dd", both inclusive. */
  from?: string | null;
  to?: string | null;
}

export function buildLeadWhere(
  filters: CrmLeadFilters,
  forcedRepId: string | null
): Prisma.CrmLeadWhereInput {
  const where: Prisma.CrmLeadWhereInput = {};

  const repId = forcedRepId ?? (filters.repId || null);
  if (repId) where.assignedToId = repId;

  const from = filters.from ? parseDateOnly(filters.from) : null;
  const to = filters.to ? parseDateOnly(filters.to) : null;
  if (from || to) {
    where.receivedAt = {
      ...(from ? { gte: from } : {}),
      // `to` is an inclusive day, so the upper bound is the next midnight.
      ...(to ? { lt: addDays(to, 1) } : {}),
    };
  }

  return where;
}

/** Newest lead first, and never by an editable field — an Admin correcting
 * a lead's received date must not make it jump position mid-edit (the same
 * bug the Price Database and Overtime lists were fixed for). */
export const CRM_LEAD_ORDER: Prisma.CrmLeadOrderByWithRelationInput[] = [
  { createdAt: "desc" },
];

/** A generated weekly report, flattened for the client. */
export interface CrmReportData {
  id: string;
  repId: string;
  repName: string;
  weekStart: Date;
  weekEnd: Date;
  generatedAt: Date;
  leadsWorked: number;
  closedCount: number;
  failedCount: number;
  unreachableCount: number;
  totalSale: number;
  totalProfit: number;
  rows: CrmReportRow[];
}

export function toReportData(r: {
  id: string;
  repId: string;
  rep: { name: string };
  weekStart: Date;
  weekEnd: Date;
  generatedAt: Date;
  leadsWorked: number;
  closedCount: number;
  failedCount: number;
  unreachableCount: number;
  totalSale: unknown;
  totalProfit: unknown;
  rows: unknown;
}): CrmReportData {
  return {
    id: r.id,
    repId: r.repId,
    repName: r.rep.name,
    weekStart: r.weekStart,
    weekEnd: r.weekEnd,
    generatedAt: r.generatedAt,
    leadsWorked: r.leadsWorked,
    closedCount: r.closedCount,
    failedCount: r.failedCount,
    unreachableCount: r.unreachableCount,
    totalSale: toNumber(r.totalSale),
    totalProfit: toNumber(r.totalProfit),
    rows: parseReportRows(r.rows),
  };
}
