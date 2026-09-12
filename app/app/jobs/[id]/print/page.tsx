import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { canSeePage, canSeeTab } from "@/lib/permissions";
import { STATUS_LABEL } from "@/lib/job-status";
import { costEstimateTotals } from "@/lib/calc/cost-estimate";
import { totalAllocatedCash } from "@/lib/calc/budget";
import { actualTotalExpenses, actualExpenseAmount, finalProfitAfterExpenses } from "@/lib/calc/reconciliation";
import { remainingPayment } from "@/lib/calc/payments";
import { toNumber } from "@/lib/money";
import { PrintButton } from "./PrintButton";
import { PrintPlate } from "./PrintPlate";
import { HadarMark } from "../../../Logo";
import { Lightbox } from "../../../Lightbox";

const ACTIVITY_PRINT_LIMIT = 15;

const isImage = (kind: string | null | undefined) => (kind ?? "").startsWith("image/");

/**
 * Full job record. Originally Closed-only (Section 6/8.2), now available
 * from the moment a job is submitted for approval onward — i.e. any status
 * except Draft — so it can be downloaded/printed at any later stage, not
 * only once fully closed out. Uses window.print() per Section 9/10 — real
 * PDF export is an open decision the brief defers to the business owner.
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
      checklistImages: true,
      activity: { orderBy: { ts: "asc" } },
    },
  });
  if (!job) notFound();
  if (job.status === "Draft") redirect(`/jobs/${id}`);

  // Printed large at the end rather than inline, so the job's numbers stay
  // on the first pages and whoever only needs those can stop printing there.
  const artworkPlates = job.components.filter((c) => c.artUrl && isImage(c.artKind));
  const cutListPlates = job.cutFiles.filter((f) => isImage(f.kind));

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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <HadarMark size={32} />
          <span style={{ fontWeight: 700, fontSize: 15, color: "#221c1f" }}>Hadar Advertising</span>
        </div>
        <h1>{job.jobNumber} — {job.clientName}</h1>
        <p className="label">
          {job.title} ·{" "}
          {job.status === "Closed"
            ? `Closed ${job.monitoringClosedAt?.toISOString().slice(0, 10)} by ${job.monitoringClosedBy}`
            : STATUS_LABEL[job.status]}
        </p>

        <h2>Client</h2>
        <table className="dtable">
          <tbody>
            <tr><td className="label">Contact</td><td>{job.clientContact || "—"}</td></tr>
            <tr><td className="label">Phone</td><td>{job.clientPhone || "—"}</td></tr>
            <tr><td className="label">Address</td><td>{job.clientAddress || "—"}</td></tr>
            <tr><td className="label">Designer</td><td>{job.designer || "—"}</td></tr>
          </tbody>
        </table>

        <h2>Design</h2>
        <table className="dtable">
          <thead><tr><th>Component</th><th>Size</th><th>Qty</th><th>LED</th><th>Art</th></tr></thead>
          <tbody>
            {job.components.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{String(c.width)}m × {String(c.height)}m</td>
                <td>{c.qty}</td>
                <td>{c.ledColor || "—"}</td>
                <td>
                  {c.artUrl ? (
                    <Lightbox file={{ name: c.artName ?? "art", url: c.artUrl, kind: c.artKind ?? "" }} size={40} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {job.components.length === 0 && <tr><td colSpan={5} className="label">None.</td></tr>}
          </tbody>
        </table>

        {job.cutFiles.length > 0 && (
          <>
            <h2>Cut List</h2>
            <table className="dtable">
              <thead><tr><th>File</th><th>Preview</th></tr></thead>
              <tbody>
                {job.cutFiles.map((f) => (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td>
                      <Lightbox file={{ name: f.name, url: f.url, kind: f.kind ?? "" }} size={40} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

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
        <p>Sub Total: {totals.subTotal.toLocaleString()} Br</p>
        {canSeeFinancials && (
          <>
            <p>Commission: {totals.commission.toLocaleString()} Br</p>
            <p>Sold Price: {totals.grandTotal.toLocaleString()} Br</p>
            <p>Profit: {totals.profit.toLocaleString()} Br</p>
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
        <p>Total Allocated (Cash): {allocated.toLocaleString()} Br</p>

        <h2>Expenses</h2>
        <table className="dtable">
          <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Total</th><th>Withholding</th><th>Receipt</th></tr></thead>
          <tbody>
            {job.expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.date.toISOString().slice(0, 10)}</td>
                <td>{e.item}</td>
                <td>{e.entryType === "purchase" ? "Purchase" : "Receipt"}</td>
                <td className="mono">{actualExpenseAmount(e).toLocaleString()}</td>
                <td className="mono">{toNumber(e.withholding).toLocaleString()}</td>
                <td>
                  {e.receiptUrl ? (
                    <Lightbox file={{ name: e.receiptName ?? "receipt", url: e.receiptUrl, kind: e.receiptKind ?? "" }} size={40} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Actual Total Expenses: {actual.toLocaleString()} Br</p>

        {canSeeFinancials && (
          <>
            <h2>Payments</h2>
            <table className="dtable">
              <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Receipt</th></tr></thead>
              <tbody>
                {job.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.date.toISOString().slice(0, 10)}</td>
                    <td>{p.type}</td>
                    <td className="mono">{toNumber(p.amount).toLocaleString()}</td>
                    <td>
                      {p.receiptUrl ? (
                        <Lightbox file={{ name: p.receiptName ?? "receipt", url: p.receiptUrl, kind: p.receiptKind ?? "" }} size={40} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Remaining Payment: {remaining.toLocaleString()} Br</p>
            <p><strong>Final Profit After Expenses: {finalProfit.toLocaleString()} Br</strong></p>
          </>
        )}

        {job.checklistImages.length > 0 && (
          <>
            <h2>Reconciliation Checklist</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {job.checklistImages.map((img) => (
                <Lightbox key={img.id} file={{ name: img.name, url: img.url, kind: img.kind }} size={48} />
              ))}
            </div>
          </>
        )}

        <h2>Activity</h2>
        <table className="dtable">
          <tbody>
            {job.activity.slice(-ACTIVITY_PRINT_LIMIT).map((a) => (
              <tr key={a.id}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{a.ts.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td>{a.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {job.activity.length > ACTIVITY_PRINT_LIMIT && (
          <p className="label">
            + {job.activity.length - ACTIVITY_PRINT_LIMIT} earlier entries not shown — see the Activity tab in the app for the full history.
          </p>
        )}

        {(artworkPlates.length > 0 || cutListPlates.length > 0) && (
          <div className="print-attachments">
            {artworkPlates.length > 0 && (
              <>
                <h2>Design Artwork</h2>
                {artworkPlates.map((c) => (
                  <PrintPlate
                    key={c.id}
                    size="half"
                    caption={`${c.name} — ${String(c.width)}m × ${String(c.height)}m${c.ledColor ? ` · ${c.ledColor}` : ""}`}
                    file={{ name: c.artName ?? "artwork", url: c.artUrl as string }}
                  />
                ))}
              </>
            )}

            {cutListPlates.map((f) => (
              <PrintPlate
                key={f.id}
                size="full"
                caption={`Cut List — ${f.name}`}
                file={{ name: f.name, url: f.url }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
