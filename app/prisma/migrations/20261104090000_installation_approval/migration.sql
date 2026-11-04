-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- CreateTable
CREATE TABLE "InstallationRequest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "InstallationStatus" NOT NULL DEFAULT 'Pending',
    "note" TEXT,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "withholdingName" TEXT,
    "withholdingUrl" TEXT,
    "withholdingKind" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallationPayment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT,
    "receiptName" TEXT NOT NULL,
    "receiptUrl" TEXT NOT NULL,
    "receiptKind" TEXT NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallationPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallationRequest_jobId_idx" ON "InstallationRequest"("jobId");

-- CreateIndex
CREATE INDEX "InstallationRequest_status_idx" ON "InstallationRequest"("status");

-- CreateIndex
CREATE INDEX "InstallationPayment_requestId_idx" ON "InstallationPayment"("requestId");

-- AddForeignKey
ALTER TABLE "InstallationRequest" ADD CONSTRAINT "InstallationRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationRequest" ADD CONSTRAINT "InstallationRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationPayment" ADD CONSTRAINT "InstallationPayment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "InstallationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Grant the new Installation Approval page and both of its permissions to
-- existing Admins (others get them via Users → Permissions).
UPDATE "User"
SET "pages" = "pages" || '{"installation": true}'::jsonb,
    "actions" = "actions" || '{"requestInstallation": true, "approveInstallation": true}'::jsonb,
    "actionViews" = "actionViews" || '{"requestInstallation": true, "approveInstallation": true}'::jsonb
WHERE "role" = 'Admin';
