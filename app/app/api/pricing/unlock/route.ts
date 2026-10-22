import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pricingUser, readJson } from "@/lib/pricing/api";
import { clearPinFailures, grantPricingSession, pinLockedFor, recordPinFailure } from "@/lib/pricing/pinSession";

export async function POST(req: Request) {
  const { user, error } = await pricingUser();
  if (error) return error;
  const locked = pinLockedFor(user.id);
  if (locked) return NextResponse.json({ ok: false, error: `Too many wrong PINs. Try again in ${locked} min.` });
  const settings = await prisma.pricingSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.pinHash) {
    return NextResponse.json({ ok: false, error: "No Pricing PIN has been set yet. An app admin sets it on the Pricing page." });
  }
  const pin = String((await readJson(req)).pin ?? "");
  if (!(await bcrypt.compare(pin, settings.pinHash))) {
    recordPinFailure(user.id);
    return NextResponse.json({ ok: false, error: "Incorrect PIN. Try again." });
  }
  clearPinFailures(user.id);
  grantPricingSession(user.id);
  return NextResponse.json({ ok: true });
}
