import { round2, toNumber } from "@/lib/money";

/**
 * A Cost Estimate line, with whatever the Price Database currently says
 * about its material. `material` is null both when the line never had one
 * (an ad-hoc typed row) and when the material has since been deleted —
 * `materialId` is what tells those two apart.
 */
export interface CostEstimateLine {
  materialId: string | null;
  qty: unknown;
  /** The line's last saved figure, priced when quantities were last saved. */
  total: unknown;
  source: string;
  material?: { rate: unknown } | null;
}

/**
 * A line whose material has been deleted from the Price Database.
 *
 * Deleting a material nulls this column rather than removing the line
 * (the foreign key is ON DELETE SET NULL), so an orphaned line is
 * otherwise indistinguishable from an ad-hoc one. What separates them is
 * where the line came from: only a line the Price Database created can
 * end up with no material attached.
 */
export function isOrphanedLine(line: CostEstimateLine): boolean {
  return line.source === "PriceDatabase" && !line.materialId;
}

/**
 * What a line costs at today's prices. Estimates follow the Price
 * Database, so a line is repriced from the material's current rate rather
 * than the figure saved when quantities were last entered — otherwise the
 * totals disagree with the itemised breakdown, which is recalculated live.
 *
 * Two lines can't be repriced and fall back to their saved figure: an
 * ad-hoc row, whose price was typed in and has nothing to look up, and a
 * row whose material was deleted, which keeps what it last cost rather
 * than quietly dropping its cost out of the job.
 */
export function costEstimateLineTotal(line: CostEstimateLine): number {
  if (!line.materialId || !line.material) return toNumber(line.total);
  return round2(toNumber(line.qty) * toNumber(line.material.rate));
}

/**
 * Cost Estimate totals (Section 7.2). "Grand Total" deliberately means the
 * final client-facing sale figure, not the material cost sum (that's
 * "Sub Total") — the brief calls this rename out explicitly.
 */
export function costEstimateTotals(
  items: CostEstimateLine[],
  soldPrice: unknown,
  commissionActive: boolean
) {
  const subTotal = round2(items.reduce((sum, i) => sum + costEstimateLineTotal(i), 0));
  const commission = commissionActive ? round2(subTotal * 0.07) : 0;
  const sold = toNumber(soldPrice);
  const profit = round2(sold - subTotal - commission);
  return { subTotal, commission, profit, grandTotal: sold };
}
