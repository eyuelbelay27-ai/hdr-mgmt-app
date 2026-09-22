-- CRM v2, step 1 of 3: purely additive. Safe to run with existing data —
-- nothing is removed or cast yet.

-- New pipeline status. Postgres allows adding an enum value outright;
-- existing rows are untouched.
ALTER TYPE "CrmLeadStatus" ADD VALUE 'Ongoing';

-- Flag set by the twice-weekly scheduled check (Section: user request).
ALTER TABLE "CrmLead" ADD COLUMN "dueForReview" BOOLEAN NOT NULL DEFAULT false;

-- CrmSettings gains the twice-weekly reminder schedule. `reportDay` is
-- dropped in step 3, once nothing reads it — dropped alongside the enum
-- recreation rather than here, to keep this step purely additive.
ALTER TABLE "CrmSettings" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CrmSettings" ADD COLUMN "day1" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "CrmSettings" ADD COLUMN "hour1" INTEGER NOT NULL DEFAULT 17;
ALTER TABLE "CrmSettings" ADD COLUMN "day2" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "CrmSettings" ADD COLUMN "hour2" INTEGER NOT NULL DEFAULT 17;
