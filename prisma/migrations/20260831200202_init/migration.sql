-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Designer', 'Supervisor', 'Manager', 'OwnerFinance', 'Admin');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('Draft', 'WaitingForApproval', 'ApprovedBudget', 'WaitingForReconciliation', 'Closed', 'Cancelled');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('Draft', 'Approved');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('cash', 'stock');

-- CreateEnum
CREATE TYPE "CostEstimateSource" AS ENUM ('Manual', 'PriceDatabase');

-- CreateEnum
CREATE TYPE "BudgetItemSource" AS ENUM ('Manual', 'CostEstimate');

-- CreateEnum
CREATE TYPE "ExpenseEntryType" AS ENUM ('purchase', 'receipt');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('Manual', 'Budget');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('Advance', 'Final', 'Other');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('Pending', 'Reconciled', 'Flagged');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "InventoryDirection" AS ENUM ('in', 'out');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "actions" JSONB NOT NULL DEFAULT '{}',
    "actionViews" JSONB NOT NULL DEFAULT '{}',
    "pages" JSONB NOT NULL DEFAULT '{}',
    "tabs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(14,2),
    "defaultQty" DECIMAL(14,3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPriceHistory" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "oldPrice" DECIMAL(14,2),
    "newPrice" DECIMAL(14,2),
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,

    CONSTRAINT "MaterialPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'Draft',
    "previousStatus" "JobStatus",
    "deadline" TIMESTAMP(3),
    "revisionNote" TEXT,
    "revisionNoteBy" TEXT,
    "adminUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "clientName" TEXT NOT NULL,
    "clientContact" TEXT,
    "clientPhone" TEXT,
    "clientAddress" TEXT,
    "clientNotes" TEXT,
    "title" TEXT NOT NULL,
    "designer" TEXT,
    "supervisor" TEXT,
    "productionNotes" TEXT,
    "costEstimatePreparedBy" TEXT,
    "costEstimateGeneratedAt" TIMESTAMP(3),
    "costEstimateNotes" TEXT,
    "costEstimateSoldPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costEstimateCommissionActive" BOOLEAN NOT NULL DEFAULT false,
    "budgetStatus" "BudgetStatus" NOT NULL DEFAULT 'Draft',
    "budgetApprovedBy" TEXT,
    "budgetApprovedAt" TIMESTAMP(3),
    "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'Pending',
    "reconciliationNote" TEXT,
    "reconciledBy" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "checklistWithholdingCollected" BOOLEAN NOT NULL DEFAULT false,
    "checklistReceiptAttached" BOOLEAN NOT NULL DEFAULT false,
    "monitoringClosed" BOOLEAN NOT NULL DEFAULT false,
    "monitoringClosedAt" TIMESTAMP(3),
    "monitoringClosedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobComponent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" DECIMAL(10,3) NOT NULL,
    "height" DECIMAL(10,3) NOT NULL,
    "qty" INTEGER NOT NULL,
    "ledColor" TEXT,
    "artName" TEXT,
    "artUrl" TEXT,
    "artKind" TEXT,

    CONSTRAINT "JobComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CutFile" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CutFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostEstimateItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "materialId" TEXT,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "source" "CostEstimateSource" NOT NULL,
    "comment" TEXT,

    CONSTRAINT "CostEstimateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "amount" DECIMAL(14,2),
    "qty" DECIMAL(14,3),
    "unit" TEXT,
    "comment" TEXT,
    "source" "BudgetItemSource" NOT NULL,
    "materialId" TEXT,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "entryType" "ExpenseEntryType" NOT NULL,
    "category" "ItemCategory",
    "source" "ExpenseSource" NOT NULL,
    "purchaser" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "item" TEXT NOT NULL,
    "description" TEXT,
    "qty" DECIMAL(14,3),
    "unit" TEXT,
    "unitPrice" DECIMAL(14,2),
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "budgetRef" TEXT,
    "withholding" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "actualSpent" DECIMAL(14,3),
    "receiptName" TEXT,
    "receiptUrl" TEXT,
    "receiptKind" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "type" "PaymentType" NOT NULL,
    "method" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "receiptName" TEXT,
    "receiptUrl" TEXT,
    "receiptKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEntry" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,

    CONSTRAINT "ActivityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'Pending',
    "date" TIMESTAMP(3) NOT NULL,
    "purchaser" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "description" TEXT,
    "category" "ItemCategory" NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderHistoryEntry" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,

    CONSTRAINT "PurchaseOrderHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "direction" "InventoryDirection" NOT NULL,
    "materialId" TEXT,
    "itemName" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unit" TEXT,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "jobId" TEXT,
    "adjustmentForExpenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "withholdingRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "withholdingThreshold" DECIMAL(14,2) NOT NULL DEFAULT 20000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "MaterialPriceHistory_materialId_idx" ON "MaterialPriceHistory"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");

-- CreateIndex
CREATE INDEX "JobComponent_jobId_idx" ON "JobComponent"("jobId");

-- CreateIndex
CREATE INDEX "CutFile_jobId_idx" ON "CutFile"("jobId");

-- CreateIndex
CREATE INDEX "CostEstimateItem_jobId_idx" ON "CostEstimateItem"("jobId");

-- CreateIndex
CREATE INDEX "BudgetItem_jobId_idx" ON "BudgetItem"("jobId");

-- CreateIndex
CREATE INDEX "Expense_jobId_idx" ON "Expense"("jobId");

-- CreateIndex
CREATE INDEX "Payment_jobId_idx" ON "Payment"("jobId");

-- CreateIndex
CREATE INDEX "ActivityEntry_jobId_idx" ON "ActivityEntry"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderHistoryEntry_purchaseOrderId_idx" ON "PurchaseOrderHistoryEntry"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryEntry_adjustmentForExpenseId_key" ON "InventoryEntry"("adjustmentForExpenseId");

-- CreateIndex
CREATE INDEX "InventoryEntry_materialId_idx" ON "InventoryEntry"("materialId");

-- CreateIndex
CREATE INDEX "InventoryEntry_jobId_idx" ON "InventoryEntry"("jobId");

-- AddForeignKey
ALTER TABLE "MaterialPriceHistory" ADD CONSTRAINT "MaterialPriceHistory_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPriceHistory" ADD CONSTRAINT "MaterialPriceHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobComponent" ADD CONSTRAINT "JobComponent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CutFile" ADD CONSTRAINT "CutFile_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEstimateItem" ADD CONSTRAINT "CostEstimateItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEstimateItem" ADD CONSTRAINT "CostEstimateItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderHistoryEntry" ADD CONSTRAINT "PurchaseOrderHistoryEntry_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_adjustmentForExpenseId_fkey" FOREIGN KEY ("adjustmentForExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
