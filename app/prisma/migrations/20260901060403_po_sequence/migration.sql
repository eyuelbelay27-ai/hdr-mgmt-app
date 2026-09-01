-- CreateTable
CREATE TABLE "PoSequence" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PoSequence_pkey" PRIMARY KEY ("year")
);

