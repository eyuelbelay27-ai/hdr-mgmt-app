"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { canSeePage, PermissionError } from "@/lib/permissions";
import { getUploadedFile, isStoredUploadUrl, saveUpload } from "@/lib/storage";
import type { Account, AccountType, Entry } from "@/lib/pnl";
import { toEntry } from "./data";

const TYPES: AccountType[] = ["asset", "liability", "equity", "income", "expense"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
type Result<T> = { error: string } | ({ error?: undefined } & T);

async function pnlUser() {
  const user = await requireCurrentUser();
  if (!canSeePage(user, "pnl")) throw new PermissionError("You don't have access to P&L.");
  return user;
}
async function guard<T>(fn: (name: string) => Promise<Result<T>>): Promise<Result<T>> {
  try {
    const user = await pnlUser();
    return await fn(user.name);
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
}

export async function saveAccountAction(id: string | null, name: string, type: AccountType): Promise<Result<{ account: Account }>> {
  return guard<{ account: Account }>(async () => {
    const n = String(name ?? "").trim().slice(0, 80);
    if (!n) return { error: "Give the account a name." };
    if (!TYPES.includes(type)) return { error: "Choose a type." };
    const clash = await prisma.pnlAccount.findFirst({ where: { name: { equals: n, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
    if (clash) return { error: "An account with this name already exists." };
    if (id) {
      const cur = await prisma.pnlAccount.findUnique({ where: { id }, include: { _count: { select: { cashEntries: true, entries: true } } } });
      if (!cur) return { error: "Account not found." };
      const used = cur._count.cashEntries + cur._count.entries > 0;
      if (used && cur.type !== type) return { error: "Type is locked because this account has entries." };
      const a = await prisma.pnlAccount.update({ where: { id }, data: { name: n, type } });
      revalidatePath("/pnl");
      return { account: { id: a.id, name: a.name, type: a.type } };
    }
    const a = await prisma.pnlAccount.create({ data: { name: n, type } });
    revalidatePath("/pnl");
    return { account: { id: a.id, name: a.name, type: a.type } };
  });
}

export async function deleteAccountAction(id: string): Promise<Result<{ ok: true }>> {
  return guard<{ ok: true }>(async () => {
    const cur = await prisma.pnlAccount.findUnique({ where: { id }, include: { _count: { select: { cashEntries: true, entries: true } } } });
    if (!cur) return { error: "Account not found." };
    if (cur._count.cashEntries + cur._count.entries > 0) return { error: "This account has entries. Delete or move them first." };
    await prisma.pnlAccount.delete({ where: { id } });
    revalidatePath("/pnl");
    return { ok: true };
  });
}

export interface EntryInput {
  kind: "in" | "out";
  amount: number;
  cashId: string;
  accountId: string;
  date: string;
  note: string;
  ref: string;
  receipt: { name: string; url: string; kind: string } | null;
}

export async function saveEntryAction(id: string | null, input: EntryInput): Promise<Result<{ entry: Entry }>> {
  return guard<{ entry: Entry }>(async (by) => {
    const amount = Math.round(Number(input?.amount) * 100) / 100;
    if (!(amount > 0)) return { error: "Enter an amount above zero." };
    if (input.kind !== "in" && input.kind !== "out") return { error: "Choose money in or money out." };
    if (!DATE_RE.test(String(input.date)) || Number.isNaN(new Date(input.date).getTime())) return { error: "Choose the date." };
    const note = String(input.note ?? "").trim().slice(0, 300);
    if (!note) return { error: "Enter a description." };
    const [cash, acct] = await Promise.all([
      prisma.pnlAccount.findUnique({ where: { id: String(input.cashId) } }),
      prisma.pnlAccount.findUnique({ where: { id: String(input.accountId) } }),
    ]);
    if (!cash || cash.type !== "asset") return { error: "Choose the cash or bank account." };
    if (!acct) return { error: input.kind === "in" ? "Choose what the money was received for." : "Choose what the money was spent on." };
    if (acct.id === cash.id) return { error: "Choose two different accounts." };
    const receipt = input.receipt && isStoredUploadUrl(input.receipt.url) ? input.receipt : null;
    const data = {
      kind: input.kind,
      amount,
      cashId: cash.id,
      accountId: acct.id,
      date: new Date(`${input.date}T00:00:00.000Z`),
      note,
      ref: String(input.ref ?? "").trim().slice(0, 100) || null,
      receiptName: receipt ? String(receipt.name).slice(0, 200) : null,
      receiptUrl: receipt ? receipt.url : null,
      receiptKind: receipt ? String(receipt.kind).slice(0, 100) : null,
    };
    if (id) {
      if (!(await prisma.pnlEntry.findUnique({ where: { id }, select: { id: true } }))) return { error: "Entry not found." };
      const e = await prisma.pnlEntry.update({ where: { id }, data });
      revalidatePath("/pnl");
      return { entry: toEntry(e) };
    }
    const e = await prisma.pnlEntry.create({ data: { ...data, createdBy: by } });
    revalidatePath("/pnl");
    return { entry: toEntry(e) };
  });
}

export async function deleteEntryAction(id: string): Promise<Result<{ ok: true }>> {
  return guard<{ ok: true }>(async () => {
    await prisma.pnlEntry.deleteMany({ where: { id } });
    revalidatePath("/pnl");
    return { ok: true };
  });
}

/** One receipt photo, uploaded on its own (the client shrinks it under 1 MB first). */
export async function uploadPnlReceiptAction(formData: FormData): Promise<Result<{ file: { name: string; url: string; kind: string } }>> {
  return guard<{ file: { name: string; url: string; kind: string } }>(async () => {
    const f = getUploadedFile(formData, "file");
    if (!f) return { error: "Choose a file." };
    try {
      const s = await saveUpload(f);
      return { file: { name: s.name, url: s.url, kind: s.kind } };
    } catch {
      return { error: "Couldn't upload the picture. Check your connection and try again." };
    }
  });
}
