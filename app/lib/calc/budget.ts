import { round2, toNumber } from "@/lib/money";

/**
 * Total Allocated (Cash) — Section 7.3. Stock items are entirely excluded:
 * they represent inventory already on hand, not new cash spend needing
 * approval.
 */
export function totalAllocatedCash(items: { category: string; amount: unknown }[]): number {
  return round2(
    items.filter((i) => i.category !== "stock").reduce((sum, i) => sum + toNumber(i.amount), 0)
  );
}
