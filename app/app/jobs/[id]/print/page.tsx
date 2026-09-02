import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canSeePage, canSeeTab } from "@/lib/permissions";
import { costEstimateTotals } from "@/lib/calc/cost-estimate";
import { totalAllocatedCash } from "@/lib/calc/budget";
import { actualTotalExpenses, actualExpenseAmount, finalProfitAfterExpenses } from "@/lib/calc/reconciliation";
import { remainingPayment } from "@/lib/calc/payments";
import { toNumber } from "@/lib/money";
import { PrintButton } from "./PrintButton";

/**
 * Full job record (Section 6: "Closed: fully locked, printable full job
 * record available"; Section 8.2's Print button only appears on Closed
 * jobs). Uses window.print() per Section 9/10 — real PDF export is an
 * open decision the brief defers to the business owner.
 */
export default async function JobPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "jobs")) redirect("/jobs");

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      components: true,
      cutFiles: true,
      costEstimateItems: true,
      budgetItems: true,
      expenses: { orderBy: { date: "asc" } },
      payments: { orderBy: { date: "asc" } },
      activity: { orderBy: { ts: "asc" } },
    },
  });
  if (!job) notFound();
  if (job.status !== "Closed") redirect(`/jobs/${id}`);

  const canSeeFinancials = canSeeTab(user, "tab_payments");
  const totals = costEstimateTotals(job.costEstimateItems, job.costEstimateSoldPrice, job.costEstimateCommissionActive);
  const allocated = totalAllocatedCash(job.budgetItems);
  const actual = actualTotalExpenses(job.expenses);
  const finalProfit = finalProfitAfterExpenses(job.costEstimateSoldPrice, job.expenses, totals.commission);
  const remaining = remainingPayment(job.costEstimateSoldPrice, job.payments);

  return (
    <div style={{ padding: 24 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <a href={`/jobs/${job.id}`} className="label">&larr; Back to Job</a>
        <PrintButton />
      </div>

      <div className="print-sheet card">
        <h1>{job.jobNumber} — {job.clientName}</h1>
        <p className="label">{job.title} · Closed {job.monitoringClosedAt?.toISOString().slice(0, 10)} by {job.monitoringClosedBy}</p>

        <h2>Client</h2>
        <table className="dtable">
          <tbody>
            <tr><td className="label">Contact</td><td>{job.clientContact || "—"}</td></tr>
            <tr><td className="label">Phone</td><td>{job.clientPhone || "—"}</td></tr>
            <tr><td className="label">Address</td><td>{job.clientAddress || "—"}</td></tr>
            <tr><td className="label">Designer</td><td>{job.designer || "—"}</td></tr>
            <tr><td className="label">Supervisor</td><td>{job.supervisor || "—"}</td></tr>
          </tbody>
        </table>

        <h2>Design</h2>
        <table className="dtable">
          <thead><tr><th>Component</th><th>Size</th><th>Qty</th><th>LED</th></tr></thead>
          <tbody>
            {job.components.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{String(c.width)}m × {String(c.height)}m</td>
                <td>{c.qty}</td>
                <td>{c.ledColor || "—"}</td>
              </tr>
            ))}
            {job.components.length === 0 && <tr><td colSpan={4} className="label">None.</td></tr>}
          </tbody>
        </table>

        <h2>Cost Estimate</h2>
        <table className="dtable">
          <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
          <tbody>
            {job.costEstimateItems.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.category === "cash" ? "Cash" : "Stock"}</td>
                <td className="mono">{String(i.qty)}</td>
                <td className="mono">{toNumber(i.unitPrice).toLocaleString()}</td>
                <td className="mono">{toNumber(i.total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Sub Total: {totals.subTotal.toLocaleString()} ETB</p>
        {canSeeFinancials && (
          <>
            <p>Commission: {totals.commission.toLocaleString()} ETB</p>
            <p>Sold Price: {totals.grandTotal.toLocaleString()} ETB</p>
            <p>Profit: {totals.profit.toLocaleString()} ETB</p>
          </>
        )}

        <h2>Budget</h2>
        <table className="dtable">
          <thead><tr><th>Description</th><th>Category</th><th>Amount / Qty+Unit</th></tr></thead>
          <tbody>
            {job.budgetItems.map((b) => (
              <tr key={b.id}>
                <td>{b.label}</td>
                <td>{b.category === "cash" ? "Cash" : "Stock"}</td>
                <td className="mono">{b.category === "stock" ? `${String(b.qty)} ${b.unit ?? ""}` : toNumber(b.amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Total Allocated (Cash): {allocated.toLocaleString()} ETB</p>

        <h2>Expenses</h2>
        <table className="dtable">
          <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Total</th><th>Withholding</th></tr></thead>
          <tbody>
            {job.expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.date.toISOString().slice(0, 10)}</td>
                <td>{e.item}</td>
                <td>{e.entryType === "purchase" ? "Purchase" : "Receipt"}</td>
                <td className="mono">{actualExpenseAmount(e).toLocaleString()}</td>
                <td className="mono">{toNumber(e.withholding).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Actual Total Expenses: {actual.toLocaleString()} ETB</p>

        {canSeeFinancials && (
          <>
            <h2>Payments</h2>
            <table className="dtable">
              <thead><tr><th>Date</th><th>Type</th><th>Amount</th></tr></thead>
              <tbody>
                {job.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.date.toISOString().slice(0, 10)}</td>
                    <td>{p.type}</td>
                    <td className="mono">{toNumber(p.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Remaining Payment: {remaining.toLocaleString()} ETB</p>
            <p><strong>Final Profit After Expenses: {finalProfit.toLocaleString()} ETB</strong></p>
          </>
        )}

        <h2>Activity</h2>
        <table className="dtable">
          <tbody>
            {job.activity.map((a) => (
              <tr key={a.id}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{a.ts.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td>{a.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
