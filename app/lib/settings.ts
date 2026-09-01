import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";

/** Section 8.9 — a single Settings row; falls back to Section 7.1's defaults if never created. */
export async function getSettings() {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" } });
  return {
    withholdingRatePercent: s ? toNumber(s.withholdingRatePercent) : 3,
    withholdingThreshold: s ? toNumber(s.withholdingThreshold) : 20000,
  };
}
