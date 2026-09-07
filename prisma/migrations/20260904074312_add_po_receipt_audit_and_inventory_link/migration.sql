-- AlterTable
ALTER TABLE "InventoryEntry" ADD COLUMN     "fromPurchaseOrderId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "audited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auditedAt" TIMESTAMP(3),
ADD COLUMN     "auditedBy" TEXT,
ADD COLUMN     "receiptKind" TEXT,
ADD COLUMN     "receiptName" TEXT,
ADD COLUMN     "receiptUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryEntry_fromPurchaseOrderId_key" ON "InventoryEntry"("fromPurchaseOrderId");

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_fromPurchaseOrderId_fkey" FOREIGN KEY ("fromPurchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

