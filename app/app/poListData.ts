import { toNumber } from "@/lib/money";

export const PO_PAGE_SIZE = 25;

export interface POListItem {
  id: string;
  poNumber: string;
  date: Date;
  purchaser: string;
  item: string;
  category: "cash" | "stock";
  qty: number;
  total: number;
  status: "Pending" | "Approved" | "Rejected";
  receiptName: string | null;
  receiptUrl: string | null;
  receiptKind: string | null;
  audited: boolean;
  auditedBy: string | null;
  note: string | null;
}

export function toListItem(po: {
  id: string;
  poNumber: string;
  date: Date;
  purchaser: string;
  item: string;
  category: string;
  qty: unknown;
  total: unknown;
  status: string;
  receiptName: string | null;
  receiptUrl: string | null;
  receiptKind: string | null;
  audited: boolean;
  auditedBy: string | null;
  note: string | null;
}): POListItem {
  return {
    id: po.id,
    poNumber: po.poNumber,
    date: po.date,
    purchaser: po.purchaser,
    item: po.item,
    category: po.category as "cash" | "stock",
    qty: toNumber(po.qty),
    total: toNumber(po.total),
    status: po.status as "Pending" | "Approved" | "Rejected",
    receiptName: po.receiptName,
    receiptUrl: po.receiptUrl,
    receiptKind: po.receiptKind,
    audited: po.audited,
    auditedBy: po.auditedBy,
    note: po.note,
  };
}
