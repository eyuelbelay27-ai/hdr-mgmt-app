import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * The PulseClock admin side sits behind its own PIN on top of the app login.
 * A correct PIN sets this signed, HttpOnly browser-session cookie, bound to
 * the app user who entered it; every admin page load and action re-verifies
 * it server-side. The PIN is asked on every opening of Admin: the client
 * (AdminGuard) locks again on reload, leaving or closing the page, and the
 * 2-hour expiry is only the server's backstop.
 */
const COOKIE = "pulse_admin";
const TTL_MS = 2 * 60 * 60 * 1000;

function sign(value: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function grantAdminSession(userId: string): void {
  const exp = Date.now() + TTL_MS;
  const payload = `${userId}.${exp}`;
  cookies().set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearAdminSession(): void {
  cookies().delete(COOKIE);
}

export function hasAdminSession(userId: string): boolean {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return false;
  const [uid, exp, sig] = raw.split(".");
  if (!uid || !exp || !sig || uid !== userId || Number(exp) < Date.now()) return false;
  const expected = sign(`${uid}.${exp}`);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// Wrong-PIN throttle: 5 misses locks that user out for 15 minutes (per
// server process — enough for a single-instance app).
const failures = new Map<string, { count: number; until: number }>();

export function pinLockedFor(userId: string): number {
  const f = failures.get(userId);
  return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 60000) : 0;
}

export function recordPinFailure(userId: string): void {
  const f = failures.get(userId) ?? { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= 5) {
    f.until = Date.now() + 15 * 60 * 1000;
    f.count = 0;
  }
  failures.set(userId, f);
}

export function clearPinFailures(userId: string): void {
  failures.delete(userId);
}
