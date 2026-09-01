"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requirePage, PermissionError } from "@/lib/permissions";
import { toNumber } from "@/lib/money";

export interface ActionState {
  error: string | null;
}

/**
 * Section 8.9. There's no dedicated `manageSettings` action key in the
 * permission spec (Section 5.4) — page access to 'settings' (Admin-only
 * by default, per Section 5.5) is the gate for both viewing and editing.
 */
export async function updateSettingsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireCurrentUser();
  try {
    requirePage(user, "settings");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const rate = toNumber(formData.get("withholdingRatePercent"));
  const threshold = toNumber(formData.get("withholdingThreshold"));
  if (rate < 0 || rate > 100) return { error: "Rate must be between 0 and 100." };
  if (threshold < 0) return { error: "Threshold can't be negative." };

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { withholdingRatePercent: rate, withholdingThreshold: threshold },
    create: { id: "singleton", withholdingRatePercent: rate, withholdingThreshold: threshold },
  });

  revalidatePath("/settings");
  return { error: null };
}
