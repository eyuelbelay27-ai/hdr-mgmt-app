import type { CrmLeadStatus } from "@prisma/client";
import { toNumber, round2 } from "@/lib/money";
import { toDateInputValue } from "./week";

/**
 * One line of a generated weekly report. These are frozen into
 * CrmWeeklyReport.rows as JSON at generation time: a report is what the rep
 * confirmed and signed off on that week, so editing a lead afterwards must
 * not rewrite history. That's also why the row carries copies of the lead's
 * details rather than its id.
 */
export interface CrmReportRow {
  location: string;
  phone: string;
  businessType: string;
  status: CrmLeadStatus;
  /** "yyyy-mm-dd" — kept as a string so the frozen JSON round-trips. */
  receivedAt: string;
  saleAmount: number | null;
  profit: number | null;
  failureNote: string | null;
}

export interface CrmReportTotals {
  leadsWorked: number;
  closedCount: number;
  failedCount: number;
  unreachableCount: number;
  totalSale: number;
  totalProfit: number;
}

export interface CrmLeadForReport {
  location: string;
  phone: string;
  businessType: string;
  status: CrmLeadStatus;
  receivedAt: Date;
  saleAmount: unknown;
  profit: unknown;
  failureNote: string | null;
}

export function buildReportSnapshot(leads: CrmLeadForReport[]): {
  rows: CrmReportRow[];
  totals: CrmReportTotals;
} {
  const rows: CrmReportRow[] = leads.map((l) => ({
    location: l.location,
    phone: l.phone,
    businessType: l.businessType,
    status: l.status,
    receivedAt: toDateInputValue(l.receivedAt),
    saleAmount: l.saleAmount === null || l.saleAmount === undefined ? null : toNumber(l.saleAmount),
    profit: l.profit === null || l.profit === undefined ? null : toNumber(l.profit),
    failureNote: l.failureNote,
  }));

  const closed = rows.filter((r) => r.status === "Closed");
  return {
    rows,
    totals: {
      leadsWorked: rows.length,
      closedCount: closed.length,
      failedCount: rows.filter((r) => r.status === "Failed").length,
      unreachableCount: rows.filter((r) => r.status === "Unreachable").length,
      totalSale: round2(closed.reduce((sum, r) => sum + toNumber(r.saleAmount), 0)),
      totalProfit: round2(closed.reduce((sum, r) => sum + toNumber(r.profit), 0)),
    },
  };
}

/** Reads back what buildReportSnapshot froze. Prisma types a Json column as
 * `unknown`, and a report written by an older version of this code could be
 * missing fields, so every row is rebuilt defensively rather than cast. */
export function parseReportRows(value: unknown): CrmReportRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      location: typeof r.location === "string" ? r.location : "",
      phone: typeof r.phone === "string" ? r.phone : "",
      businessType: typeof r.businessType === "string" ? r.businessType : "",
      status: (typeof r.status === "string" ? r.status : "Unseen") as CrmLeadStatus,
      receivedAt: typeof r.receivedAt === "string" ? r.receivedAt : "",
      saleAmount: typeof r.saleAmount === "number" ? r.saleAmount : null,
      profit: typeof r.profit === "number" ? r.profit : null,
      failureNote: typeof r.failureNote === "string" ? r.failureNote : null,
    };
  });
}
