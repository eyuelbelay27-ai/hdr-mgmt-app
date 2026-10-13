"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { can, requirePage, PermissionError } from "@/lib/permissions";
import { saveUpload, getUploadedFile, deleteUpload } from "@/lib/storage";
import { isMatch, isValidDescriptor, similarity } from "@/lib/pulseclock/faceMatch";
import { isValidEthiopianDate, toGregorian } from "@/lib/payroll/ethiopian";
import { addisInstant, addisMinutes, addisTimeLabel, addisWeekday, addisWorkDate, ethiopianDateLabel } from "@/lib/pulseclock/time";
import { getPulseSettings, isEarly, isLate } from "@/lib/pulseclock/settings";
import {
  clearAdminSession,
  clearPinFailures,
  grantAdminSession,
  hasAdminSession,
  pinLockedFor,
  recordPinFailure,
} from "@/lib/pulseclock/adminSession";

/**
 * PulseClock — standalone attendance. Nothing here touches any other
 * module's tables; the User table only identifies who is using the app.
 *   - Check-in/out: any logged-in user with the "pulseclock" page.
 *   - Admin side: additionally needs the module's own PIN (signed cookie).
 *   - Setting a first PIN / resetting a forgotten one: app admins only
 *     (manageUsers), so the PIN can't be claimed by whoever gets there first.
 */

export interface PulseState {
  error: string | null;
  message?: string;
}

const MIN_GAP_MINUTES = 2;

async function requireUse() {
  const user = await requireCurrentUser();
  requirePage(user, "pulseclock");
  return user;
}

async function guard<T extends PulseState>(fn: () => Promise<T>): Promise<T | PulseState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
}

async function requireAdmin() {
  const user = await requireUse();
  if (!hasAdminSession(user.id)) throw new PermissionError("Enter the PulseClock admin PIN first.");
  return user;
}

async function audit(actor: string, action: string, detail: string) {
  await prisma.pulseAudit.create({ data: { actor, action, detail } });
}

function done(message?: string): PulseState {
  revalidatePath("/pulseclock");
  return { error: null, message };
}

// -----------------------------------------------------------------------
// Check-in / check-out (face verified)
// -----------------------------------------------------------------------

export interface CaptureResult extends PulseState {
  outcome?: "registered" | "checkedIn" | "checkedOut";
  at?: string;
}

/**
 * The browser sends the face descriptor it computed (after a blink
 * liveness check) and, for an employee with no reference yet, the photo.
 * The identity decision — descriptor vs stored reference — is made here.
 */
