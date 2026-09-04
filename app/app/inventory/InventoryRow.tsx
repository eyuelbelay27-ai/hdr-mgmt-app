"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

interface Row {
  id: string;
  date: Date;
  direction: string;
  itemName: string;
  qty: unknown;
  unit: string | null;
  source: string;
  note: string | null;
  job: { id: string; jobNumber: string; clientName: string } | null;
}

/** Compact single-row card for the Inventory Transactions list, mobile only.
 * Tap to expand in place for Source, Project, and Note — the ledger itself is
 * read-only (never edited or deleted here), so there's nothing to act on. */
export function InventoryRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const isIn = row.direction === "in";

  return (
    <div className="card expense-row">
      <button type="button" className="expense-row-header" onClick={() => setOpen((o) => !o)}>
        <div className="expense-row-date">
          <div className="expense-row-date-month">{MONTH_ABBR[row.date.getUTCMonth()]}</div>
          <div className="expense-row-date-day">{String(row.date.getUTCDate()).padStart(2, "0")}</div>
          <div className="expense-row-date-year">{row.date.getUTCFullYear()}</div>
        </div>
        <div className="expense-row-divider" />
        <div className="expense-row-main">
          <div className="expense-row-item">{row.itemName}</div>
          <span
            className="badge"
            style={isIn ? { background: "var(--success-soft)", color: "var(--success)" } : { background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            {isIn ? "In" : "Out"}
          </span>
        </div>
        <div className="expense-row-amounts">
          <div className="expense-row-total">
            {String(row.qty)} {row.unit ?? ""}
          </div>
          {row.job && <div className="expense-row-spent">{row.job.jobNumber}</div>}
        </div>
        <ChevronRight size={16} strokeWidth={2} className="expense-row-chevron" style={{ transform: open ? "rotate(90deg)" : undefined }} />
      </button>

      {open && (
        <div className="expense-row-detail">
          <div className="expense-row-detail-grid">
            <div>
              <div className="label" style={{ marginBottom: 2 }}>Source</div>
              <div style={{ fontSize: 13.5 }}>{row.source}</div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 2 }}>Project</div>
              {row.job ? (
                <a href={`/jobs/${row.job.id}`} style={{ fontSize: 13.5 }}>{row.job.jobNumber} — {row.job.clientName}</a>
              ) : (
                <span className="label">—</span>
              )}
            </div>
            {row.note && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="label" style={{ marginBottom: 2 }}>Note</div>
                <div style={{ fontSize: 13.5 }}>{row.note}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
