import { notFound, redirect } from "next/navigation";
import { Wallet, Landmark, Receipt as ReceiptIcon, TrendingUp, TrendingDown, Package } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canSeePage, can } from "@/lib/permissions";
import { totalAllocatedCash } from "@/lib/calc/budget";
import { actualExpenseAmount, actualTotalExpenses, finalProfitAfterExpenses } from "@/lib/calc/reconciliation";
import { expensesStats } from "@/lib/calc/expenses";
import { costEstimateTotals } from "@/lib/calc/cost-estimate";
import { round2, toNumber } from "@/lib/money";
import { AppNav } from "../../AppNav";
import { StatusBadge } from "../../StatusBadge";
import { Lightbox } from "../../Lightbox";
import { markReconciledAction, revertToPendingAction, closeJobAction, reopenJobAction } from "../actions";
import { FlagForReviewControl } from "../FlagForReviewControl";
import { ChecklistToggle } from "../ChecklistToggle";
import { ChecklistImageUpload } from "../ChecklistImageUpload";

export default async function ReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "reconciliation")) redirect("/reconciliation");

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      budgetItems: { include: { expense: true } },
      expenses: true,
      payments: true,
      costEstimateItems: true,
      checklistImages: true,
    },
  });
  if (!job) notFound();

  const allocated = totalAllocatedCash(job.budgetItems);
  const actual = actualTotalExpenses(job.expenses);
  const totals = costEstimateTotals(job.costEstimateItems, job.costEstimateSoldPrice, job.costEstimateCommissionActive);
  const finalProfit = finalProfitAfterExpenses(job.costEstimateSoldPrice, job.expenses, totals.commission);
  const stats = expensesStats(job.expenses);
  const receiptedExpenses = job.expenses.filter((e) => e.receiptUrl);
  // Purchases never linked to a budget line (added directly in Expenses,
  // not pulled) — shown as their own rows in Section 1 below so real
  // spending is never silently missing from the variance review just
  // because it didn't come from a budget line.
  const unbudgetedPurchases = job.expenses.filter((e) => e.entryType === "purchase" && !e.budgetItemId);

  const canReconcile = can(user, "reconcileBudget");
  const canClose = can(user, "closeJob");
  const canReopen = can(user, "reopenJob");
  // VAT is deliberately excluded — optional, never blocks closing (mirrors closeJobAction).
  const checklistDone =
    job.checklistWithholdingCollected && job.checklistReceiptAttached && job.checklistBudgetVarianceSettled;

  const statCards = [
    { label: "Actual Expense", value: `${stats.totalSpent.toLocaleString()} Br`, icon: Wallet },
    { label: "Over Budget", value: `${stats.overBudget.toLocaleString()} Br`, icon: TrendingUp },
    { label: "Under Budget", value: `${stats.underBudget.toLocaleString()} Br`, icon: TrendingDown },
    // Materials over/underuse, in Birr — kept separate from the cash
    // Over/Under Budget cards above so a reviewer can tell whether a
    // profit swing came from cash overspend or from using more/less
    // material than budgeted, instead of it being invisible inside the
    // Final Profit total.
    { label: "Stock Over Budget", value: `${stats.stockOverBudgetBr.toLocaleString()} Br`, icon: TrendingUp },
    { label: "Stock Under Budget", value: `${stats.stockUnderBudgetBr.toLocaleString()} Br`, icon: TrendingDown },
    // Total real currency value of stock consumed — "Actual Expense" above
    // never includes stock (it's an inventory quantity event, not cash
    // spent), so this is the only place that number is visible on its own.
    { label: "Stock Actual Expense", value: `${stats.stockActualExpenseBr.toLocaleString()} Br`, icon: Package },
    { label: "Total Withholding", value: `${stats.totalWithholding.toLocaleString()} Br`, icon: Landmark },
    { label: "Total Receipts Collected", value: `${stats.collectedReceiptsBr.toLocaleString()} Br`, icon: ReceiptIcon },
  ];

  const imagesFor = (key: string) => job.checklistImages.filter((img) => img.itemKey === key);

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

        {job.reconciledBy && job.reconciledAt && (
          <p className="label" style={{ marginTop: 8 }}>
            {job.reconciliationStatus === "Flagged" ? "Flagged" : "Reconciled"} by {job.reconciledBy} on{" "}
            {job.reconciledAt.toISOString().slice(0, 10)}
          </p>
        )}

        {job.reconciliationNote && (
          <div className="card" style={{ padding: 12, marginTop: 12, borderColor: "var(--warn)" }}>
            <div className="label" style={{ color: "var(--warn)" }}>Flag Note</div>
            <div style={{ marginTop: 4 }}>{job.reconciliationNote}</div>
          </div>
        )}

        <div className="dash-stats-grid" style={{ marginTop: 16 }}>
          {statCards.map((s) => {
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

        <section style={{ marginTop: 24 }}>
          <h3>1. Budget vs. Expense Variance</h3>
          <p className="label">
            Total Allocated (Cash): {allocated.toLocaleString()} Br · Actual Total Expenses: {actual.toLocaleString()} Br
          </p>
          <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr><th>Item</th><th>Category</th><th>Budgeted</th><th>Actual</th><th>Variance (Br)</th></tr>
            </thead>
            <tbody>
              {job.budgetItems.map((b) => {
                const matched = b.expense;

                if (b.category === "stock") {
                  // Both Budgeted and Actual are shown as qty × unit price =
                  // total, using the same locked-in rate on both sides —
                  // that's what makes a currency Variance meaningful here
                  // instead of comparing a quantity to a hardcoded 0.
                  const unitPrice = matched ? toNumber(matched.unitPrice) : 0;
                  const budgetedQty = toNumber(b.qty);
                  const actualQty = matched && matched.actualSpent !== null ? toNumber(matched.actualSpent) : budgetedQty;
                  const budgetedCost = round2(budgetedQty * unitPrice);
                  const actualCost = round2(actualQty * unitPrice);
                  const variance = round2(actualCost - budgetedCost);
                  return (
                    <tr key={b.id}>
                      <td data-label="Item">{b.label}</td>
                      <td data-label="Category">Stock</td>
                      <td className="mono" data-label="Budgeted">
                        {budgetedQty} {b.unit ?? ""} &times; {unitPrice.toLocaleString()} Br = {budgetedCost.toLocaleString()} Br
                      </td>
                      <td className="mono" data-label="Actual">
                        {actualQty} {b.unit ?? ""} &times; {unitPrice.toLocaleString()} Br = {actualCost.toLocaleString()} Br
                      </td>
                      <td
                        className="mono"
                        data-label="Variance (Br)"
                        style={{ color: variance > 0 ? "var(--danger)" : variance < 0 ? "var(--success)" : undefined }}
                      >
                        {variance.toLocaleString()}
                      </td>
                    </tr>
                  );
                }

                const budgetedETB = toNumber(b.amount);
                const actualETB = matched ? actualExpenseAmount(matched) : 0;
                const variance = round2(actualETB - budgetedETB);
                return (
                  <tr key={b.id}>
                    <td data-label="Item">{b.label}</td>
                    <td data-label="Category">Cash</td>
                    <td className="mono" data-label="Budgeted">{budgetedETB.toLocaleString()} Br</td>
                    <td className="mono" data-label="Actual">{actualETB.toLocaleString()} Br</td>
                    <td
                      className="mono"
                      data-label="Variance (Br)"
                      style={{ color: variance > 0 ? "var(--danger)" : variance < 0 ? "var(--success)" : undefined }}
                    >
                      {variance.toLocaleString()}
                    </td>
                  </tr>
                );
              })}

              {/* Purchases added directly in Expenses, never pulled from a
                  budget line — given their own row (Budgeted "—") so real
                  spending outside the plan is never silently missing from
                  this review just because it has no budget line to join to. */}
              {unbudgetedPurchases.map((e) => {
                const isStock = e.category === "stock";
                const qty = toNumber(e.qty);
                const unitPrice = toNumber(e.unitPrice);
                const cost = isStock ? round2(qty * unitPrice) : actualExpenseAmount(e);
                return (
                  <tr key={e.id}>
                    <td data-label="Item">
                      {e.item}
                      <div className="label" style={{ marginTop: 2 }}>Not budgeted</div>
                    </td>
                    <td data-label="Category">{isStock ? "Stock" : "Cash"}</td>
                    <td className="mono" data-label="Budgeted">&mdash;</td>
                    <td className="mono" data-label="Actual">
                      {isStock
                        ? `${qty} ${e.unit ?? ""} × ${unitPrice.toLocaleString()} Br = ${cost.toLocaleString()} Br`
                        : `${cost.toLocaleString()} Br`}
                    </td>
                    <td className="mono" data-label="Variance (Br)" style={{ color: "var(--danger)" }}>
                      {cost.toLocaleString()}
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
          <div className="label" style={{ marginBottom: 8 }}>Total Withholding: {stats.totalWithholding.toLocaleString()} Br</div>
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
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <ChecklistToggle
                jobId={job.id}
                field="checklistWithholdingCollected"
                checked={job.checklistWithholdingCollected}
                label="Withholding Collected"
                editable={canReconcile}
              />
              <ChecklistImageUpload jobId={job.id} itemKey="withholding" images={imagesFor("withholding")} editable={canReconcile} />
            </div>
            <div>
              <ChecklistToggle
                jobId={job.id}
                field="checklistReceiptAttached"
                checked={job.checklistReceiptAttached}
                label="Expense Receipts Received"
                editable={canReconcile}
              />
              <ChecklistImageUpload jobId={job.id} itemKey="receipts" images={imagesFor("receipts")} editable={canReconcile} />
            </div>
            <div>
              <ChecklistToggle
                jobId={job.id}
                field="checklistVatReceiptIssued"
                checked={job.checklistVatReceiptIssued}
                label="Issue VAT Receipt (if applicable)"
                editable={canReconcile}
              />
              <ChecklistImageUpload jobId={job.id} itemKey="vat" images={imagesFor("vat")} editable={canReconcile} />
            </div>
            <div>
              <ChecklistToggle
                jobId={job.id}
                field="checklistBudgetVarianceSettled"
                checked={job.checklistBudgetVarianceSettled}
                label="Receive or Pay the Overbudget/Underbudget"
                editable={canReconcile}
              />
              <ChecklistImageUpload jobId={job.id} itemKey="variance" images={imagesFor("variance")} editable={canReconcile} />
            </div>
            <div>
              <ChecklistToggle
                jobId={job.id}
                field="checklistRemainingPaymentReceived"
                checked={job.checklistRemainingPaymentReceived}
                label="Remaining Payment Received"
                editable={canReconcile}
              />
              <ChecklistImageUpload jobId={job.id} itemKey="remainingPayment" images={imagesFor("remainingPayment")} editable={canReconcile} />
            </div>
          </div>

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
