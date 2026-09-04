import { Wallet, Landmark, Receipt as ReceiptIcon, TrendingUp, TrendingDown } from "lucide-react";
import { can, type PermissionSubject } from "@/lib/permissions";
import { expensesStats, purchaseVariance } from "@/lib/calc/expenses";
import { toNumber } from "@/lib/money";
import { Lightbox } from "../../Lightbox";
import { pullExpensesFromBudgetAction, deleteExpenseAction } from "./expensesActions";
import { AddExpenseForm } from "./AddExpenseForm";
import { AddExpenseToggle } from "./AddExpenseToggle";
import { ActualSpentCell } from "./ActualSpentCell";
import { MobileExpenseCard } from "./MobileExpenseCard";

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
  const isStock = row.category === "stock";
  const magnitude = Math.abs((isStock ? v.amountQty : v.amountETB) ?? 0);
  const suffix = isStock ? (row.unit ?? "") : "Br";
  return (
    <span style={{ color: v.status === "over" ? "var(--danger)" : "var(--success)" }}>
      {VARIANCE_LABEL[v.status]} {magnitude.toLocaleString()} {suffix}
    </span>
  );
}

function ActualSpentDisplay({ row, jobId, editable }: { row: ExpenseRow; jobId: string; editable: boolean }) {
  if (!editable) {
    if (row.actualSpent === null) return <span className="label">—</span>;
    return <span>{String(row.actualSpent)}</span>;
  }
  return (
    <ActualSpentCell
      // Both the desktop table and mobile card list render this row at
      // once (CSS just hides one), so two instances share one expenseId.
      // Keying on the current value forces a fresh mount — and fresh
      // local state — whenever the other instance's edit saves and this
      // row re-renders with a new server value, instead of silently
      // going stale.
      key={String(row.actualSpent)}
      expenseId={row.id}
      jobId={jobId}
      actualSpent={row.actualSpent}
      placeholder={row.category === "stock" ? "qty" : "Br"}
    />
  );
}

export function ExpensesTab({ job, user }: { job: { id: string; expenses: ExpenseRow[] }; user: PermissionSubject }) {
  const editable = can(user, "manageExpenses");
  const purchases = job.expenses.filter((e) => e.entryType === "purchase");
  const receipts = job.expenses.filter((e) => e.entryType === "receipt");
  const stats = expensesStats(job.expenses);

  const gridStats = [
    { label: "Total Withholding", value: `${stats.totalWithholding.toLocaleString()} Br`, icon: Landmark },
    { label: "Collected Receipts", value: `${stats.collectedReceiptsBr.toLocaleString()} Br`, icon: ReceiptIcon },
    { label: "Over Budget", value: `${stats.overBudget.toLocaleString()} Br`, icon: TrendingUp },
    { label: "Under Budget", value: `${stats.underBudget.toLocaleString()} Br`, icon: TrendingDown },
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <div className="expense-hero-card">
          <span className="expense-hero-icon"><Wallet size={18} strokeWidth={2} color="#fff" /></span>
          <div className="expense-hero-label">Total Spent</div>
          <div className="expense-hero-value">{stats.totalSpent.toLocaleString()} Br</div>
        </div>
        <div className="dash-stats-grid" style={{ marginTop: 12 }}>
          {gridStats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card dash-stat-card" style={{ paddingRight: 16 }}>
                <span className="dash-stat-icon"><Icon size={17} strokeWidth={2} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="label" style={{ marginBottom: 2 }}>{s.label}</div>
                  <div className="dash-stat-value" style={{ fontSize: 16 }}>{s.value}</div>
                </div>
              </div>
            );
          })}
        </div>
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

        <div className="expenses-desktop-table">
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
                  <ActualSpentDisplay row={p} jobId={job.id} editable={editable} />
                </td>
                <td data-label="Variance"><VarianceCell row={p} /></td>
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
              <tr><td className="label" colSpan={11}>No purchases logged yet.</td></tr>
            )}
          </tbody>
        </table>
        </div>
        {editable && <AddExpenseForm jobId={job.id} entryType="purchase" />}
        </div>

        <div className="expenses-mobile-cards" style={{ marginTop: 8 }}>
          {purchases.map((p) => (
            <MobileExpenseCard key={p.id} row={p} jobId={job.id} editable={editable} entryType="purchase" />
          ))}
          {purchases.length === 0 && <p className="label">No purchases logged yet.</p>}
          {editable && <AddExpenseToggle jobId={job.id} entryType="purchase" />}
        </div>
      </div>

      <div>
        <h3 style={{ margin: 0 }}>Receipts</h3>

        <div className="expenses-desktop-table">
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

        <div className="expenses-mobile-cards" style={{ marginTop: 8 }}>
          {receipts.map((r) => (
            <MobileExpenseCard key={r.id} row={r} jobId={job.id} editable={editable} entryType="receipt" />
          ))}
          {receipts.length === 0 && <p className="label">No receipts logged yet.</p>}
          {editable && <AddExpenseToggle jobId={job.id} entryType="receipt" />}
        </div>
      </div>
    </div>
  );
}
