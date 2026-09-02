import { can, type PermissionSubject } from "@/lib/permissions";
import { remainingPayment } from "@/lib/calc/payments";
import { toNumber } from "@/lib/money";
import { Lightbox } from "../../Lightbox";
import { RecordPaymentForm } from "./RecordPaymentForm";

interface PaymentRow {
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
  job: { id: string; costEstimateSoldPrice: unknown; payments: PaymentRow[] };
  user: PermissionSubject;
}) {
  const editable = can(user, "managePayments");
  const remaining = remainingPayment(job.costEstimateSoldPrice, job.payments);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="form-row">
        <div className="card" style={{ padding: 12 }}>
          <div className="label">Sold Price</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{toNumber(job.costEstimateSoldPrice).toLocaleString()} ETB</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="label">Remaining Payment</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{remaining.toLocaleString()} ETB</div>
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
          </tr>
        </thead>
        <tbody>
          {job.payments.map((p) => (
            <tr key={p.id}>
              <td data-label="Date">{p.date.toISOString().slice(0, 10)}</td>
              <td data-label="Type">{p.type}</td>
              <td className="mono" data-label="Amount">{toNumber(p.amount).toLocaleString()}</td>
              <td data-label="Method">{p.method ?? "—"}</td>
              <td data-label="Notes">{p.notes ?? "—"}</td>
              <td data-label="Receipt">
                {p.receiptUrl && (
                  <Lightbox file={{ name: p.receiptName ?? "receipt", url: p.receiptUrl, kind: p.receiptKind ?? "" }} size={36} />
                )}
              </td>
            </tr>
          ))}
          {job.payments.length === 0 && (
            <tr><td className="label" colSpan={6}>No payments recorded yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {editable && <RecordPaymentForm jobId={job.id} />}
    </div>
  );
}
