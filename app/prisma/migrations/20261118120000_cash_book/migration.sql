
-- CreateEnum
CREATE TYPE "CashBookType" AS ENUM ('in', 'out');

-- CreateTable
CREATE TABLE "CashBookEntry" (
    "id" TEXT NOT NULL,
    "type" "CashBookType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "category" TEXT,
    "ref" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashBookSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "banks" TEXT[],
    "categories" TEXT[],
    "opening" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingDate" DATE,
    "company" TEXT NOT NULL DEFAULT 'Hadar Trading PLC',
    "address" TEXT NOT NULL DEFAULT 'Hayahulet, Bata Complex Building, 2nd Floor, Addis Ababa',
    "preparedBy" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashBookSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashBookEntry_date_idx" ON "CashBookEntry"("date");


-- Admins get the new page.
UPDATE "User" SET "pages" = "pages" || '{"cashbook": true}'::jsonb WHERE "role" = 'Admin';