export async function pulseCaptureAction(formData: FormData): Promise<CaptureResult> {
  return guard(async () => {
    const user = await requireUse();
    const employeeId = String(formData.get("employeeId") ?? "");
    const action = String(formData.get("action") ?? "");
    if (action !== "check-in" && action !== "check-out") return { error: "Unknown action." };
    if (formData.get("livenessPassed") !== "true") return { error: "Liveness check didn't complete. Try again." };

    let descriptor: unknown;
    try {
      descriptor = JSON.parse(String(formData.get("descriptor") ?? "[]"));
    } catch {
      return { error: "Capture failed. Try again." };
    }
    if (!isValidDescriptor(descriptor)) return { error: "Capture failed. Try again." };

    const employee = await prisma.pulseEmployee.findUnique({ where: { id: employeeId } });
    if (!employee || !employee.active) return { error: "Employee not found." };

    const now = new Date();
    const workDate = addisWorkDate(now);
    const rules = await getPulseSettings();
    if (!rules.workDays.includes(addisWeekday(now))) return { error: "Today isn't a working day." };
    if (await prisma.pulseHoliday.findUnique({ where: { date: workDate } })) return { error: "Today is marked as a holiday." };
    if (await prisma.pulseLeave.findFirst({ where: { employeeId, date: workDate } })) {
      return { error: `${employee.name} is marked on leave today.` };
    }

    // A reference from the old 128-float engine (or none) means "register now".
    const reference = isValidDescriptor(employee.descriptor) ? employee.descriptor : null;
    let registered = false;
    let matchNote = "";
    if (!reference) {
      if (action === "check-out") return { error: "No check-in found today. Check in first." };
      const photoFile = getUploadedFile(formData, "photo");
      if (!photoFile) return { error: "Capture failed. Try again." };
      const photo = await saveUpload(photoFile);
      await deleteUpload(employee.referencePhotoUrl);
      await prisma.pulseEmployee.update({
        where: { id: employeeId },
        data: { descriptor, referencePhotoUrl: photo.url, referencePhotoName: photo.name, enrolledAt: now },
      });
      registered = true;
    } else {
      const sim = similarity(descriptor, reference);
      matchNote = ` (match ${Math.round(sim * 100)}%)`;
      if (!isMatch(sim)) {
        await audit(
          user.name,
          "Face not matched",
          `${action} attempt for ${employee.name} was rejected (similarity ${Math.round(sim * 100)}%)`
        );
        return { error: `Face didn't match ${employee.name}'s record. No attendance was recorded.` };
      }
    }

    const existing = await prisma.pulseAttendance.findUnique({ where: { employeeId_workDate: { employeeId, workDate } } });
    const minutes = addisMinutes(now);

    if (action === "check-in") {
      if (existing?.checkInAt) return { error: `${employee.name} already checked in today at ${addisTimeLabel(existing.checkInAt)}.` };
      await prisma.pulseAttendance.upsert({
        where: { employeeId_workDate: { employeeId, workDate } },
        create: { employeeId, workDate, checkInAt: now, late: isLate(minutes, rules) },
        update: { checkInAt: now, late: isLate(minutes, rules) },
      });
      await audit(user.name, registered ? "Face registered & checked in" : "Checked in", `${employee.name} at ${addisTimeLabel(now)}${matchNote}`);
      revalidatePath("/pulseclock");
      return { error: null, outcome: registered ? "registered" : "checkedIn", at: now.toISOString() };
    }

    if (!existing?.checkInAt) return { error: "No check-in found today. Check in first." };
    if (existing.checkOutAt) return { error: `${employee.name} already checked out today at ${addisTimeLabel(existing.checkOutAt)}.` };
    if ((now.getTime() - existing.checkInAt.getTime()) / 60000 < MIN_GAP_MINUTES) {
      return { error: "You just checked in. Check out later." };
    }
    await prisma.pulseAttendance.update({ where: { id: existing.id }, data: { checkOutAt: now, early: isEarly(minutes, rules) } });
    await audit(user.name, "Checked out", `${employee.name} at ${addisTimeLabel(now)}${matchNote}`);
    revalidatePath("/pulseclock");
    return { error: null, outcome: "checkedOut", at: now.toISOString() };
  });
}

// -----------------------------------------------------------------------
// Admin PIN
// -----------------------------------------------------------------------

export async function unlockAdminAction(_prev: PulseState, formData: FormData): Promise<PulseState> {
  return guard(async () => {
    const user = await requireUse();
    const locked = pinLockedFor(user.id);
    if (locked) return { error: `Too many wrong PINs. Try again in ${locked} min.` };
    const settings = await getPulseSettings();
    if (!settings.adminPinHash) return { error: "No admin PIN has been set yet." };
    const pin = String(formData.get("pin") ?? "");
    if (!(await bcrypt.compare(pin, settings.adminPinHash))) {
      recordPinFailure(user.id);
      return { error: "Incorrect PIN." };
    }
    clearPinFailures(user.id);
    grantAdminSession(user.id);
    await audit(user.name, "Admin signed in", "PulseClock admin unlocked");
    return done();
  });
}

export async function lockAdminAction(): Promise<void> {
  await requireUse();
  clearAdminSession();
  revalidatePath("/pulseclock");
}

/** First PIN or forgotten-PIN reset: app admins only. Changing it while
 * unlocked: anyone with an admin session. */
