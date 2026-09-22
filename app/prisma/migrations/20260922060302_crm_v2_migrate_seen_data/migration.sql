-- CRM v2, step 2 of 3: move any lead still sitting at the old "Seen"
-- status onto "Ongoing" — the closest equivalent now that seeing a lead
-- is a one-time phone reveal, not a pipeline state. Must run as its own
-- migration, after step 1 has committed the new "Ongoing" enum value
-- (Postgres won't let a value be used in the same transaction that added
-- it) and before step 3 removes "Seen" from the enum entirely.
UPDATE "CrmLead" SET status = 'Ongoing' WHERE status = 'Seen';
