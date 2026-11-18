"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { canSeePage, PermissionError } from "@/lib/permissions";
import { CB_DEFAULTS, type CbEntry, type CbSettings } from "@/lib/cashbook";
import { toCbEntry, toCbSettings } from "./data";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
type Result<T> = { error: string } | ({ error?: undefined } & T);
const validDate = (s: unknown) => DATE_RE.test(String(s)) && !Number.isNaN(new Date(String(s)).getTime());

async function guard<T>(fn: (name: string) => Promise<Result<T>>): Promise<Result<T>> {
  try {
    const user = await requireCurrentUser();
    if (!canSeePage(user, "cashbook")) throw new PermissionError("You don't have access to the Cash Book.");
    return await fn(user.name);
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
}

export interface CbEntryInput {
  type: "in" | "out";
  amount: number;
  date: string;
  description: string;
  bank: string;
  category: string;
  ref: string;
}

export async function saveCbEntryAction(id: string | null, input: CbEntryInput): Promise<Result<{ entry: CbEntry }>> {
  return guard<{ entry: CbEntry }>(async (by) => {
    const amount = Math.round(Number(input?.amount) * 100) / 100;
    if (!(amount > 0) || amount > 999_999_999_999) return { error: "Enter an amount above zero." };
    if (input.type !== "in" && input.type !== "out") return { error: "Choose Cash In or Cash Out." };
    if (!validDate(input.date)) return { error: "Pick a date." };
    const description = String(input.description ?? "").trim().slice(0, 300);
    if (!description) return { error: "Enter a description before saving." };
    const bank = String(input.bank ?? "").trim().slice(0, 100);
    if (!bank) return { error: "Choose the bank." };
    const data = {
      type: input.type,
      amount,
      date: new Date(`${input.date}T00:00:00.000Z`),
      description,
      bank,
      category: String(input.category ?? "").trim().slice(0, 100) || null,
      ref: String(input.ref ?? "").trim().slice(0, 100) || null,
    };
    let e;
    if (id) {
      if (!(await prisma.cashBookEntry.findUnique({ where: { id }, select: { id: true } }))) return { error: "Entry not found." };
      e = await prisma.cashBookEntry.update({ where: { id }, data });
    } else {
      e = await prisma.cashBookEntry.create({ data: { ...data, createdBy: by } });
    }
    revalidatePath("/cashbook");
    return { entry: toCbEntry(e) };
  });
}

export async function deleteCbEntryAction(id: string): Promise<Result<{ ok: true }>> {
  return guard<{ ok: true }>(async () => {
    await prisma.cashBookEntry.deleteMany({ where: { id: String(id) } });
    revalidatePath("/cashbook");
    return { ok: true };
  });
}

const cleanList = (v: unknown) => {
  const out: string[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const s = String(x ?? "").trim().slice(0, 100);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out.slice(0, 50);
};

export async function saveCbSettingsAction(input: CbSettings): Promise<Result<{ settings: CbSettings }>> {
  return guard<{ settings: CbSettings }>(async () => {
    const opening = Math.round(Number(input?.opening) * 100) / 100;
    if (!Number.isFinite(opening) || Math.abs(opening) > 999_999_999_999) return { error: "Enter a valid opening balance." };
    if (input.openingDate && !validDate(input.openingDate)) return { error: "Pick a valid date." };
    const data = {
      banks: cleanList(input.banks),
      categories: cleanList(input.categories),
      opening,
      openingDate: input.openingDate ? new Date(`${input.openingDate}T00:00:00.000Z`) : null,
      company: String(input.company ?? "").trim().slice(0, 120) || CB_DEFAULTS.company,
      address: String(input.address ?? "").trim().slice(0, 200),
      preparedBy: String(input.preparedBy ?? "").trim().slice(0, 80),
    };
    const s = await prisma.cashBookSettings.upsert({ where: { id: "main" }, create: { id: "main", ...data }, update: data });
    revalidatePath("/cashbook");
    return { settings: toCbSettings(s) };
  });
}
