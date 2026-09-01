import { round2, toNumber } from "@/lib/money";

/** withholding(amount) — Section 7.1. A hard threshold, not a flat percentage. */
export function computeWithholding(amount: number, ratePercent: number, threshold: number): number {
  return amount > threshold ? round2(amount * (ratePercent / 100)) : 0;
}

export type VarianceStatus = "over" | "under" | "on" | null;
export interface Variance {
  status: VarianceStatus;
  amountETB: number | null;
}

interface PurchaseRow {
  category: string | null;
  source: string;
  totalPrice: unknown;
  unitPrice: unknown;
  qty: unknown;
  actualSpent: unknown;
}

/**
 * Purchases sheet Actual Spent & Variance (Section 7.4) — the trickiest
 * rule in the app. Cash rows: Actual Spent is an ETB amount. Stock rows:
 * Actual Spent is a quantity, converted to an ETB variance for display.
 *
 * source === "Manual" (never pulled from a budget line): the row's full
 * amount always counts as Over Budget, never "Under" — there was never a
 * budget line to be under. For a Manual Stock row specifically, the brief
 * doesn't spell out how a quantity-shaped Actual Spent becomes an ETB
 * "over budget" figure the way it does for the Budget-sourced case; this
 * converts it the same way (actualQty × unitPrice) rather than inventing a
 * separate rule, falling back to the originally-entered totalPrice when
 * Actual Spent is blank, exactly as the brief specifies.
 */
export function purchaseVariance(row: PurchaseRow): Variance {
  const totalPrice = toNumber(row.totalPrice);
  const unitPrice = toNumber(row.unitPrice);
  const budgetedQty = toNumber(row.qty);
  const hasActual = row.actualSpent !== null && row.actualSpent !== undefined;
  const actual = toNumber(row.actualSpent);

  if (row.source === "Manual") {
    const amountETB =
      row.category === "stock" ? (hasActual ? actual * unitPrice : totalPrice) : hasActual ? actual : totalPrice;
    return { status: "over", amountETB: round2(amountETB) };
  }

  if (!hasActual) return { status: null, amountETB: null };

  const varianceETB = row.category === "stock" ? (actual - budgetedQty) * unitPrice : actual - totalPrice;
  const rounded = round2(varianceETB);
  const status: VarianceStatus = rounded > 0 ? "over" : rounded < 0 ? "under" : "on";
  return { status, amountETB: rounded };
}

interface ExpenseRow {
  entryType: string;
  totalPrice: unknown;
  withholding: unknown;
  receiptUrl: string | null;
  category: string | null;
  source: string;
  unitPrice: unknown;
  qty: unknown;
  actualSpent: unknown;
}

/** Expenses tab stat cards (Section 7.4, 7.6). */
export function expensesStats(expenses: ExpenseRow[]) {
  const purchases = expenses.filter((e) => e.entryType === "purchase");

  // Never includes Receipts — summing all of job.expenses here was a real
  // bug in the prototype that had to be fixed.
  const totalPurchases = round2(purchases.reduce((sum, e) => sum + toNumber(e.totalPrice), 0));
  // Withholding legitimately applies to both sheets.
  const totalWithholding = round2(expenses.reduce((sum, e) => sum + toNumber(e.withholding), 0));
  const collectedReceipts = expenses.filter((e) => e.receiptUrl).length;

  let overBudget = 0;
  let underBudget = 0;
  for (const p of purchases) {
    const v = purchaseVariance(p);
    if (v.amountETB === null) continue;
    if (v.status === "over") overBudget += v.amountETB;
    if (v.status === "under") underBudget += Math.abs(v.amountETB);
  }

  return {
    totalPurchases,
    totalWithholding,
    collectedReceipts,
    overBudget: round2(overBudget),
    underBudget: round2(underBudget),
  };
}
