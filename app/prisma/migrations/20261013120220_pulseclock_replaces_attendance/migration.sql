/*
  Warnings:

  - You are about to drop the `AttendanceDevice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AttendanceProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AttendanceRecord` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AttendanceSettings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AttendanceDevice" DROP CONSTRAINT "AttendanceDevice_authorizedById_fkey";

-- DropForeignKey
ALTER TABLE "AttendanceProfile" DROP CONSTRAINT "AttendanceProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_userId_fkey";

-- DropTable
DROP TABLE "AttendanceDevice";

-- DropTable
DROP TABLE "AttendanceProfile";

-- DropTable
DROP TABLE "AttendanceRecord";

-- DropTable
DROP TABLE "AttendanceSettings";

-- CreateTable
CREATE TABLE "PulseEmployee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "descriptor" JSONB,
    "referencePhotoUrl" TEXT,
    "referencePhotoName" TEXT,
    "enrolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PulseEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PulseAttendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "late" BOOLEAN NOT NULL DEFAULT false,
    "early" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'face',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PulseAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PulseLeave" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PulseLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PulseHoliday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PulseHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PulseAudit" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PulseAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PulseSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "shiftStartMin" INTEGER NOT NULL DEFAULT 510,
    "shiftEndMin" INTEGER NOT NULL DEFAULT 1050,
    "graceMin" INTEGER NOT NULL DEFAULT 30,
    "workDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "adminPinHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PulseSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PulseAttendance_workDate_idx" ON "PulseAttendance"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "PulseAttendance_employeeId_workDate_key" ON "PulseAttendance"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "PulseLeave_date_idx" ON "PulseLeave"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PulseHoliday_date_key" ON "PulseHoliday"("date");

-- CreateIndex
CREATE INDEX "PulseAudit_createdAt_idx" ON "PulseAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "PulseAttendance" ADD CONSTRAINT "PulseAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PulseEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PulseLeave" ADD CONSTRAINT "PulseLeave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PulseEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permissions: the old Attendance page/action are gone; current Admin-role
-- users get the new PulseClock page (others are granted it from Users).
UPDATE "User"
SET "pages" = ("pages" - 'attendance') || CASE WHEN "role" = 'Admin' THEN '{"pulseclock": true}'::jsonb ELSE '{}'::jsonb END,
    "actions" = "actions" - 'manageAttendance',
    "actionViews" = "actionViews" - 'manageAttendance';
