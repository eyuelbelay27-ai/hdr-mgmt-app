-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "materialId" TEXT,
ADD COLUMN     "unit" TEXT;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