export async function setAdminPinAction(_prev: PulseState, formData: FormData): Promise<PulseState> {
  return guard(async () => {
    const user = await requireUse();
    if (!can(user, "manageUsers") && !hasAdminSession(user.id)) {
      return { error: "Only an app admin can set the PulseClock PIN." };
    }
    const pin = String(formData.get("pin") ?? "");
    if (!/^\d{4,8}$/.test(pin)) return { error: "The PIN must be 4–8 digits." };
    if (pin !== String(formData.get("confirm") ?? "")) return { error: "The two PINs don't match." };
    const adminPinHash = await bcrypt.hash(pin, 10);
    await prisma.pulseSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", adminPinHash }, update: { adminPinHash } });
    grantAdminSession(user.id);
    await audit(user.name, "Admin PIN set", "PulseClock admin PIN was set or changed");
    return done("PIN saved.");
  });
}

// -----------------------------------------------------------------------
// Employees
// -----------------------------------------------------------------------

export async function addEmployeeAction(_prev: PulseState, formData: FormData): Promise<PulseState> {
  return guard(async () => {
    const user = await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim() || null;
    if (!name) return { error: "Enter the employee's name." };
    await prisma.pulseEmployee.create({ data: { name, role } });
    await audit(user.name, "Employee added", name);
    return done();
  });
}

export async function setEmployeeActiveAction(employeeId: string, active: boolean): Promise<PulseState> {
  return guard(async () => {
    const user = await requireAdmin();
    const e = await prisma.pulseEmployee.update({ where: { id: employeeId }, data: { active } });
    await audit(user.name, active ? "Employee reactivated" : "Employee deactivated", e.name);
    return done();
  });
}

/** Clears the face reference; the employee's next check-in registers a new one. */
export async function resetFaceAction(employeeId: string): Promise<PulseState> {
  return guard(async () => {
    const user = await requireAdmin();
    const e = await prisma.pulseEmployee.findUnique({ where: { id: employeeId } });
    if (!e) return { error: "Employee not found." };
    await prisma.pulseEmployee.update({
      where: { id: employeeId },
      data: { descriptor: Prisma.DbNull, referencePhotoUrl: null, referencePhotoName: null, enrolledAt: null },
    });
    await deleteUpload(e.referencePhotoUrl);
    await audit(user.name, "Face reset", `${e.name} will re-register at next check-in`);
    return done();
  });
}

// -----------------------------------------------------------------------
// Attendance corrections
// -----------------------------------------------------------------------

export async function correctAttendanceAction(_prev: PulseState, formData: FormData): Promise<PulseState> {
  return guard(async () => {
    const user = await requireAdmin();
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) return { error: "A reason is required." };
    // Keyed by employee + day, so it also covers someone with no row that
    // day (a forgotten check-in) — the row is created.
    const employeeId = String(formData.get("employeeId") ?? "");
    const workDate = new Date(String(formData.get("workDate") ?? ""));
    if (Number.isNaN(workDate.getTime()) || workDate.getTime() % 86400000 !== 0) return { error: "Invalid day." };
    if (workDate > addisWorkDate()) return { error: "That day hasn't happened yet." };
    const employee = await prisma.pulseEmployee.findUnique({ where: { id: employeeId } });
    if (!employee) return { error: "Employee not found." };

    const inRaw = String(formData.get("checkIn") ?? "").trim();
    const outRaw = String(formData.get("checkOut") ?? "").trim();
    const checkInAt = inRaw ? addisInstant(workDate, inRaw) : null;
    const checkOutAt = outRaw ? addisInstant(workDate, outRaw) : null;
    if ((inRaw && !checkInAt) || (outRaw && !checkOutAt)) return { error: "Enter valid times." };
    if (checkOutAt && !checkInAt) return { error: "A check-out needs a check-in." };
    if (checkInAt && checkOutAt && checkOutAt <= checkInAt) return { error: "Check-out must be after check-in." };

    const rules = await getPulseSettings();
    const data = {
      checkInAt,
      checkOutAt,
      late: checkInAt ? isLate(addisMinutes(checkInAt), rules) : false,
      early: checkOutAt ? isEarly(addisMinutes(checkOutAt), rules) : false,
      source: "admin-correction",
    };
    await prisma.pulseAttendance.upsert({
      where: { employeeId_workDate: { employeeId, workDate } },
      create: { employeeId, workDate, ...data },
      update: data,
    });
    await audit(
      user.name,
      "Attendance corrected",
      `${employee.name}, ${ethiopianDateLabel(workDate)}: in ${inRaw || "—"}, out ${outRaw || "—"}. Reason: ${reason}`
    );
    return done("Saved.");
  });
}

