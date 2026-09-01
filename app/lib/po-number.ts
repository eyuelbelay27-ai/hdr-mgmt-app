import { prisma } from "@/lib/prisma";

/** Atomic per-year PO number sequence (e.g. "PO-2026-0001"), same pattern as lib/job-number.ts. */
export async function nextPoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "PoSequence" ("year", "lastNumber") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastNumber" = "PoSequence"."lastNumber" + 1
    RETURNING "lastNumber";
  `;
  const seq = rows[0].lastNumber;
  return `PO-${year}-${String(seq).padStart(4, "0")}`;
}
