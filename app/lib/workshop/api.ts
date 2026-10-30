import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { can, canSeePage } from "@/lib/permissions";

/** The logged-in user if they may see the Workshop Schedule, else a ready JSON error. */
export async function workshopUser(needEdit: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 }) };
  if (!canSeePage(user, "workshop")) {
    return { error: NextResponse.json({ ok: false, error: "You don't have access to the Workshop Schedule." }, { status: 403 }) };
  }
  if (needEdit && !can(user, "editSchedule")) {
    return { error: NextResponse.json({ ok: false, error: "You can view the schedule but not change it." }, { status: 403 }) };
  }
  return { user };
}
