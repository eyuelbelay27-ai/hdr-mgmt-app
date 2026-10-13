-- PulseClock moved from face-api.js (128-float descriptors) to Human
-- (1024-float faceres embeddings); old references can't be compared, so
-- everyone re-registers on their next check-in. The photo URL is kept so
-- the old photo is deleted when the new one replaces it.
UPDATE "PulseEmployee" SET "descriptor" = NULL, "enrolledAt" = NULL;
