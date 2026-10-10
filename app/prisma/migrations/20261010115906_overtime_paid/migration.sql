-- AlterTable
ALTER TABLE "OvertimeRequest" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidBy" TEXT;

-- The new "markOvertimePaid" permission is Admin-only by default. Existing
-- users' permissions are stored per user, so grant it to current Admins here
-- (new users get it from the role defaults). Nobody else is touched.
UPDATE "User"
SET "actions" = "actions" || '{"markOvertimePaid": true}'::jsonb,
    "actionViews" = "actionViews" || '{"markOvertimePaid": true}'::jsonb
WHERE "role" = 'Admin';
