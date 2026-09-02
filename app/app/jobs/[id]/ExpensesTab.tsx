import { can, type PermissionSubject } from "@/lib/permissions";
import { expensesStats, purchaseVariance } from "@/lib/calc/expenses";
import { toNumber } from "@/lib/money";
import { Lightbox } from "../../Lightbox";
import { pullExpensesFromBudgetAction, deleteExpenseAction } from "./expensesActions";
import { AddExpenseForm } from "./AddExpenseForm";
import { ActualSpentCell } from "./ActualSpentCell";

interface ExpenseRow {
  id: string;
  entryType: string;
  category: string | null;
  source: string;
  purchaser: string | null;
  date: Date;
  item: string;
  description: string | null;
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

const VARIANCE_LABEL: Record<string, string> = { over: "Over Budget by", under: "Under Budget by", on: "On Budget" };

function VarianceCell({ row }: { row: ExpenseRow }) {
  const v = purchaseVariance(row);
  if (v.status === null) return <span className="label">—</span>;
  if (v.status === "on") return <span>On Budget</span>;
  return (
    <span style={{ color: v.status === "over" ? "var(--danger)" : "var(--success)" }}>
      {VARIANCE_LABEL[v.status]} {Math.abs(v.amountETB ?? 0).toLocaleString()} Br
    </span>
  );
}

export function ExpensesTab({ job, user }: { job: { id: string; expenses: ExpenseRow[] }; user: PermissionSubject }) {
  const editable = can(user, "manageExpenses");
  const purchases = job.expenses.filter((e) => e.entryType === "purchase");
  const receipts = job.expenses.filter((e) => e.entryType === "receipt");
  const stats = expensesStats(job.expenses);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="form-row">
        {[
          { label: "Total Purchases", value: `${stats.totalPurchases.toLocaleString()} Br` },
          { label: "Total Withholding", value: `${stats.totalWithholding.toLocaleString()} Br` },
          { label: "Collected Receipts", value: stats.collectedReceipts },
          { label: "Over Budget", value: `${stats.overBudget.toLocaleString()} Br` },
          { label: "Under Budget", value: `${stats.underBudget.toLocaleString()} Br` },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: 12 }}>
            <div className="label">{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Purchases</h3>
          {editable && (
            <form action={pullExpensesFromBudgetAction.bind(null, job.id)}>
              <button className="btn btn-sm" type="submit">Pull From Budget</button>
            </form>
          )}
        </div>
        <div className="dtable-wrap" style={{ marginTop: 8 }}>
        <table className="dtable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Purchaser</th>
              <th>Item</th>
              <th>Category</th>
              <th>Qty/Unit</th>
              <th>Total</th>
              <th>Budget Ref</th>
              <th>Withholding</th>
              <th>Actual Spent</th>
              <th>Variance</th>
              <th>Receipt</th>
              {editable && <th />}
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} style={p.flagged ? { background: "var(--danger-soft)" } : undefined}>
                <td data-label="Date">{p.date.toISOString().slice(0, 10)}</td>
                <td data-label="Purchaser">{p.purchaser ?? "—"}</td>
                <td data-label="Item">{p.item}</td>
                <td data-label="Category">{p.category === "cash" ? "Cash" : "Stock"}</td>
                <td className="mono" data-label="Qty/Unit">{p.category === "stock" ? `${String(p.qty)} ${p.unit ?? ""}` : "—"}</td>
                <td className="mono" data-label="Total">{toNumber(p.totalPrice).toLocaleString()}</td>
                <td className="label" data-label="Budget Ref">{p.budgetRef ?? "—"}</td>
                <td className="mono" data-label="Withholding">{toNumber(p.withholding).toLocaleString()}</td>
                <td data-label="Actual Spent" data-span={editable ? "full" : undefined}>
                  {editable ? (
                    <ActualSpentCell
                      expenseId={p.id}
                      jobId={job.id}
                      actualSpent={p.actualSpent}
                      placeholder={p.category === "stock" ? "qty" : "Br"}
                    />
                  ) : (
                    p.actualSpent === null ? "—" : String(p.actualSpent)
                  )}
                </td>
                <td data-label="Variance"><VarianceCell row={p} /></td>
                <td data-label="Receipt">
                  {p.receiptUrl && (
                    <Lightbox file={{ name: p.receiptName ?? "receipt", url: p.receiptUrl, kind: p.receiptKind ?? "" }} size={36} />
                  )}
                </td>
                {editable && (
                  <td>
                    <form action={deleteExpenseAction.bind(null, p.id, job.id)}>
                      <button className="btn btn-sm btn-danger" type="submit">Delete</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {purchases.length === 0 && (
              <tr><td className="label" colSpan={12}>No purchases logged yet.</td></tr>
            )}
          </tbody>
        </table>
        </div>
        {editable && <AddExpenseForm jobId={job.id} entryType="purchase" />}
      </div>

      <div>
        <h3 style={{ margin: 0 }}>Receipts</h3>
        <div className="dtable-wrap" style={{ marginTop: 8 }}>
        <table className="dtable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Purchaser</th>
              <th>Item</th>
              <th>Description</th>
              <th>Total</th>
              <th>Withholding</th>
              <th>Receipt</th>
              {editable && <th />}
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.id}>
                <td data-label="Date">{r.date.toISOString().slice(0, 10)}</td>
                <td data-label="Purchaser">{r.purchaser ?? "—"}</td>
                <td data-label="Item">{r.item}</td>
                <td data-label="Description">{r.description ?? "—"}</td>
                <td className="mono" data-label="Total">{toNumber(r.totalPrice).toLocaleString()}</td>
                <td className="mono" data-label="Withholding">{toNumber(r.withholding).toLocaleString()}</td>
                <td data-label="Receipt">
                  {r.receiptUrl && (
                    <Lightbox file={{ name: r.receiptName ?? "receipt", url: r.receiptUrl, kind: r.receiptKind ?? "" }} size={36} />
                  )}
                </td>
                {editable && (
                  <td>
                    <form action={deleteExpenseAction.bind(null, r.id, job.id)}>
                      <button className="btn btn-sm btn-danger" type="submit">Delete</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr><td className="label" colSpan={8}>No receipts logged yet.</td></tr>
            )}
          </tbody>
        </table>
        </div>
        {editable && <AddExpenseForm jobId={job.id} entryType="receipt" />}
      </div>
    </div>
  );
}
