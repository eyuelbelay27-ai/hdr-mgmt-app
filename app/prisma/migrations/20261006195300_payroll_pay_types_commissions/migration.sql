-- AlterTable
ALTER TABLE "PayrollEmployee" ADD COLUMN     "payCommission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payOvertime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paySalary" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PayrollEntry" ADD COLUMN     "payCommission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payOvertime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paySalary" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PayrollCommission" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollCommission_entryId_idx" ON "PayrollCommission"("entryId");

-- AddForeignKey
ALTER TABLE "PayrollCommission" ADD CONSTRAINT "PayrollCommission_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
