import { round2, toNumber } from "@/lib/money";

/**
 * Remaining Payment (Section 7.7). The max(0, ...) clamp is essential: a
 * fully-paid job must land cleanly at 0, never a negative number or a
 * stray floating-point remainder.
 */
export function remainingPayment(soldPrice: unknown, payments: { type: string; amount: unknown }[]): number {
  const advancePaid = payments.filter((p) => p.type === "Advance").reduce((s, p) => s + toNumber(p.amount), 0);
  const finalPaid = payments.filter((p) => p.type === "Final").reduce((s, p) => s + toNumber(p.amount), 0);
  return Math.max(0, round2(toNumber(soldPrice) - advancePaid - finalPaid));
}
