import { round2, toNumber } from "@/lib/money";

interface ExpenseLike {
  entryType: string;
  category: string | null;
  totalPrice: unknown;
  unitPrice: unknown;
  actualSpent: unknown;
}

/** The ETB figure counted for one expense row once Actual Spent is known. */
export function actualExpenseAmount(e: ExpenseLike): number {
  if (e.entryType === "receipt") return toNumber(e.totalPrice);
  const hasActual = e.actualSpent !== null && e.actualSpent !== undefined;
  if (!hasActual) return toNumber(e.totalPrice);
  return e.category === "stock" ? toNumber(e.actualSpent) * toNumber(e.unitPrice) : toNumber(e.actualSpent);
}

export function actualTotalExpenses(expenses: ExpenseLike[]): number {
  return round2(expenses.reduce((sum, e) => sum + actualExpenseAmount(e), 0));
}

/** Final Profit After Expenses (Section 8.6): Sold Price − Actual Total Expenses − Commission. */
export function finalProfitAfterExpenses(soldPrice: unknown, expenses: ExpenseLike[], commission: number): number {
  return round2(toNumber(soldPrice) - actualTotalExpenses(expenses) - commission);
}
