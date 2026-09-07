-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "budgetItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_budgetItemId_key" ON "Expense"("budgetItemId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

