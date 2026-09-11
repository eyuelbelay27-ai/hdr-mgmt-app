"use client";

import { useState } from "react";
import type { StockMaterial } from "@/lib/materials";
import { CreatePOForm } from "./CreatePOForm";
import { RejectPOControl } from "./RejectPOControl";
import { UndoApprovalControl } from "./UndoApprovalControl";
import { DeletePOControl } from "./DeletePOControl";
import { POReceiptUpload } from "./POReceiptUpload";
import { Lightbox } from "./Lightbox";
import {
  approvePurchaseOrderAction,
  markPurchaseOrderAuditedAction,
  loadMorePurchaseOrdersAction,
} from "./poActions";
import type { POListItem } from "./poListData";

/**
 * Owns the loaded purchase orders as local state, seeded once from the
 * server — same "client owns the list" pattern as Price Database/Overtime.
 * Every row action (Approve/Reject/Undo/Audit/Delete/receipt upload)
 * reports back via a callback instead of relying on a full-panel
 * revalidatePath re-fetch, so Load More's extra pages don't get wiped out
 * by someone else's unrelated action.
 */
export function POBoard({
  initialOrders,
  initialHasMore,
  stockMaterials,
  canApprove,
  canRevert,
  canUploadReceipt,
  canAudit,
  canDelete,
  canCreate,
}: {
  initialOrders: POListItem[];
  initialHasMore: boolean;
  stockMaterials: StockMaterial[];
  canApprove: boolean;
  canRevert: boolean;
  canUploadReceipt: boolean;
  canAudit: boolean;
  canDelete: boolean;
  canCreate: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const showActions = canApprove || canRevert || canAudit || canDelete;

  const handleUpdate = (id: string, patch: Partial<POListItem>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };
  const handleRemove = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };
  const handleCreated = (order: POListItem) => {
    setOrders((prev) => [order, ...prev]);
  };
  const handleLoadMore = async () => {
    setLoadingMore(true);
    const result = await loadMorePurchaseOrdersAction(orders.length);
    setOrders((prev) => [...prev, ...result.orders]);
    setHasMore(result.hasMore);
    setLoadingMore(false);
  };

  const handleApprove = async (poId: string) => {
    await approvePurchaseOrderAction(poId);
    handleUpdate(poId, { status: "Approved" });
  };
  const handleAudit = async (poId: string) => {
    await markPurchaseOrderAuditedAction(poId);
    handleUpdate(poId, { audited: true });
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {canCreate && <CreatePOForm stockMaterials={stockMaterials} onCreated={handleCreated} />}

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
              <td className="mono" data-label="Qty">{po.qty}</td>
              <td className="mono" data-label="Total">{po.total.toLocaleString()}</td>
              <td data-label="Status">{po.status}</td>
              <td data-label="Receipt" data-span={po.status === "Approved" && !po.receiptUrl && canUploadReceipt ? "full" : undefined}>
                {po.receiptUrl ? (
                  <Lightbox file={{ name: po.receiptName ?? "receipt", url: po.receiptUrl, kind: po.receiptKind ?? "" }} size={36} />
                ) : po.status === "Approved" && canUploadReceipt ? (
                  <POReceiptUpload poId={po.id} onUploaded={(receipt) => handleUpdate(po.id, receipt)} />
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
                        <button className="btn btn-sm btn-primary" type="button" onClick={() => handleApprove(po.id)}>
                          Approve
                        </button>
                        <RejectPOControl
                          poId={po.id}
                          onRejected={(note) => handleUpdate(po.id, { status: "Rejected", note })}
                        />
                      </>
                    )}
                    {po.status === "Approved" && canRevert && (
                      <UndoApprovalControl
                        poId={po.id}
                        onReverted={() => handleUpdate(po.id, { status: "Pending", audited: false, auditedBy: null })}
                      />
                    )}
                    {po.status === "Approved" && !po.audited && canAudit && (
                      <button className="btn btn-sm btn-primary" type="button" onClick={() => handleAudit(po.id)}>
                        Mark Audited
                      </button>
                    )}
                    {(po.status === "Pending" || po.status === "Rejected") && canDelete && (
                      <DeletePOControl poId={po.id} onDeleted={() => handleRemove(po.id)} />
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

      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button className="btn btn-sm" type="button" disabled={loadingMore} onClick={handleLoadMore}>
            {loadingMore ? "Loading…" : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