// -----------------------------------------------------------------------
// Leave & holidays (dates entered in the Ethiopian calendar)
// -----------------------------------------------------------------------

function readEthiopianDate(formData: FormData): Date | null {
  const date = {
    year: Number(formData.get("dateYear")),
    month: Number(formData.get("dateMonth")),
    day: Number(formData.get("dateDay")),
  };
  return isValidEthiopianDate(date) ? toGregorian(date) : null;
}

export async function addExceptionAction(_prev: PulseState, formData: FormData): Promise<PulseState> {
  return guard(async () => {
    const user = await requireAdmin();
    const type = String(formData.get("type") ?? "leave");
    const date = readEthiopianDate(formData);
    const reason = String(formData.get("reason") ?? "").trim() || (type === "holiday" ? "Holiday" : "Approved leave");
    if (!date) return { error: "Enter a valid date." };

    if (type === "holiday") {
      if (await prisma.pulseHoliday.findUnique({ where: { date } })) return { error: "That day is already a holiday." };
      await prisma.pulseHoliday.create({ data: { date, reason, createdBy: user.name } });
      await audit(user.name, "Holiday added", `${ethiopianDateLabel(date)}: ${reason}`);
      return done();
    }
    const employeeId = String(formData.get("employeeId") ?? "");
    const employee = await prisma.pulseEmployee.findUnique({ where: { id: employeeId } });
    if (!employee) return { error: "Choose an employee." };
    if (await prisma.pulseLeave.findFirst({ where: { employeeId, date } })) return { error: "That leave is already recorded." };
    await prisma.pulseLeave.create({ data: { employeeId, date, reason, createdBy: user.name } });
    await audit(user.name, "Leave added", `${employee.name}, ${ethiopianDateLabel(date)}: ${reason}`);
    return done();
  });
}

export async function deleteExceptionAction(type: "leave" | "holiday", id: string): Promise<PulseState> {
  return guard(async () => {
    const user = await requireAdmin();
    if (type === "holiday") {
      const h = await prisma.pulseHoliday.delete({ where: { id } });
      await audit(user.name, "Holiday removed", ethiopianDateLabel(h.date));
    } else {
      const l = await prisma.pulseLeave.delete({ where: { id }, include: { employee: true } });
      await audit(user.name, "Leave removed", `${l.employee.name}, ${ethiopianDateLabel(l.date)}`);
    }
    return done();
  });
}

// -----------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export async function saveRulesAction(_prev: PulseState, formData: FormData): Promise<PulseState> {
  return guard(async () => {
    const user = await requireAdmin();
    const shiftStartMin = toMinutes(String(formData.get("shiftStart") ?? ""));
    const shiftEndMin = toMinutes(String(formData.get("shiftEnd") ?? ""));
    const graceMin = Number(formData.get("grace"));
    const workDays = formData.getAll("workDays").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (shiftStartMin === null || shiftEndMin === null) return { error: "Enter valid shift times." };
    if (shiftEndMin <= shiftStartMin) return { error: "The shift must end after it starts." };
    if (!Number.isInteger(graceMin) || graceMin < 0 || graceMin > 240) return { error: "Grace must be 0–240 minutes." };
    if (workDays.length === 0) return { error: "Pick at least one work day." };
    const data = { shiftStartMin, shiftEndMin, graceMin, workDays: workDays.filter((d, i) => workDays.indexOf(d) === i).sort().join(",") };
    await prisma.pulseSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
    await audit(user.name, "Settings changed", "Shift, grace period or work days updated");
    return done("Saved.");
  });
}
