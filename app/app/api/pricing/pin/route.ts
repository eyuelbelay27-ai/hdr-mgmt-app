import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { pricingUser, readJson } from "@/lib/pricing/api";
import { clearPinFailures, pinLockedFor, recordPinFailure } from "@/lib/pricing/pinSession";

/**
 * Sets the Pricing PIN. The very first one: app admins (manageUsers) only.
 * After that it can only be changed with the current PIN — there is
 * deliberately no reset path in the app.
 */
export async function POST(req: Request) {
  const { user, error } = await pricingUser();
  if (error) return error;
  const body = await readJson(req);
  const pin = String(body.pin ?? "");
  const settings = await prisma.pricingSettings.findUnique({ where: { id: "singleton" } });

  if (settings?.pinHash) {
    const locked = pinLockedFor(user.id);
    if (locked) return NextResponse.json({ ok: false, error: `Too many wrong PINs. Try again in ${locked} min.` });
    if (!(await bcrypt.compare(String(body.current ?? ""), settings.pinHash))) {
      recordPinFailure(user.id);
      return NextResponse.json({ ok: false, error: "Current PIN is incorrect." });
    }
    clearPinFailures(user.id);
  } else if (!can(user, "manageUsers")) {
    return NextResponse.json({ ok: false, error: "Only an app admin can set the first Pricing PIN." });
  }

  if (!/^\d{4,8}$/.test(pin)) return NextResponse.json({ ok: false, error: "The new PIN must be 4–8 digits." });
  if (pin !== String(body.confirm ?? "")) return NextResponse.json({ ok: false, error: "The new PIN and confirmation don't match." });
  const pinHash = await bcrypt.hash(pin, 10);
  await prisma.pricingSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", pinHash }, update: { pinHash } });
  return NextResponse.json({ ok: true });
}
