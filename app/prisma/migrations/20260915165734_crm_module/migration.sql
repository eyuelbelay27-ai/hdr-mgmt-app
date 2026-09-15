-- CreateEnum
CREATE TYPE "CrmLeadStatus" AS ENUM ('Unseen', 'Seen', 'Unreachable', 'Closed', 'Failed');

-- CreateTable
CREATE TABLE "CrmLead" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "source" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "CrmLeadStatus" NOT NULL DEFAULT 'Unseen',
    "seenAt" TIMESTAMP(3),
    "saleAmount" DECIMAL(14,2),
    "profit" DECIMAL(14,2),
    "failureNote" TEXT,
    "assignedToId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "reportDay" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmWeeklyReport" (
    "id" TEXT NOT NULL,
    "repId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadsWorked" INTEGER NOT NULL,
    "closedCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,
    "unreachableCount" INTEGER NOT NULL,
    "totalSale" DECIMAL(14,2) NOT NULL,
    "totalProfit" DECIMAL(14,2) NOT NULL,
    "rows" JSONB NOT NULL,

    CONSTRAINT "CrmWeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmLead_assignedToId_idx" ON "CrmLead"("assignedToId");

-- CreateIndex
CREATE INDEX "CrmLead_receivedAt_idx" ON "CrmLead"("receivedAt");

-- CreateIndex
CREATE INDEX "CrmLead_status_idx" ON "CrmLead"("status");

-- CreateIndex
CREATE INDEX "CrmWeeklyReport_repId_idx" ON "CrmWeeklyReport"("repId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmWeeklyReport_repId_weekEnd_key" ON "CrmWeeklyReport"("repId", "weekEnd");

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWeeklyReport" ADD CONSTRAINT "CrmWeeklyReport_repId_fkey" FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
