"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { can, requirePage, PermissionError } from "@/lib/permissions";
import { saveUpload, getUploadedFile } from "@/lib/storage";
import { attendanceToday } from "@/lib/attendance/day";
import { euclideanDistance, isMatch, isValidDescriptor } from "@/lib/attendance/faceMatch";
import { authorizeThisDevice, isDeviceAuthorized, listAuthorizedDevices, revokeDevice } from "@/lib/attendance/device";
import { normalizeSchedule } from "@/lib/attendance/settings";

/**
 * Attendance — a standalone module, like CRM/Overtime Control. Nothing
 * here reads from or writes to Job/Budget/Expense/Inventory; the only
 * shared piece is the existing User table (attendance tracks the same
 * staff already in the app).
 *
 * Two very different trust levels live in this one file:
 *   - The kiosk actions (listKioskEmployeesAction, submitKioskCaptureAction)
 *     require NO login — the device-token cookie is the entire gate, per
 *     the plan's explicit "device token only, no login" decision. Every
 *     one of them re-checks isDeviceAuthorized() itself; none of them may
 *     ever be reached by an unauthorized browser regardless of what the
 *     client sends.
 *   - Everything else (dashboard, settings, device authorization) is
 *     Admin-only, gated by the "manageAttendance" permission, same as any
 *     other module's admin surface.
 */

function requireManage(user: { actions: unknown; actionViews: unknown; pages: unknown; tabs: unknown }): void {
  requirePage(user, "attendance");
  if (!can(user, "manageAttendance")) throw new PermissionError("You don't have access to Attendance.");
}

// -----------------------------------------------------------------------
// Kiosk — no login, device-token gated only
// -----------------------------------------------------------------------

export interface KioskEmployee {
  id: string;
  name: string;
  hasProfile: boolean;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
}

export interface KioskState {
  deviceAuthorized: boolean;
  employees: KioskEmployee[];
}

/** Everything the kiosk screen needs in one call. Returns
 * `deviceAuthorized: false` (and an empty roster — nothing about staff is
 * exposed to an unauthorized browser) rather than throwing, since the
 * kiosk page itself needs to render a calm "not authorized" state. */
export async function getKioskStateAction(): Promise<KioskState> {
  const authorized = await isDeviceAuthorized();
  if (!authorized) return { deviceAuthorized: false, employees: [] };

  const today = attendanceToday();
  const [users, profiles, records] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.attendanceProfile.findMany({ select: { userId: true } }),
    prisma.attendanceRecord.findMany({ where: { date: today } }),
  ]);
  const profileIds = new Set(profiles.map((p) => p.userId));
  const recordByUser = new Map(records.map((r) => [r.userId, r]));

  return {
    deviceAuthorized: true,
    employees: users.map((u) => ({
      id: u.id,
      name: u.name,
      hasProfile: profileIds.has(u.id),
      checkedInAt: recordByUser.get(u.id)?.checkInAt ?? null,
      checkedOutAt: recordByUser.get(u.id)?.checkOutAt ?? null,
    })),
  };
}

export interface KioskCaptureResult {
  error: string | null;
  action?: "registered" | "checkedIn" | "checkedOut";
  at?: Date;
}

// Guards against an accidental double-tap being read as an immediate
// checkout seconds after checking in.
const MIN_GAP_MINUTES = 5;

/**
 * The one action the whole kiosk flow exists to call. `formData` carries:
 *   - userId: which employee was selected
 *   - descriptor: JSON-stringified 128-float array, computed client-side
 *     by face-api.js from the captured frame
 *   - livenessPassed: "true" — the blink/liveness check the client ran
 *     across the capture sequence. This is a client-reported flag (there
 *     is no way to re-verify a multi-frame liveness check from a single
 *     server-side snapshot); the descriptor match below is the part the
 *     server verifies independently.
 *   - photo: the captured frame, saved as this event's audit photo
 */
