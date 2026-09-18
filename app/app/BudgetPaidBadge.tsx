import { CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Purely presentational — the read-only badge shown to everyone who can
 * see the job, on both the Jobs list and the job detail page, once a
 * job's budget is Approved. Unpaid uses the same warning tone as
 * DeadlineBadge, deliberately: this is the thing managers said they keep
 * forgetting, so an unpaid job should visually stand out, not blend in.
 */
export function BudgetPaidBadge({ paid }: { paid: boolean }) {
  return paid ? (
    <span className="badge" style={{ background: "var(--success-soft)", color: "var(--success)", gap: 5 }}>
      <CheckCircle2 size={12} strokeWidth={2} />
      Budget Paid
    </span>
  ) : (
    <span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)", gap: 5 }}>
      <AlertTriangle size={12} strokeWidth={2} />
      Budget Unpaid
    </span>
  );
}
