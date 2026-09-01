import { round2, toNumber } from "@/lib/money";

/**
 * Cost Estimate totals (Section 7.2). "Grand Total" deliberately means the
 * final client-facing sale figure, not the material cost sum (that's
 * "Sub Total") — the brief calls this rename out explicitly.
 */
export function costEstimateTotals(
  items: { total: unknown }[],
  soldPrice: unknown,
  commissionActive: boolean
) {
  const subTotal = round2(items.reduce((sum, i) => sum + toNumber(i.total), 0));
  const commission = commissionActive ? round2(subTotal * 0.07) : 0;
  const sold = toNumber(soldPrice);
  const profit = round2(sold - subTotal - commission);
  return { subTotal, commission, profit, grandTotal: sold };
}
