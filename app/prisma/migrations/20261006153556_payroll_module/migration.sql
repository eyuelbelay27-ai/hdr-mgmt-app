-- CreateTable
CREATE TABLE "PayrollEmployee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salary" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDebt" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollDebt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "hoursPerMonth" DECIMAL(6,2) NOT NULL DEFAULT 208,
    "otNormalMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.5,
    "otNightMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.75,
    "otRestDayMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "otHolidayMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 2.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "salary" DECIMAL(14,2) NOT NULL,
    "hoursPerMonth" DECIMAL(6,2) NOT NULL,
    "otNormalMultiplier" DECIMAL(5,2) NOT NULL,
    "otNightMultiplier" DECIMAL(5,2) NOT NULL,
    "otRestDayMultiplier" DECIMAL(5,2) NOT NULL,
    "otHolidayMultiplier" DECIMAL(5,2) NOT NULL,
    "otNormalHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "otNightHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "otRestDayHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "otHolidayHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "debtRepayment" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollDebt_employeeId_idx" ON "PayrollDebt"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollEntry_year_month_idx" ON "PayrollEntry"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_employeeId_year_month_key" ON "PayrollEntry"("employeeId", "year", "month");

-- AddForeignKey
ALTER TABLE "PayrollDebt" ADD CONSTRAINT "PayrollDebt_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PayrollEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PayrollEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
