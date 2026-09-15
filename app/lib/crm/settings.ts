import { prisma } from "@/lib/prisma";
import { DEFAULT_REPORT_DAY, normalizeReportDay } from "./week";

/** A single CrmSettings row; falls back to the default report day if it was
 * never created (a fresh install, before an Admin visits CRM Settings). */
export async function getCrmSettings(): Promise<{ reportDay: number }> {
  const s = await prisma.crmSettings.findUnique({ where: { id: "singleton" } });
  return { reportDay: s ? normalizeReportDay(s.reportDay) : DEFAULT_REPORT_DAY };
}
