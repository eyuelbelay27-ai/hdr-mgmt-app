import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY — one-time read of the Pricing settings for the owner's
 * settings PDF. Guarded by the same secret header as /api/admin/seed;
 * read-only. To be removed right after the export.
 */
export async function GET(request: Request) {
  const secret = process.env.SEED_TRIGGER_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 404 });
  const provided = Buffer.from(request.headers.get("x-seed-secret") ?? "");
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const rows = await prisma.pricingStore.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(
    { at: new Date().toISOString(), rows: rows.map((r) => ({ key: r.key, value: r.value, updatedBy: r.updatedBy, updatedAt: r.updatedAt })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
