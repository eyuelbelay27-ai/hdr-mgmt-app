import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pricingUser, readJson } from "@/lib/pricing/api";
import { hasPricingSession } from "@/lib/pricing/pinSession";
import { findTool } from "@/lib/pricing/tools";

const MAX_VALUE = 15 * 1024 * 1024; // settings may hold reference images

/** Saves one of a tool's shared settings keys. Needs the Pricing PIN. */
export async function POST(req: Request) {
  const { user, error } = await pricingUser();
  if (error) return error;
  if (!hasPricingSession(user.id)) {
    return NextResponse.json({ ok: false, error: "Settings are locked. Enter the Pricing PIN again." }, { status: 403 });
  }
  const body = await readJson(req);
  const tool = findTool(String(body.tool ?? ""));
  const key = String(body.key ?? "");
  if (!tool || !tool.sharedKeys.includes(key)) return NextResponse.json({ ok: false, error: "Unknown setting." }, { status: 400 });
  if (typeof body.value !== "string" || body.value.length > MAX_VALUE) {
    return NextResponse.json({ ok: false, error: "Settings are too large (try smaller images)." }, { status: 400 });
  }
  const id = `${tool.id}:${key}`;
  await prisma.pricingStore.upsert({
    where: { key: id },
    create: { key: id, value: body.value, updatedBy: user.name },
    update: { value: body.value, updatedBy: user.name },
  });
  return NextResponse.json({ ok: true });
}
