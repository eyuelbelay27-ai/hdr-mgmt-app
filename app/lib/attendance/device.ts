import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * The device-token lock (PDF Section 5) — the kiosk page needs no login
 * at all, so this is the *entire* access restriction on check-in/
 * check-out. An Admin authorizes the office PC once from Settings; that
 * sets an HttpOnly cookie in that one browser. Only a SHA-256 hash of the
 * token is ever stored, and every check-in/check-out server action
 * re-validates it independently — never trusting that the kiosk page's
 * own render-time check was the only gate (the same never-trust-the-
 * client posture as every other action in this app).
 */

export const DEVICE_COOKIE_NAME = "attendance_device_token";
// 10 years — this is a one-time physical setup step on one office PC, not
// a session that should expire on its own. Revoking is a deliberate admin
// action (see revokeDevice below), not a timeout.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Generates a new token, stores its hash, and sets the cookie on the
 * caller's browser — call only from a Server Action/Route Handler. */
export async function authorizeThisDevice(authorizedById: string, label?: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.attendanceDevice.create({
    data: { tokenHash: hashToken(token), authorizedById, label: label || null },
  });
  cookies().set(DEVICE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

/** True if the calling browser's cookie matches a live (non-revoked)
 * authorized device. Also best-effort touches lastSeenAt. */
export async function isDeviceAuthorized(): Promise<boolean> {
  const token = cookies().get(DEVICE_COOKIE_NAME)?.value;
  if (!token) return false;

  const device = await prisma.attendanceDevice.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!device || device.revokedAt) return false;

  prisma.attendanceDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return true;
}

export interface AuthorizedDeviceInfo {
  id: string;
  label: string | null;
  authorizedByName: string;
  authorizedAt: Date;
  lastSeenAt: Date | null;
}

export async function listAuthorizedDevices(): Promise<AuthorizedDeviceInfo[]> {
  const rows = await prisma.attendanceDevice.findMany({
    where: { revokedAt: null },
    include: { authorizedBy: { select: { name: true } } },
    orderBy: { authorizedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    authorizedByName: r.authorizedBy.name,
    authorizedAt: r.authorizedAt,
    lastSeenAt: r.lastSeenAt,
  }));
}

export async function revokeDevice(deviceId: string): Promise<void> {
  await prisma.attendanceDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
}
