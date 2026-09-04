import { round2, toNumber } from "@/lib/money";

/** withholding(amount) — Section 7.1. A hard threshold, not a flat percentage. */
export function computeWithholding(amount: number, ratePercent: number, threshold: number): number {
  return amount > threshold ? round2(amount * (ratePercent / 100)) : 0;
}

export type VarianceStatus = "over" | "under" | "on" | null;
export interface Variance {
  status: VarianceStatus;
  /** ETB variance — populated for Cash rows and Receipts, null for Stock. */
  amountETB: number | null;
  /** Quantity variance — populated for Stock rows only, null otherwise. */
  amountQty: number | null;
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
 * rule in the app. Cash rows and Receipts: Actual Spent is an ETB amount,
 * and variance is expressed in ETB. Stock rows: Actual Spent is a
 * quantity, and variance stays a quantity too (different stock items use
 * different units, so a Birr conversion can't be summed meaningfully) —
 * only the direction (over/under) and the row's own qty figure matter.
 *
 * source === "Manual" (never pulled from a budget line): the row's full
 * amount always counts as Over Budget, never "Under" — there was never a
 * budget line to be under.
 */
export function purchaseVariance(row: PurchaseRow): Variance {
  const totalPrice = toNumber(row.totalPrice);
  const budgetedQty = toNumber(row.qty);
  const hasActual = row.actualSpent !== null && row.actualSpent !== undefined;
  const actual = toNumber(row.actualSpent);
  const isStock = row.category === "stock";

  if (row.source === "Manual") {
    if (isStock) {
      return { status: "over", amountETB: null, amountQty: round2(hasActual ? actual : budgetedQty) };
    }
    return { status: "over", amountETB: round2(hasActual ? actual : totalPrice), amountQty: null };
  }

  if (!hasActual) return { status: null, amountETB: null, amountQty: null };

  if (isStock) {
    const varianceQty = round2(actual - budgetedQty);
    const status: VarianceStatus = varianceQty > 0 ? "over" : varianceQty < 0 ? "under" : "on";
    return { status, amountETB: null, amountQty: varianceQty };
  }

  const varianceETB = round2(actual - totalPrice);
  const status: VarianceStatus = varianceETB > 0 ? "over" : varianceETB < 0 ? "under" : "on";
  return { status, amountETB: varianceETB, amountQty: null };
}

/**
 * Actual money spent so far on a row, in ETB — used for the Expenses tab's
 * Total Spent and Collected Receipts stats. Stock rows never count here:
 * they're an Inventory quantity event, not a cash-spent one, so Total
 * Spent is only ever affected by Cash purchases and Receipts. A Manual
 * Cash row is already a real transaction, so its recorded total counts as
 * spent even before an Actual Spent correction is entered. A Budget-pulled
 * Cash row is only a commitment — nothing has actually been bought yet
 * until Actual Spent is recorded.
 */
export function actualSpentETB(row: PurchaseRow): number {
  if (row.category === "stock") return 0;

  const totalPrice = toNumber(row.totalPrice);
  const hasActual = row.actualSpent !== null && row.actualSpent !== undefined;
  const actual = toNumber(row.actualSpent);

  if (row.source === "Manual") return round2(hasActual ? actual : totalPrice);
  if (!hasActual) return 0;
  return round2(actual);
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

/** Expenses tab stat cards. */
export function expensesStats(expenses: ExpenseRow[]) {
  // Money actually spent so far, across Purchases and Receipts alike —
  // Budget-pulled commitments with no Actual Spent recorded yet contribute
  // nothing (nothing has actually been bought), so this is never inflated
  // by unfulfilled budget lines the way a raw sum of `totalPrice` would be.
  const totalSpent = round2(expenses.reduce((sum, e) => sum + actualSpentETB(e), 0));
  // Withholding legitimately applies to both sheets.
  const totalWithholding = round2(expenses.reduce((sum, e) => sum + toNumber(e.withholding), 0));
  // Birr value of expenses a receipt is actually on file for, not a count.
  const collectedReceiptsBr = round2(
    expenses.filter((e) => e.receiptUrl).reduce((sum, e) => sum + actualSpentETB(e), 0)
  );

  // Over/Under Budget only applies to Purchases — Receipts just register a
  // cost and its withholding, with no budget line to compare against. It's
  // a Birr-only indicator too: Stock rows carry their own per-row quantity
  // variance instead (different items use different units, so they can't
  // be summed into one Birr figure) and are excluded here automatically
  // since purchaseVariance leaves amountETB null for them. This never
  // touches Inventory — it's purely an at-a-glance spent-vs-budgeted
  // signal; Inventory only reacts to actual expense qty.
  let overBudget = 0;
  let underBudget = 0;
  for (const e of expenses) {
    if (e.entryType !== "purchase") continue;
    const v = purchaseVariance(e);
    if (v.amountETB === null) continue;
    if (v.status === "over") overBudget += v.amountETB;
    if (v.status === "under") underBudget += Math.abs(v.amountETB);
  }

  return {
    totalSpent,
    totalWithholding,
    collectedReceiptsBr,
    overBudget: round2(overBudget),
    underBudget: round2(underBudget),
  };
}
