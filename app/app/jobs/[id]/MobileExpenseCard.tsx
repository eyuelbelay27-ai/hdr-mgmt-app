"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { purchaseVariance } from "@/lib/calc/expenses";
import { toNumber } from "@/lib/money";
import { Lightbox } from "../../Lightbox";
import { ActualSpentCell } from "./ActualSpentCell";
import { deleteExpenseAction } from "./expensesActions";

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const VARIANCE_LABEL: Record<string, string> = { over: "Over by", under: "Under by", on: "On budget" };

interface Row {
  id: string;
  category: string | null;
  source: string;
  date: Date;
  item: string;
  qty: unknown;
  unit: string | null;
  unitPrice: unknown;
  totalPrice: unknown;
  budgetRef: string | null;
  withholding: unknown;
  actualSpent: unknown;
  receiptName: string | null;
  receiptUrl: string | null;
  receiptKind: string | null;
  flagged: boolean;
}

/** Compact single-row card for the Expenses tab, mobile only (Section 7.4/7.6). Tap to
 * expand in place for Actual Spent editing, Budget Ref, Withholding, Receipt, and Delete. */
export function MobileExpenseCard({ row, jobId, editable }: { row: Row; jobId: string; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const isStock = row.category === "stock";
  const v = purchaseVariance(row);
  const spentLabel = isStock
    ? row.actualSpent === null
      ? `${String(row.qty)} ${row.unit ?? ""}`
      : `${String(row.actualSpent)} ${row.unit ?? ""}`
    : `${toNumber(row.actualSpent === null ? row.totalPrice : row.actualSpent).toLocaleString()} Br`;

  return (
    <div className="card expense-row" style={row.flagged ? { background: "var(--danger-soft)" } : undefined}>
      <button type="button" className="expense-row-header" onClick={() => setOpen((o) => !o)}>
        <div className="expense-row-date">
          <div className="expense-row-date-month">{MONTH_ABBR[row.date.getUTCMonth()]}</div>
          <div className="expense-row-date-day">{String(row.date.getUTCDate()).padStart(2, "0")}</div>
          <div className="expense-row-date-year">{row.date.getUTCFullYear()}</div>
        </div>
        <div className="expense-row-divider" />
        <div className="expense-row-main">
          <div className="expense-row-item">{row.item}</div>
          {row.category && (
            <span
              className="badge"
              style={isStock ? { background: "var(--info-soft)", color: "var(--info)" } : { background: "var(--accent-soft)", color: "var(--accent-text)" }}
            >
              {isStock ? "Stock" : "Cash"}
            </span>
          )}
        </div>
        <div className="expense-row-amounts">
          <div className="expense-row-total">
            {isStock ? `${String(row.qty)} ${row.unit ?? ""}` : `${toNumber(row.totalPrice).toLocaleString()} Br`}
          </div>
          <div className="expense-row-spent">Spent: {spentLabel}</div>
          {v.status && (
            <div style={{ color: v.status === "over" ? "var(--danger)" : v.status === "under" ? "var(--success)" : "var(--text-dim)" }}>
              {v.status === "on"
                ? VARIANCE_LABEL.on
                : `${VARIANCE_LABEL[v.status]} ${Math.abs((isStock ? v.amountQty : v.amountETB) ?? 0).toLocaleString()} ${isStock ? row.unit ?? "" : "Br"}`}
            </div>
          )}
        </div>
        <ChevronRight size={16} strokeWidth={2} className="expense-row-chevron" style={{ transform: open ? "rotate(90deg)" : undefined }} />
      </button>

      {open && (
        <div className="expense-row-detail">
          <div className="expense-row-detail-grid">
            <div>
              <div className="label" style={{ marginBottom: 2 }}>Budget Ref</div>
              <div style={{ fontSize: 13.5 }}>{row.budgetRef ?? "—"}</div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 2 }}>Withholding</div>
              <div className="mono" style={{ fontSize: 13.5 }}>{toNumber(row.withholding).toLocaleString()} Br</div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 2 }}>Actual Spent</div>
              {editable ? (
                <ActualSpentCell
                  key={String(row.actualSpent)}
                  expenseId={row.id}
                  jobId={jobId}
                  actualSpent={row.actualSpent}
                  placeholder={isStock ? "qty" : "Br"}
                />
              ) : (
                <span>{row.actualSpent === null ? "—" : String(row.actualSpent)}</span>
              )}
            </div>
            <div>
              <div className="label" style={{ marginBottom: 2 }}>Receipt</div>
              {row.receiptUrl ? (
                <Lightbox file={{ name: row.receiptName ?? "receipt", url: row.receiptUrl, kind: row.receiptKind ?? "" }} size={32} />
              ) : (
                <span className="label">None</span>
              )}
            </div>
          </div>
          {editable && (
            <form action={deleteExpenseAction.bind(null, row.id, jobId)} style={{ marginTop: 10 }}>
              <button className="btn btn-sm btn-danger" type="submit">Delete</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
