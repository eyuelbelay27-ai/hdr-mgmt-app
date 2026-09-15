import { getCurrentUser } from "@/lib/current-user";
import { getCrmOutstanding } from "@/lib/crm/outstanding";
import { formatDateLabel } from "@/lib/crm/week";

/**
 * A thin strip across the top of every page, shown only while a CRM weekly
 * report is still outstanding. Deliberately not a modal and not sticky: it
 * has to be impossible to miss on the way in, and equally impossible for it
 * to get in the way of the rest of the app.
 *
 * It renders in the root layout, so a failure here would take down every
 * page in the app — hence the catch-all. A missing reminder is a far
 * smaller problem than an unreachable app.
 */
export async function CrmReportBanner() {
  try {
    const user = await getCurrentUser();
    const outstanding = await getCrmOutstanding(user);
    if (!outstanding || outstanding.pendingReps.length === 0) return null;

    const week = formatDateLabel(outstanding.week.end);
    const message = outstanding.selfOwes
      ? `Your CRM weekly report for the week ending ${week} hasn't been generated yet.`
      : `${outstanding.pendingReps.length} CRM weekly report${
          outstanding.pendingReps.length === 1 ? "" : "s"
        } outstanding for the week ending ${week}: ${outstanding.pendingReps.map((r) => r.name).join(", ")}.`;

    return (
      <div className="crm-banner">
        <span className="crm-banner-dot" aria-hidden="true" />
        <span className="crm-banner-text">{message}</span>
        <a className="crm-banner-link" href="/crm">
          Open CRM
        </a>
      </div>
    );
  } catch {
    return null;
  }
}
