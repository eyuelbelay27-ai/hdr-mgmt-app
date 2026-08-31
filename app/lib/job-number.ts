import { prisma } from "@/lib/prisma";

/**
 * Atomically allocates the next sequential job number for the current
 * year (e.g. "HAD-2026-0001"). Uses a single INSERT ... ON CONFLICT DO
 * UPDATE ... RETURNING statement so concurrent job creation can never
 * collide — Section 10 flags the prototype's in-memory counter as
 * something production must not copy.
 */
export async function nextJobNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "JobSequence" ("year", "lastNumber") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastNumber" = "JobSequence"."lastNumber" + 1
    RETURNING "lastNumber";
  `;
  const seq = rows[0].lastNumber;
  return `HAD-${year}-${String(seq).padStart(4, "0")}`;
}
