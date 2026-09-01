-- AlterTable
ALTER TABLE "BudgetItem" ADD COLUMN     "costEstimateItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BudgetItem_costEstimateItemId_key" ON "BudgetItem"("costEstimateItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CostEstimateItem_jobId_materialId_key" ON "CostEstimateItem"("jobId", "materialId");

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_costEstimateItemId_fkey" FOREIGN KEY ("costEstimateItemId") REFERENCES "CostEstimateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
