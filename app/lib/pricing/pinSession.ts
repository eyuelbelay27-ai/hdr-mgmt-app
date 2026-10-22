import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Pricing Settings sit behind the shared Pricing PIN. A correct PIN sets
 * this signed, HttpOnly browser-session cookie bound to the app user; every
 * settings write re-verifies it. Each tool page also locks again when it
 * loads, so the PIN is asked every time Settings is opened after a reload
 * or a visit elsewhere; 2 hours is only the server's backstop.
 */
const COOKIE = "pricing_admin";
const TTL_MS = 2 * 60 * 60 * 1000;

function sign(value: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return crypto.createHmac("sha256", `pricing:${secret}`).update(value).digest("hex");
}

export function grantPricingSession(userId: string): void {
  const payload = `${userId}.${Date.now() + TTL_MS}`;
  cookies().set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function clearPricingSession(): void {
  cookies().delete(COOKIE);
}

export function hasPricingSession(userId: string): boolean {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return false;
  const [uid, exp, sig] = raw.split(".");
  if (!uid || !exp || !sig || uid !== userId || Number(exp) < Date.now()) return false;
  const expected = sign(`${uid}.${exp}`);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// Wrong-PIN throttle: 5 misses locks that user out for 15 minutes.
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
