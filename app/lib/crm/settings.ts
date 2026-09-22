import { prisma } from "@/lib/prisma";
import { normalizeSchedule, type CrmSchedule } from "./schedule";

/** A single CrmSettings row; falls back to the schema's own defaults
 * (enabled, Wed & Fri at 5pm) if the row was never created. */
export async function getCrmSchedule(): Promise<CrmSchedule> {
  const s = await prisma.crmSettings.findUnique({ where: { id: "singleton" } });
  return normalizeSchedule(
    s ?? { enabled: true, day1: 3, hour1: 17, day2: 5, hour2: 17 }
  );
}
