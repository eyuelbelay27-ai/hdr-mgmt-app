-- CRM v2, step 3 of 3: remove "Seen" from CrmLeadStatus and "reportDay"
-- from CrmSettings, now that step 2 has moved every row off "Seen" and
-- nothing reads "reportDay" anymore (the weekly-report feature it drove
-- was removed). Postgres has no ALTER TYPE ... DROP VALUE, so the enum is
-- recreated: a new type with the desired values, the column recast onto
-- it (safe now — no row can still hold 'Seen'), then the old type dropped.

ALTER TABLE "CrmSettings" DROP COLUMN "reportDay";

CREATE TYPE "CrmLeadStatus_new" AS ENUM ('Unseen', 'Ongoing', 'Unreachable', 'Closed', 'Failed');
ALTER TABLE "CrmLead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CrmLead" ALTER COLUMN "status" TYPE "CrmLeadStatus_new" USING ("status"::text::"CrmLeadStatus_new");
ALTER TABLE "CrmLead" ALTER COLUMN "status" SET DEFAULT 'Unseen';
DROP TYPE "CrmLeadStatus";
ALTER TYPE "CrmLeadStatus_new" RENAME TO "CrmLeadStatus";
