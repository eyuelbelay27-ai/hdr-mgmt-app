import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { runSeed } from "@/lib/seed-data";

/**
 * One-time production seed trigger. AletCloud (like most managed platforms)
 * gives no shell/one-off-command access to a running app's container, so
 * this is the mechanism for seeding the production database exactly once
 * after the first deploy — called manually, not wired into any deploy
 * hook or the startup command (unlike `prisma migrate deploy`, which is
 * safe to run on every start).
 *
 * Doubly guarded against accidental re-runs / duplication: a secret header
 * AND a check that zero users already exist. Either guard alone would be
 * enough; both together make this safe to leave in place indefinitely
 * (it becomes a permanent no-op 409 after the first successful call), and
 * it's also fine to delete this route entirely once seeding is confirmed.
 */
export async function POST(request: Request) {
  const secret = process.env.SEED_TRIGGER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SEED_TRIGGER_SECRET is not configured." }, { status: 503 });
  }

  const provided = request.headers.get("x-seed-secret") ?? "";
  const providedBuf = Buffer.from(provided);
  const secretBuf = Buffer.from(secret);
  const authorized = providedBuf.length === secretBuf.length && crypto.timingSafeEqual(providedBuf, secretBuf);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    return NextResponse.json(
      { seeded: false, reason: "Users already exist — refusing to reseed." },
      { status: 409 }
    );
  }

  const result = await runSeed(prisma);
  return NextResponse.json({ seeded: true, ...result });
}
