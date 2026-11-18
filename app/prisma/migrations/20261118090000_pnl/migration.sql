-- CreateEnum
CREATE TYPE "PnlAccountType" AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');

-- CreateEnum
CREATE TYPE "PnlEntryKind" AS ENUM ('in', 'out');

-- CreateTable
CREATE TABLE "PnlAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PnlAccountType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PnlAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PnlEntry" (
    "id" TEXT NOT NULL,
    "kind" "PnlEntryKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "cashId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "ref" TEXT,
    "receiptName" TEXT,
    "receiptUrl" TEXT,
    "receiptKind" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PnlEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PnlAccount_name_key" ON "PnlAccount"("name");

-- CreateIndex
CREATE INDEX "PnlEntry_date_idx" ON "PnlEntry"("date");

-- AddForeignKey
ALTER TABLE "PnlEntry" ADD CONSTRAINT "PnlEntry_cashId_fkey" FOREIGN KEY ("cashId") REFERENCES "PnlAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PnlEntry" ADD CONSTRAINT "PnlEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PnlAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The P&L page is for existing Admins only (others can be given it in Users → Permissions).
UPDATE "User"
SET "pages" = "pages" || '{"pnl": true}'::jsonb
WHERE "role" = 'Admin';
