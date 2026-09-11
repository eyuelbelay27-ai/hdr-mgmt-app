import { prisma } from "@/lib/prisma";
import { can, type PermissionSubject } from "@/lib/permissions";
import { getStockMaterials } from "@/lib/materials";
import { POBoard } from "./POBoard";
import { PO_PAGE_SIZE, toListItem } from "./poListData";

/** Embedded directly as the Dashboard's Purchase Orders tab content (Section 8.7), not a separate nav page. */
export async function PurchaseOrdersPanel({ user }: { user: PermissionSubject }) {
  const rows = await prisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" }, take: PO_PAGE_SIZE + 1 });
  const hasMore = rows.length > PO_PAGE_SIZE;
  const orders = rows.slice(0, PO_PAGE_SIZE).map(toListItem);
  const stockMaterials = await getStockMaterials();

  return (
    <POBoard
      initialOrders={orders}
      initialHasMore={hasMore}
      stockMaterials={stockMaterials}
      canCreate={can(user, "submitPurchaseOrder")}
      canApprove={can(user, "approvePurchaseOrder")}
      canRevert={can(user, "revertPurchaseOrderApproval")}
      canUploadReceipt={can(user, "uploadPurchaseOrderReceipt")}
      canAudit={can(user, "auditPurchaseOrder")}
      canDelete={can(user, "deletePurchaseOrder")}
    />
  );
}