export async function submitKioskCaptureAction(formData: FormData): Promise<KioskCaptureResult> {
  if (!(await isDeviceAuthorized())) {
    return { error: "This device isn't authorized. Ask an admin to authorize it from Settings." };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { error: "Select your name first." };

  const livenessPassed = formData.get("livenessPassed") === "true";
  if (!livenessPassed) return { error: "Liveness check didn't complete. Try again." };

  let descriptor: number[];
  try {
    descriptor = JSON.parse(String(formData.get("descriptor") ?? "[]"));
  } catch {
    return { error: "Capture failed. Try again." };
  }
  if (!isValidDescriptor(descriptor)) return { error: "Capture failed. Try again." };

  const photoFile = getUploadedFile(formData, "photo");
  if (!photoFile) return { error: "Capture failed. Try again." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return { error: "Employee not found." };

  const profile = await prisma.attendanceProfile.findUnique({ where: { userId } });
  const photo = await saveUpload(photoFile);

  if (!profile) {
    // First-ever capture for this employee — it becomes their reference,
    // and (since getting this far already proves a live, present person
    // at the kiosk) also stands in for today's check-in.
    await prisma.attendanceProfile.create({
      data: { userId, referencePhotoUrl: photo.url, referencePhotoName: photo.name, descriptor },
    });
    const today = attendanceToday();
    await prisma.attendanceRecord.create({
      data: { userId, date: today, checkInAt: new Date(), checkInPhotoUrl: photo.url, checkInDistance: 0 },
    });
    revalidatePath("/attendance");
    return { error: null, action: "registered", at: new Date() };
  }

  const distance = euclideanDistance(descriptor, profile.descriptor as unknown as number[]);
  if (!isMatch(distance)) {
    return { error: "Face didn't match our record for this name. Try again, or ask an admin for help." };
  }

  const today = attendanceToday();
  const existing = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId, date: today } } });
  const now = new Date();

  if (!existing || !existing.checkInAt) {
    const record = await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today, checkInAt: now, checkInPhotoUrl: photo.url, checkInDistance: distance },
      update: { checkInAt: now, checkInPhotoUrl: photo.url, checkInDistance: distance },
    });
    revalidatePath("/attendance");
    return { error: null, action: "checkedIn", at: record.checkInAt! };
  }

  if (existing.checkOutAt) {
    return { error: "You've already checked in and out today." };
  }

  const minutesSinceCheckIn = (now.getTime() - existing.checkInAt.getTime()) / 60000;
  if (minutesSinceCheckIn < MIN_GAP_MINUTES) {
    return { error: "You just checked in — that's recorded already." };
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: existing.id },
    data: { checkOutAt: now, checkOutPhotoUrl: photo.url, checkOutDistance: distance },
  });
  revalidatePath("/attendance");
  return { error: null, action: "checkedOut", at: updated.checkOutAt! };
}

// -----------------------------------------------------------------------
// Admin — device authorization, settings, dashboard
// -----------------------------------------------------------------------

export async function authorizeDeviceAction(): Promise<{ error: string | null }> {
  const user = await requireCurrentUser();
  try {
    requireManage(user);
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  await authorizeThisDevice(user.id, "Office kiosk PC");
  revalidatePath("/attendance");
  return { error: null };
}

export async function revokeDeviceAction(deviceId: string): Promise<void> {
  const user = await requireCurrentUser();
  requireManage(user);
  await revokeDevice(deviceId);
  revalidatePath("/attendance");
}

export async function listDevicesAction() {
  const user = await requireCurrentUser();
  requireManage(user);
  return listAuthorizedDevices();
}

export interface ScheduleActionState {
  error: string | null;
}

export async function setAttendanceScheduleAction(
  _prevState: ScheduleActionState,
  formData: FormData
): Promise<ScheduleActionState> {
  const user = await requireCurrentUser();
  try {
    requireManage(user);
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const schedule = normalizeSchedule({
    expectedCheckInHour: formData.get("expectedCheckInHour"),
    expectedCheckInMinute: formData.get("expectedCheckInMinute"),
    expectedCheckOutHour: formData.get("expectedCheckOutHour"),
    expectedCheckOutMinute: formData.get("expectedCheckOutMinute"),
  });

  await prisma.attendanceSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...schedule },
    update: schedule,
  });

  revalidatePath("/attendance");
  return { error: null };
}

export interface AttendanceDashboardRow {
  userId: string;
  userName: string;
  date: Date;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
}

/** One row per active employee per day in [start, end] (inclusive), even
 * when no AttendanceRecord exists — a missing row is exactly the "didn't
 * show up" signal this whole module exists to surface, so it has to be
 * synthesized here rather than only showing the days someone punched. */
export async function getAttendanceDashboardAction(start: Date, end: Date): Promise<AttendanceDashboardRow[]> {
  const user = await requireCurrentUser();
  requireManage(user);

  const [users, records] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: start, lte: end } },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const byUserDate = new Map(records.map((r) => [`${r.userId}:${r.date.toISOString()}`, r]));
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) days.push(new Date(t));

  const rows: AttendanceDashboardRow[] = [];
  for (const day of days) {
    for (const u of users) {
      const rec = byUserDate.get(`${u.id}:${day.toISOString()}`);
      rows.push({
        userId: u.id,
        userName: u.name,
        date: day,
        checkInAt: rec?.checkInAt ?? null,
        checkOutAt: rec?.checkOutAt ?? null,
        checkInPhotoUrl: rec?.checkInPhotoUrl ?? null,
        checkOutPhotoUrl: rec?.checkOutPhotoUrl ?? null,
      });
    }
  }
  // Most recent day first, alphabetical within a day.
  rows.sort((a, b) => b.date.getTime() - a.date.getTime() || a.userName.localeCompare(b.userName));
  return rows;
}
