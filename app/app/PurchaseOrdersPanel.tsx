import { prisma } from "@/lib/prisma";
import { can, type PermissionSubject } from "@/lib/permissions";
import { toNumber } from "@/lib/money";
import { CreatePOForm } from "./CreatePOForm";
import { RejectPOControl } from "./RejectPOControl";
import { approvePurchaseOrderAction } from "./poActions";

/** Embedded directly as the Dashboard's Purchase Orders tab content (Section 8.7), not a separate nav page. */
export async function PurchaseOrdersPanel({ user }: { user: PermissionSubject }) {
  const orders = await prisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" } });
  const canApprove = can(user, "approvePurchaseOrder");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {can(user, "submitPurchaseOrder") && <CreatePOForm />}

      <table className="dtable">
        <thead>
          <tr>
            <th>PO #</th><th>Date</th><th>Purchaser</th><th>Item</th><th>Category</th>
            <th>Qty</th><th>Total</th><th>Status</th><th>Note</th>{canApprove && <th />}
          </tr>
        </thead>
        <tbody>
          {orders.map((po) => (
            <tr key={po.id}>
              <td className="mono">{po.poNumber}</td>
              <td>{po.date.toISOString().slice(0, 10)}</td>
              <td>{po.purchaser}</td>
              <td>{po.item}</td>
              <td>{po.category === "cash" ? "Cash" : "Stock"}</td>
              <td className="mono">{String(po.qty)}</td>
              <td className="mono">{toNumber(po.total).toLocaleString()}</td>
              <td>{po.status}</td>
              <td>{po.note ?? "—"}</td>
              {canApprove && (
                <td>
                  {po.status === "Pending" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <form action={approvePurchaseOrderAction.bind(null, po.id)}>
                        <button className="btn btn-sm btn-primary" type="submit">Approve</button>
                      </form>
                      <RejectPOControl poId={po.id} />
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td className="label" colSpan={10}>No purchase orders yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
