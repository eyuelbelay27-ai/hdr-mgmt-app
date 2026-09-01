-- CreateTable
CREATE TABLE "JobSequence" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobSequence_pkey" PRIMARY KEY ("year")
);
