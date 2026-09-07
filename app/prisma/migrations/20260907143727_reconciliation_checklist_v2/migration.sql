-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "checklistBudgetVarianceSettled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "checklistVatReceiptIssued" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ReconciliationChecklistImage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationChecklistImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationChecklistImage_jobId_idx" ON "ReconciliationChecklistImage"("jobId");

-- AddForeignKey
ALTER TABLE "ReconciliationChecklistImage" ADD CONSTRAINT "ReconciliationChecklistImage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
