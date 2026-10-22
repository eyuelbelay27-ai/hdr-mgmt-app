-- CreateTable
CREATE TABLE "PricingStore" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingStore_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PricingCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PricingCounter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PricingSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "pinHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("id")
);

-- Grant the new Pricing page to existing Admins (other roles get it via Users → Permissions).
UPDATE "User"
SET "pages" = "pages" || '{"pricing": true}'::jsonb
WHERE "role" = 'Admin';
