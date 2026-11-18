import { toNumber } from "@/lib/money";
import { CB_DEFAULTS, type CbEntry, type CbSettings } from "@/lib/cashbook";

export interface CbEntryRow {
  id: string;
  type: "in" | "out";
  amount: unknown;
  date: Date;
  description: string;
  bank: string;
  category: string | null;
  ref: string | null;
  createdBy: string;
  createdAt: Date;
}
export function toCbEntry(e: CbEntryRow): CbEntry {
  return {
    id: e.id,
    type: e.type,
    amount: toNumber(e.amount),
    date: e.date.toISOString().slice(0, 10),
    description: e.description,
    bank: e.bank,
    category: e.category,
    ref: e.ref,
    createdBy: e.createdBy,
    createdAt: e.createdAt.getTime(),
  };
}

export interface CbSettingsRow {
  banks: string[];
  categories: string[];
  opening: unknown;
  openingDate: Date | null;
  company: string;
  address: string;
  preparedBy: string;
}
export function toCbSettings(s: CbSettingsRow | null): CbSettings {
  if (!s) return CB_DEFAULTS;
  return {
    banks: s.banks,
    categories: s.categories,
    opening: toNumber(s.opening),
    openingDate: s.openingDate ? s.openingDate.toISOString().slice(0, 10) : null,
    company: s.company,
    address: s.address,
    preparedBy: s.preparedBy,
  };
}
