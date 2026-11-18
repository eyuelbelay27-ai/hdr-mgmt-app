import { toNumber } from "@/lib/money";
import type { Entry } from "@/lib/pnl";

export interface EntryRow {
  id: string;
  kind: "in" | "out";
  amount: unknown;
  cashId: string;
  accountId: string;
  date: Date;
  note: string;
  ref: string | null;
  receiptName: string | null;
  receiptUrl: string | null;
  receiptKind: string | null;
  createdAt: Date;
}
export function toEntry(e: EntryRow): Entry {
  return {
    id: e.id,
    kind: e.kind,
    amount: toNumber(e.amount),
    cashId: e.cashId,
    accountId: e.accountId,
    date: e.date.toISOString().slice(0, 10),
    note: e.note,
    ref: e.ref,
    receipt: e.receiptUrl ? { name: e.receiptName ?? "receipt", url: e.receiptUrl, kind: e.receiptKind ?? "image/jpeg" } : null,
    createdAt: e.createdAt.getTime(),
  };
}

