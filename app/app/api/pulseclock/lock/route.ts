import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/pulseclock/adminSession";

/** Best-effort lock sent by navigator.sendBeacon when the admin page is
 * closed, reloaded or left. Only ever clears the caller's own cookie. */
export async function POST() {
  clearAdminSession();
  return new NextResponse(null, { status: 204 });
}
