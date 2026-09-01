"use client";

/** Section 9/10: browser print dialog, not real PDF generation. */
export function PrintButton() {
  return (
    <button className="btn btn-primary no-print" type="button" onClick={() => window.print()}>
      Print
    </button>
  );
}
