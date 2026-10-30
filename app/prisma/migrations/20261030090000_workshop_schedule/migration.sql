-- CreateTable
CREATE TABLE "WorkshopStore" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "data" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopStore_pkey" PRIMARY KEY ("id")
);

-- Grant the new Workshop Schedule page and its edit permission to existing
-- Admins (others get it via Users → Permissions, view-only or with edit).
UPDATE "User"
SET "pages" = "pages" || '{"workshop": true}'::jsonb,
    "actions" = "actions" || '{"editSchedule": true}'::jsonb,
    "actionViews" = "actionViews" || '{"editSchedule": true}'::jsonb
WHERE "role" = 'Admin';
