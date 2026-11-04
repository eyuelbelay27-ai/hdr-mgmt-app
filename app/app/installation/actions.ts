"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { can, canSeePage, PermissionError } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { toNumber, round2 } from "@/lib/money";
import { remainingPayment } from "@/lib/calc/payments";
import { getUploadedFile, isStoredUploadUrl, saveUpload } from "@/lib/storage";
import { APPROVAL_SMS_PHONES, installationSmsText, sendSms } from "@/lib/sms";
import { loadRequests, type FileData, type InstallationRequestData } from "./data";
import { PAYMENT_METHODS } from "./shared";

export interface ActionState {
  error: string | null;
}

export interface RequestInput {
  jobId: string;
  payments: { amount: number; method: string; receipt: FileData }[];
  withholding: FileData | null;
  note: string;
}

const fmt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} Br`;

async function userWith(action: "requestInstallation" | "approveInstallation") {
  const user = await requireCurrentUser();
  if (!canSeePage(user, "installation") || !can(user, action)) {
    throw new PermissionError(action === "approveInstallation" ? "You can't approve installation requests." : "You can't send installation requests.");
  }
  return user;
}

function cleanFile(f: unknown): FileData | null {
  if (!f || typeof f !== "object") return null;
  const x = f as FileData;
  if (!isStoredUploadUrl(x.url)) return null;
  return { name: String(x.name ?? "file").slice(0, 200), url: x.url, kind: String(x.kind ?? "application/octet-stream").slice(0, 100) };
}

/** Checks what the employee filled; returns a tidy copy or an error message. */
function checkInput(input: RequestInput, remaining: number): { ok: RequestInput } | { error: string } {
  const payments: RequestInput["payments"] = [];
  const list = Array.isArray(input.payments) ? input.payments : [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const amount = round2(Number(p?.amount));
    if (!Number.isFinite(amount) || amount <= 0) return { error: `Payment ${i + 1}: enter an amount greater than 0.` };
    const receipt = cleanFile(p?.receipt);
    if (!receipt) return { error: `Payment ${i + 1}: attach the receipt photo.` };
    const method = PAYMENT_METHODS.includes(String(p?.method)) ? String(p.method) : "Other";
    payments.push({ amount, method, receipt });
  }
  if (!payments.length && remaining > 0) return { error: "Add the remaining payment with its receipt photo." };
  if (input.withholding && !cleanFile(input.withholding)) return { error: "The withholding receipt didn't upload; attach it again." };
  return { ok: { jobId: input.jobId, payments, withholding: cleanFile(input.withholding), note: String(input.note ?? "").trim().slice(0, 1000) } };
}

/** Uploads one receipt photo (each file goes up on its own to stay under the 1 MB limit). */
export async function uploadInstallationFileAction(formData: FormData): Promise<{ file: FileData } | { error: string }> {
  try {
    await userWith("requestInstallation");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const f = getUploadedFile(formData, "file");
  if (!f) return { error: "Choose a file." };
  try {
    const stored = await saveUpload(f);
    return { file: { name: stored.name, url: stored.url, kind: stored.kind } };
  } catch {
    return { error: "Couldn't upload the picture. Check your connection and try again." };
  }
}

async function notify(job: { jobNumber: string; title: string; id: string }, resent: boolean) {
  const results = await sendSms(APPROVAL_SMS_PHONES, installationSmsText(job, resent));
  const sent = results.filter((r) => r.ok).map((r) => r.phone);
  const failed = results.filter((r) => !r.ok);
  if (sent.length) await logActivity(job.id, `Installation approval SMS sent to ${sent.join(" and ")}.`);
  if (failed.length) await logActivity(job.id, `Installation approval SMS could not be sent to ${failed.map((r) => `${r.phone} (${r.error})`).join(", ")}.`);
}

async function reload(userId: string, id: string, canApprove: boolean): Promise<InstallationRequestData | null> {
  return (await loadRequests(userId, canApprove)).find((r) => r.id === id) ?? null;
}

export async function createInstallationRequestAction(input: RequestInput): Promise<{ error: string } | { request: InstallationRequestData }> {
  let user;
  try {
    user = await userWith("requestInstallation");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const job = await prisma.job.findUnique({
    where: { id: String(input?.jobId ?? "") },
    select: { id: true, jobNumber: true, title: true, status: true, costEstimateSoldPrice: true, payments: { select: { type: true, amount: true } } },
  });
  if (!job) return { error: "Pick the job to be installed." };
  if (job.status !== "ApprovedBudget") return { error: "Only a job in implementation (Approved Budget) can be sent for installation approval." };
  if (await prisma.installationRequest.findFirst({ where: { jobId: job.id, status: "Pending" }, select: { id: true } })) {
    return { error: "This job already has an installation request waiting for approval." };
  }
  const checked = checkInput(input, remainingPayment(job.costEstimateSoldPrice, job.payments));
  if ("error" in checked) return checked;
  const v = checked.ok;

  const created = await prisma.installationRequest.create({
    data: {
      jobId: job.id,
      submittedById: user.id,
      note: v.note || null,
      withholdingName: v.withholding?.name ?? null,
      withholdingUrl: v.withholding?.url ?? null,
      withholdingKind: v.withholding?.kind ?? null,
      payments: { create: v.payments.map((p) => ({ amount: p.amount, method: p.method, receiptName: p.receipt.name, receiptUrl: p.receipt.url, receiptKind: p.receipt.kind })) },
    },
  });
  const total = round2(v.payments.reduce((s, p) => s + p.amount, 0));
  await logActivity(
    job.id,
    `${user.name} requested installation approval with ${v.payments.length} payment${v.payments.length === 1 ? "" : "s"} (${fmt(total)})${v.withholding ? " and a withholding receipt" : ""}.`
  );
  await notify(job, false);
  revalidatePath("/installation");
  const request = await reload(user.id, created.id, can(user, "approveInstallation"));
  return request ? { request } : { error: "Saved, but couldn't reload it. Refresh the page." };
}

/** The owner edits a waiting request, or fixes a rejected one and sends it again. */
export async function updateInstallationRequestAction(id: string, input: RequestInput): Promise<{ error: string } | { request: InstallationRequestData }> {
  let user;
  try {
    user = await userWith("requestInstallation");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const req = await prisma.installationRequest.findUnique({
    where: { id },
    include: { job: { select: { id: true, jobNumber: true, title: true, status: true, costEstimateSoldPrice: true, payments: { select: { type: true, amount: true } } } } },
  });
  if (!req || req.submittedById !== user.id) return { error: "Request not found." };
  if (req.status === "Approved") return { error: "An approved request can't be changed." };
  if (req.job.status !== "ApprovedBudget") return { error: "This job is no longer in implementation." };
  if (req.status === "Rejected" && (await prisma.installationRequest.findFirst({ where: { jobId: req.jobId, status: "Pending", NOT: { id } }, select: { id: true } }))) {
    return { error: "This job already has another installation request waiting for approval." };
  }
  const checked = checkInput({ ...input, jobId: req.jobId }, remainingPayment(req.job.costEstimateSoldPrice, req.job.payments));
  if ("error" in checked) return checked;
  const v = checked.ok;
  const resend = req.status === "Rejected";

  await prisma.$transaction([
    prisma.installationPayment.deleteMany({ where: { requestId: id } }),
    prisma.installationRequest.update({
      where: { id },
      data: {
        note: v.note || null,
        withholdingName: v.withholding?.name ?? null,
        withholdingUrl: v.withholding?.url ?? null,
        withholdingKind: v.withholding?.kind ?? null,
        payments: { create: v.payments.map((p) => ({ amount: p.amount, method: p.method, receiptName: p.receipt.name, receiptUrl: p.receipt.url, receiptKind: p.receipt.kind })) },
        ...(resend ? { status: "Pending", submittedAt: new Date(), sendCount: { increment: 1 }, decidedBy: null, decidedAt: null, rejectionNote: null } : {}),
      },
    }),
  ]);
  const total = round2(v.payments.reduce((s, p) => s + p.amount, 0));
  await logActivity(
    req.jobId,
    resend
      ? `${user.name} fixed and re-sent the installation request (${v.payments.length} payment${v.payments.length === 1 ? "" : "s"}, ${fmt(total)}).`
      : `${user.name} edited the waiting installation request (${v.payments.length} payment${v.payments.length === 1 ? "" : "s"}, ${fmt(total)}).`
  );
  if (resend) await notify(req.job, true);
  revalidatePath("/installation");
  const request = await reload(user.id, id, can(user, "approveInstallation"));
  return request ? { request } : { error: "Saved, but couldn't reload it. Refresh the page." };
}

export async function withdrawInstallationRequestAction(id: string): Promise<ActionState> {
  let user;
  try {
    user = await userWith("requestInstallation");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const req = await prisma.installationRequest.findUnique({ where: { id }, select: { submittedById: true, status: true, jobId: true } });
  if (!req || req.submittedById !== user.id) return { error: "Request not found." };
  if (req.status === "Approved") return { error: "An approved request can't be withdrawn." };
  await prisma.installationRequest.delete({ where: { id } });
  await logActivity(req.jobId, `${user.name} withdrew the installation request.`);
  revalidatePath("/installation");
  return { error: null };
}

/** Approve: only now are the request's payments recorded on the job (as Final payments). */
export async function approveInstallationRequestAction(id: string): Promise<{ error: string } | { request: InstallationRequestData }> {
  let user;
  try {
    user = await userWith("approveInstallation");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const req = await prisma.installationRequest.findUnique({
    where: { id },
    include: { payments: true, submittedBy: { select: { name: true } }, job: { select: { id: true, status: true, costEstimateSoldPrice: true, payments: { select: { type: true, amount: true } } } } },
  });
  if (!req) return { error: "Request not found." };
  if (req.status !== "Pending") return { error: "Only a waiting request can be approved." };
  if (req.job.status === "Closed") return { error: "This job is Closed; payments can't be recorded on it." };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const p of req.payments) {
      const payment = await tx.payment.create({
        data: {
          jobId: req.jobId,
          amount: p.amount,
          type: "Final",
          method: p.method,
          date: now,
          notes: `Installation approval — collected by ${req.submittedBy.name}`,
          receiptName: p.receiptName,
          receiptUrl: p.receiptUrl,
          receiptKind: p.receiptKind,
        },
      });
      await tx.installationPayment.update({ where: { id: p.id }, data: { paymentId: payment.id } });
    }
    await tx.installationRequest.update({ where: { id }, data: { status: "Approved", decidedBy: user.name, decidedAt: now, rejectionNote: null } });
  }, { timeout: 20000 });

  const total = round2(req.payments.reduce((s, p) => s + toNumber(p.amount), 0));
  const left = Math.max(0, round2(remainingPayment(req.job.costEstimateSoldPrice, req.job.payments) - total));
  await logActivity(
    req.jobId,
    `${user.name} approved the installation request.${req.payments.length ? ` ${req.payments.length} payment${req.payments.length === 1 ? "" : "s"} (${fmt(total)}) recorded on the job.` : ""} Remaining balance: ${fmt(left)}.`
  );
  revalidatePath("/installation");
  revalidatePath(`/jobs/${req.jobId}`);
  const request = await reload(user.id, id, true);
  return request ? { request } : { error: "Approved, but couldn't reload it. Refresh the page." };
}

export async function rejectInstallationRequestAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  let user;
  try {
    user = await userWith("approveInstallation");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Write the reason." };
  const req = await prisma.installationRequest.findUnique({ where: { id }, select: { status: true, jobId: true } });
  if (!req) return { error: "Request not found." };
  if (req.status !== "Pending") return { error: "Only a waiting request can be rejected." };
  await prisma.installationRequest.update({ where: { id }, data: { status: "Rejected", decidedBy: user.name, decidedAt: new Date(), rejectionNote: note.slice(0, 1000) } });
  await logActivity(req.jobId, `${user.name} rejected the installation request: ${note}`);
  revalidatePath("/installation");
  return { error: null };
}

/** Approvers can delete a waiting or rejected request (never an approved one: its payments are on the job). */
export async function deleteInstallationRequestAction(id: string): Promise<ActionState> {
  let user;
  try {
    user = await userWith("approveInstallation");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }
  const req = await prisma.installationRequest.findUnique({ where: { id }, select: { status: true, jobId: true } });
  if (!req) return { error: "Request not found." };
  if (req.status === "Approved") return { error: "An approved request can't be deleted; its payments are on the job." };
  await prisma.installationRequest.delete({ where: { id } });
  await logActivity(req.jobId, `${user.name} deleted an installation request.`);
  revalidatePath("/installation");
  return { error: null };
}
