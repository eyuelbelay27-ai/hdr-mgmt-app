import { prisma } from "@/lib/prisma";

export interface PulseRules {
  shiftStartMin: number;
  shiftEndMin: number;
  graceMin: number;
  workDays: number[];
}

export const DEFAULT_RULES: PulseRules = { shiftStartMin: 510, shiftEndMin: 1050, graceMin: 30, workDays: [1, 2, 3, 4, 5, 6] };

export async function getPulseSettings(): Promise<PulseRules & { pinSet: boolean; adminPinHash: string | null }> {
  const s = await prisma.pulseSettings.findUnique({ where: { id: "singleton" } });
  if (!s) return { ...DEFAULT_RULES, pinSet: false, adminPinHash: null };
  return {
    shiftStartMin: s.shiftStartMin,
    shiftEndMin: s.shiftEndMin,
    graceMin: s.graceMin,
    workDays: s.workDays.split(",").filter(Boolean).map(Number),
    pinSet: !!s.adminPinHash,
    adminPinHash: s.adminPinHash,
  };
}

/** Late = checked in after shift start + grace. Early = left before shift end. */
export function isLate(minutes: number, rules: PulseRules): boolean {
  return minutes > rules.shiftStartMin + rules.graceMin;
}

export function isEarly(minutes: number, rules: PulseRules): boolean {
  return minutes < rules.shiftEndMin;
}
