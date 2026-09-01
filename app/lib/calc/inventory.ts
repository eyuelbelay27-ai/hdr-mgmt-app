import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";

export interface InventoryBalance {
  key: string;
  materialId: string | null;
  label: string;
  unit: string | null;
  balance: number;
}

/**
 * Current on-hand balance per material is derived, never stored (Section
 * 4.4): balance = sum(in qty) - sum(out qty), grouped by materialId (or by
 * itemName when there's no linked material).
 */
export async function getInventoryBalances(): Promise<InventoryBalance[]> {
  const entries = await prisma.inventoryEntry.findMany({ include: { material: true } });
  const map = new Map<string, InventoryBalance>();

  for (const e of entries) {
    const key = e.materialId ?? `name:${e.itemName}`;
    const existing = map.get(key);
    const delta = (e.direction === "in" ? 1 : -1) * toNumber(e.qty);
    if (existing) {
      existing.balance += delta;
    } else {
      map.set(key, {
        key,
        materialId: e.materialId,
        label: e.material?.name ?? e.itemName,
        unit: e.unit,
        balance: delta,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}
