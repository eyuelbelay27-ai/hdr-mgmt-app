-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "budgetPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "budgetPaidAt" TIMESTAMP(3),
ADD COLUMN     "budgetPaidBy" TEXT,
ADD COLUMN     "chequeDescription" TEXT,
ADD COLUMN     "chequeImageKind" TEXT,
ADD COLUMN     "chequeImageName" TEXT,
ADD COLUMN     "chequeImageUrl" TEXT;
