import type { JobStatus } from "@prisma/client";
import { can, type PermissionSubject } from "@/lib/permissions";
import { remainingPayment } from "@/lib/calc/payments";
import { toNumber } from "@/lib/money";
import { RecordPaymentForm } from "./RecordPaymentForm";
import { PaymentRow } from "./PaymentRow";

interface PaymentRowData {
  id: string;
  amount: unknown;
  type: string;
  method: string | null;
  date: Date;
  notes: string | null;
  receiptName: string | null;
  receiptUrl: string | null;
  receiptKind: string | null;
}

export function PaymentsTab({
  job,
  user,
}: {
  job: { id: string; status: JobStatus; costEstimateSoldPrice: unknown; payments: PaymentRowData[] };
  user: PermissionSubject;
}) {
  const editable = can(user, "managePayments") && job.status !== "Closed";
  const canEditDelete = can(user, "editDeletePayments") && job.status !== "Closed";
  const remaining = remainingPayment(job.costEstimateSoldPrice, job.payments);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {job.status === "Closed" && (
        <div className="card" style={{ padding: 12, borderColor: "var(--warn)" }}>
          <div className="label" style={{ color: "var(--warn)" }}>
            Locked — this job is Closed. Revert to Reconciliation (then Flag for Review) to record more payments.
          </div>
        </div>
      )}
      <div className="form-row">
        <div className="card" style={{ padding: 12 }}>
          <div className="label">Sold Price</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{toNumber(job.costEstimateSoldPrice).toLocaleString()} Br</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="label">Remaining Payment</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{remaining.toLocaleString()} Br</div>
        </div>
      </div>

      <div className="card dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Notes</th>
            <th>Receipt</th>
            {canEditDelete && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {job.payments.map((p) => (
            <PaymentRow key={p.id} payment={p} jobId={job.id} canEditDelete={canEditDelete} />
          ))}
          {job.payments.length === 0 && (
            <tr><td className="label" colSpan={canEditDelete ? 7 : 6}>No payments recorded yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {editable && <RecordPaymentForm jobId={job.id} />}
    </div>
  );
}
