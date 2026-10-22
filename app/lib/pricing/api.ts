import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { canSeePage } from "@/lib/permissions";

/** The logged-in user if they may use Pricing, else a ready JSON error. */
export async function pricingUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 }) };
  if (!canSeePage(user, "pricing")) {
    return { error: NextResponse.json({ ok: false, error: "You don't have access to Pricing." }, { status: 403 }) };
  }
  return { user };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
