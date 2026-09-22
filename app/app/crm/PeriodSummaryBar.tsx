import type { CrmPeriodSummary } from "./listData";

/**
 * Live totals for the current filter — leads worked, closed/failed/
 * unreachable counts, total sale and profit. Computed fresh from whatever
 * the reps have currently set (never a frozen snapshot), across every
 * matching lead rather than just the page that happens to be loaded.
 */
export function PeriodSummaryBar({ summary }: { summary: CrmPeriodSummary }) {
  return (
    <div className="card crm-summary-bar">
      <div>
        <div className="label">Leads Worked</div>
        <div className="mono">{summary.leadsWorked}</div>
      </div>
      <div>
        <div className="label">Ongoing</div>
        <div className="mono">{summary.ongoingCount}</div>
      </div>
      <div>
        <div className="label">Closed</div>
        <div className="mono">{summary.closedCount}</div>
      </div>
      <div>
        <div className="label">Unreachable</div>
        <div className="mono">{summary.unreachableCount}</div>
      </div>
      <div>
        <div className="label">Failed</div>
        <div className="mono">{summary.failedCount}</div>
      </div>
      <div>
        <div className="label">Total Sale</div>
        <div className="mono">{summary.totalSale.toLocaleString()} Br</div>
      </div>
      <div>
        <div className="label">Total Profit</div>
        <div className="mono">{summary.totalProfit.toLocaleString()} Br</div>
      </div>
    </div>
  );
}
