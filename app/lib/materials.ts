import { prisma } from "@/lib/prisma";

/**
 * Every stock-item picker app-wide (Expenses, Inventory, Budget, Purchase
 * Orders) draws from this exact same list — active Stock materials
 * registered in the Price Database — so a stock item can only ever be
 * chosen, never typed, everywhere in the app (no more inventory split
 * across near-duplicate cards from a spelling variant).
 */
export async function getStockMaterials() {
  return prisma.material.findMany({
    where: { category: "stock", active: true },
    orderBy: { name: "asc" },
  });
}

export type StockMaterial = Awaited<ReturnType<typeof getStockMaterials>>[number];
