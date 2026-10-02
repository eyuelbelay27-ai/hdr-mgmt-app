/*
  Warnings:

  - You are about to drop the column `costEstimateNotes` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `costEstimatePriceListKind` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `costEstimatePriceListName` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `costEstimatePriceListUrl` on the `Job` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CommissionMode" AS ENUM ('Percentage', 'Manual');

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "costEstimateNotes",
DROP COLUMN "costEstimatePriceListKind",
DROP COLUMN "costEstimatePriceListName",
DROP COLUMN "costEstimatePriceListUrl",
ADD COLUMN     "costEstimateCommissionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "costEstimateCommissionMode" "CommissionMode" NOT NULL DEFAULT 'Percentage',
ADD COLUMN     "costEstimateCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 7;
