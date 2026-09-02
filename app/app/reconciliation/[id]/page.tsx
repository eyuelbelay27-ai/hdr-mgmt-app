import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canSeePage, can } from "@/lib/permissions";
import { totalAllocatedCash } from "@/lib/calc/budget";
import { actualExpenseAmount, actualTotalExpenses, finalProfitAfterExpenses } from "@/lib/calc/reconciliation";
import { costEstimateTotals } from "@/lib/calc/cost-estimate";
import { toNumber } from "@/lib/money";
import { AppNav } from "../../AppNav";
import { StatusBadge } from "../../StatusBadge";
import { Lightbox } from "../../Lightbox";
import { markReconciledAction, revertToPendingAction, toggleChecklistAction, closeJobAction, reopenJobAction } from "../actions";
import { FlagForReviewControl } from "../FlagForReviewControl";

export default async function ReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "reconciliation")) redirect("/reconciliation");

  const job = await prisma.job.findUnique({
    where: { id },
    include: { budgetItems: true, expenses: true, payments: true, costEstimateItems: true },
  });
  if (!job) notFound();

  const allocated = totalAllocatedCash(job.budgetItems);
  const actual = actualTotalExpenses(job.expenses);
  const totals = costEstimateTotals(job.costEstimateItems, job.costEstimateSoldPrice, job.costEstimateCommissionActive);
  const finalProfit = finalProfitAfterExpenses(job.costEstimateSoldPrice, job.expenses, totals.commission);
  const withholdingTotal = job.expenses.reduce((s, e) => s + toNumber(e.withholding), 0);
  const receiptedExpenses = job.expenses.filter((e) => e.receiptUrl);

  const canReconcile = can(user, "reconcileBudget");
  const canClose = can(user, "closeJob");
  const canReopen = can(user, "reopenJob");
  const checklistDone = job.checklistWithholdingCollected && job.checklistReceiptAttached;

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="reconciliation" />
      <main className="app-main">
        <a href="/reconciliation" className="label">&larr; Back to Reconciliation</a>
        <h1 style={{ margin: "4px 0 6px" }}>{job.jobNumber} — {job.clientName}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge status={job.status} />
          <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}>
            Reconciliation: {job.reconciliationStatus}
          </span>
        </div>

        {job.reconciliationNote && (
          <div className="card" style={{ padding: 12, marginTop: 12, borderColor: "var(--warn)" }}>
            <div className="label" style={{ color: "var(--warn)" }}>Flag Note</div>
            <div style={{ marginTop: 4 }}>{job.reconciliationNote}</div>
          </div>
        )}

        <section style={{ marginTop: 20 }}>
          <h3>1. Budget vs. Expense Variance</h3>
          <p className="label">
            Total Allocated (Cash): {allocated.toLocaleString()} Br · Actual Total Expenses: {actual.toLocaleString()} Br
          </p>
          <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr><th>Item</th><th>Category</th><th>Budgeted</th><th>Actual (Br)</th><th>Variance</th></tr>
            </thead>
            <tbody>
              {job.budgetItems.map((b) => {
                const matched = job.expenses.find((e) => e.budgetRef === b.label);
                const budgetedETB = b.category === "stock" ? 0 : toNumber(b.amount);
                const actualETB = matched ? actualExpenseAmount(matched) : 0;
                const variance = Math.round((actualETB - budgetedETB) * 100) / 100;
                return (
                  <tr key={b.id}>
                    <td data-label="Item">{b.label}</td>
                    <td data-label="Category">{b.category === "cash" ? "Cash" : "Stock"}</td>
                    <td className="mono" data-label="Budgeted">{b.category === "stock" ? `${String(b.qty)} ${b.unit ?? ""}` : budgetedETB.toLocaleString()}</td>
                    <td className="mono" data-label="Actual (Br)">{actualETB.toLocaleString()}</td>
                    <td className="mono" data-label="Variance" style={{ color: variance > 0 ? "var(--danger)" : "var(--success)" }}>
                      {variance.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {canReconcile && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {job.reconciliationStatus !== "Reconciled" && (
                <form action={markReconciledAction.bind(null, job.id)}>
                  <button className="btn btn-sm btn-primary" type="submit">Mark Reconciled</button>
                </form>
              )}
              {job.reconciliationStatus !== "Flagged" && <FlagForReviewControl jobId={job.id} />}
              {job.reconciliationStatus !== "Pending" && (
                <form action={revertToPendingAction.bind(null, job.id)}>
                  <button className="btn btn-sm" type="submit">Revert to Pending</button>
                </form>
              )}
            </div>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <h3>2. Payment Records</h3>
          <div className="dtable-wrap">
          <table className="dtable">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Receipt</th></tr></thead>
            <tbody>
              {job.payments.map((p) => (
                <tr key={p.id}>
                  <td data-label="Date">{p.date.toISOString().slice(0, 10)}</td>
                  <td data-label="Type">{p.type}</td>
                  <td className="mono" data-label="Amount">{toNumber(p.amount).toLocaleString()}</td>
                  <td data-label="Receipt">
                    {p.receiptUrl && (
                      <Lightbox file={{ name: p.receiptName ?? "receipt", url: p.receiptUrl, kind: p.receiptKind ?? "" }} size={36} />
                    )}
                  </td>
                </tr>
              ))}
              {job.payments.length === 0 && <tr><td className="label" colSpan={4}>No payments recorded.</td></tr>}
            </tbody>
          </table>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h3>3. Receipts & Withholdings</h3>
          <div className="label" style={{ marginBottom: 8 }}>Total Withholding: {withholdingTotal.toLocaleString()} Br</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {receiptedExpenses.map((e) => (
              <Lightbox key={e.id} file={{ name: e.receiptName ?? "receipt", url: e.receiptUrl as string, kind: e.receiptKind ?? "" }} />
            ))}
            {receiptedExpenses.length === 0 && <span className="label">No receipts attached yet.</span>}
          </div>
        </section>

        <section className="card" style={{ marginTop: 24, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>4. Final Profit After Expenses</h3>
          <div className="label">Sold Price − Actual Total Expenses − Commission</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{finalProfit.toLocaleString()} Br</div>
          <div className="label" style={{ marginTop: 6 }}>
            {toNumber(job.costEstimateSoldPrice).toLocaleString()} − {actual.toLocaleString()} − {totals.commission.toLocaleString()}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h3>5. Final Checklist</h3>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                defaultChecked={job.checklistWithholdingCollected}
                disabled={!canReconcile}
                readOnly
              />
              Withholding Collected
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                defaultChecked={job.checklistReceiptAttached}
                disabled={!canReconcile}
                readOnly
              />
              Receipt Attached
            </label>
          </div>
          {canReconcile && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <form action={toggleChecklistAction.bind(null, job.id, "checklistWithholdingCollected", !job.checklistWithholdingCollected)}>
                <button className="btn btn-sm" type="submit">
                  {job.checklistWithholdingCollected ? "Uncheck" : "Check"} Withholding Collected
                </button>
              </form>
              <form action={toggleChecklistAction.bind(null, job.id, "checklistReceiptAttached", !job.checklistReceiptAttached)}>
                <button className="btn btn-sm" type="submit">
                  {job.checklistReceiptAttached ? "Uncheck" : "Check"} Receipt Attached
                </button>
              </form>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            {job.reconciliationStatus !== "Reconciled" ? (
              <p className="label">Close Job will appear here once the job is Reconciled.</p>
            ) : job.status === "Closed" ? (
              canReopen && (
                <form action={reopenJobAction.bind(null, job.id)}>
                  <button className="btn btn-sm" type="submit">Reopen Job</button>
                </form>
              )
            ) : (
              canClose && (
                <form action={closeJobAction.bind(null, job.id)}>
                  <button className="btn btn-primary btn-sm" type="submit" disabled={!checklistDone}>
                    Close Job
                  </button>
                </form>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
