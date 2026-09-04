-- DropForeignKey
ALTER TABLE "InventoryEntry" DROP CONSTRAINT "InventoryEntry_adjustmentForExpenseId_fkey";

-- DropIndex
DROP INDEX "InventoryEntry_adjustmentForExpenseId_key";

-- AlterTable
ALTER TABLE "InventoryEntry" DROP COLUMN "adjustmentForExpenseId",
ADD COLUMN     "expenseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryEntry_expenseId_key" ON "InventoryEntry"("expenseId");

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

