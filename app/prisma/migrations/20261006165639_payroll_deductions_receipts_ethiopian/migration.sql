-- AlterTable
ALTER TABLE "PayrollEntry" ADD COLUMN     "receiptKind" TEXT,
ADD COLUMN     "receiptName" TEXT,
ADD COLUMN     "receiptUrl" TEXT;

-- CreateTable
CREATE TABLE "PayrollDeduction" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollDeduction_year_month_idx" ON "PayrollDeduction"("year", "month");

-- CreateIndex
CREATE INDEX "PayrollDeduction_employeeId_idx" ON "PayrollDeduction"("employeeId");

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PayrollEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payroll months switch from the Gregorian to the Ethiopian calendar. Each
-- existing row moves to the Ethiopian month that contains the 1st day of its
-- Gregorian month (e.g. October 2026 -> Meskerem 2019, since Oct 1 2026 is
-- Meskerem 21). Only the year/month labels change; every amount is kept.
-- Conversion goes through the Julian Day Number (Amete Mihret epoch 1723856),
-- the same arithmetic as lib/payroll/ethiopian.ts.
UPDATE "PayrollEntry" e
SET "year" = c.ey, "month" = c.em
FROM (
  SELECT id,
         4 * (k / 1461) + (r / 365) - (r / 1460) AS ey,
         ((r % 365) + 365 * (r / 1460)) / 30 + 1 AS em
  FROM (
    SELECT id, k, k % 1461 AS r
    FROM (
      SELECT id, to_char(make_date("year", "month", 1), 'J')::int - 1723856 AS k
      FROM "PayrollEntry"
    ) jdn
  ) parts
) c
WHERE e.id = c.id;
