import { prisma } from "@/lib/prisma";
import { can, type PermissionSubject } from "@/lib/permissions";
import { toNumber } from "@/lib/money";
import { CreatePOForm } from "./CreatePOForm";
import { RejectPOControl } from "./RejectPOControl";
import { UndoApprovalControl } from "./UndoApprovalControl";
import { DeletePOControl } from "./DeletePOControl";
import { POReceiptUpload } from "./POReceiptUpload";
import { Lightbox } from "./Lightbox";
import { approvePurchaseOrderAction, markPurchaseOrderAuditedAction } from "./poActions";

/** Embedded directly as the Dashboard's Purchase Orders tab content (Section 8.7), not a separate nav page. */
export async function PurchaseOrdersPanel({ user }: { user: PermissionSubject }) {
  const orders = await prisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" } });
  const canApprove = can(user, "approvePurchaseOrder");
  const canRevert = can(user, "revertPurchaseOrderApproval");
  const canUploadReceipt = can(user, "uploadPurchaseOrderReceipt");
  const canAudit = can(user, "auditPurchaseOrder");
  const canDelete = can(user, "deletePurchaseOrder");
  const showActions = canApprove || canRevert || canAudit || canDelete;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {can(user, "submitPurchaseOrder") && <CreatePOForm />}

      <div className="card dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>PO #</th><th>Date</th><th>Purchaser</th><th>Item</th><th>Category</th>
            <th>Qty</th><th>Total</th><th>Status</th><th>Receipt</th><th>Audited</th><th>Note</th>
            {showActions && <th />}
          </tr>
        </thead>
        <tbody>
          {orders.map((po) => (
            <tr key={po.id}>
              <td className="mono" data-label="PO #">{po.poNumber}</td>
              <td data-label="Date">{po.date.toISOString().slice(0, 10)}</td>
              <td data-label="Purchaser">{po.purchaser}</td>
              <td data-label="Item">{po.item}</td>
              <td data-label="Category">{po.category === "cash" ? "Cash" : "Stock"}</td>
              <td className="mono" data-label="Qty">{String(po.qty)}</td>
              <td className="mono" data-label="Total">{toNumber(po.total).toLocaleString()}</td>
              <td data-label="Status">{po.status}</td>
              <td data-label="Receipt" data-span={po.status === "Approved" && !po.receiptUrl && canUploadReceipt ? "full" : undefined}>
                {po.receiptUrl ? (
                  <Lightbox file={{ name: po.receiptName ?? "receipt", url: po.receiptUrl, kind: po.receiptKind ?? "" }} size={36} />
                ) : po.status === "Approved" && canUploadReceipt ? (
                  <POReceiptUpload poId={po.id} />
                ) : (
                  "—"
                )}
              </td>
              <td data-label="Audited">{po.audited ? `Yes — ${po.auditedBy ?? ""}` : "—"}</td>
              <td data-label="Note">{po.note ?? "—"}</td>
              {showActions && (
                <td data-label="Actions" data-span="full">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {po.status === "Pending" && canApprove && (
                      <>
                        <form action={approvePurchaseOrderAction.bind(null, po.id)}>
                          <button className="btn btn-sm btn-primary" type="submit">Approve</button>
                        </form>
                        <RejectPOControl poId={po.id} />
                      </>
                    )}
                    {po.status === "Approved" && canRevert && <UndoApprovalControl poId={po.id} />}
                    {po.status === "Approved" && !po.audited && canAudit && (
                      <form action={markPurchaseOrderAuditedAction.bind(null, po.id)}>
                        <button className="btn btn-sm btn-primary" type="submit">Mark Audited</button>
                      </form>
                    )}
                    {(po.status === "Pending" || po.status === "Rejected") && canDelete && (
                      <DeletePOControl poId={po.id} />
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td className="label" colSpan={12}>No purchase orders yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
