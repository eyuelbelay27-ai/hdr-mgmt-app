-- All materials must be active unless deleted — the Active toggle is gone
-- from the UI, so every existing row (many were left Inactive from before
-- that rule existed) needs to be backfilled to true or it would silently
-- stay hidden from every picker forever with no way to turn it back on.
UPDATE "Material" SET active = true WHERE active = false;
