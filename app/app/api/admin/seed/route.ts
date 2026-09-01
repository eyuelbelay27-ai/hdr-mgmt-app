import { NextResponse } from "next/server";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";
import { runSeed } from "@/lib/seed-data";

const execFileAsync = promisify(execFile);

/**
 * One-time production migrate + seed trigger. AletCloud's Next.js runner
 * launches `next start` directly (it does not go through package.json's
 * "start" script — confirmed by container logs showing no output from a
 * `prisma migrate deploy && next start` start script that was tried
 * first), and the platform gives no shell/one-off-command access to a
 * running container either. So this route does both, from inside the
 * running app itself (which does have network access to the DB and to
 * `node_modules/.bin/prisma`, since `prisma` is a regular dependency):
 *
 *   1. Shells out to `prisma migrate deploy` and returns its full output —
 *      this is what's checked to confirm every migration applied cleanly.
 *   2. Seeds the database, guarded by a check that zero users already
 *      exist so this can't duplicate data even if called more than once.
 *
 * Doubly guarded against accidental misuse: a secret header, and the
 * seed half additionally refuses to run if any user already exists.
 * Safe to leave in place indefinitely (migrate deploy is always a no-op
 * once applied; seed becomes a permanent 409 after the first success),
 * and just as fine to delete once confirmed working.
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

  let migrateOutput = "";
  let migrateError: string | null = null;
  try {
    const { stdout, stderr } = await execFileAsync("npx", ["prisma", "migrate", "deploy"], {
      cwd: process.cwd(),
      env: process.env,
    });
    migrateOutput = `${stdout}\n${stderr}`.trim();
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    migrateOutput = `${e.stdout ?? ""}\n${e.stderr ?? ""}`.trim();
    migrateError = e.message ?? String(err);
    return NextResponse.json({ migrateOutput, migrateError, seeded: false }, { status: 500 });
  }

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    return NextResponse.json(
      { migrateOutput, seeded: false, reason: "Users already exist — refusing to reseed." },
      { status: 409 }
    );
  }

  const result = await runSeed(prisma);
  return NextResponse.json({ migrateOutput, seeded: true, ...result });
}
