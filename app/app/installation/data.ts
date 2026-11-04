import { prisma } from "@/lib/prisma";
import { toNumber, round2 } from "@/lib/money";
import { remainingPayment } from "@/lib/calc/payments";
import { appJobKey, ethSlot, readStore } from "@/lib/workshop/store";

export interface FileData {
  name: string;
  url: string;
  kind: string;
}

export interface InstallationPaymentData {
  id: string;
  amount: number;
  method: string | null;
  receipt: FileData;
}

export interface JobPaymentData {
  id: string;
  type: string;
  amount: number;
  method: string | null;
  date: Date;
  receipt: FileData | null;
}

export interface InstallationRequestData {
  id: string;
  status: "Pending" | "Approved" | "Rejected";
  jobId: string;
  jobNumber: string;
  jobTitle: string;
  clientName: string;
  salesRep: string | null;
  note: string | null;
  submittedById: string;
  submittedByName: string;
  submittedAt: Date;
  sendCount: number;
  decidedBy: string | null;
  decidedAt: Date | null;
  rejectionNote: string | null;
  withholding: FileData | null;
  payments: InstallationPaymentData[];
  requestTotal: number;
  /** Remaining on the job before this request's payments (after them, once approved). */
  remainingBefore: number;
  remainingAfter: number;
  installDays: string[];
  /** Approver-only: the job's price and every payment already on it. */
  soldPrice: number | null;
  jobPayments: JobPaymentData[] | null;
}

export interface EligibleJob {
  id: string;
  jobNumber: string;
  title: string;
  clientName: string;
  remaining: number;
}

const file = (name: string | null, url: string | null, kind: string | null): FileData | null =>
  url ? { name: name ?? "file", url, kind: kind ?? "application/octet-stream" } : null;

/**
 * Requests visible to this user, newest first: approvers see every
 * request, requesters only their own. The job's price and its payment
 * list are only included for approvers (they're financial details).
 */
export async function loadRequests(userId: string, canApprove: boolean): Promise<InstallationRequestData[]> {
  const rows = await prisma.installationRequest.findMany({
    where: canApprove ? {} : { submittedById: userId },
    orderBy: { submittedAt: "desc" },
    take: 300,
    include: {
      submittedBy: { select: { name: true } },
      payments: { orderBy: { createdAt: "asc" } },
      job: {
        select: {
          id: true,
          jobNumber: true,
          title: true,
          clientName: true,
          salesRep: true,
          costEstimateSoldPrice: true,
          payments: { orderBy: { date: "asc" } },
        },
      },
    },
  });

  const { state } = await readStore();
  const installDays = (jobId: string) =>
    state.entries
      .filter((e) => e.job === appJobKey(jobId) && e.stage === "inst")
      .map((e) => `${e.date}|${e.shift}`)
      .sort()
      .map(ethSlot);

  return rows.map((r) => {
    const requestTotal = round2(r.payments.reduce((s, p) => s + toNumber(p.amount), 0));
    // Once approved, this request's payments are already on the job.
    const recorded = new Set(r.payments.map((p) => p.paymentId).filter(Boolean));
    const before = r.job.payments.filter((p) => !recorded.has(p.id));
    const remainingBefore = remainingPayment(r.job.costEstimateSoldPrice, before);
    return {
      id: r.id,
      status: r.status,
      jobId: r.job.id,
      jobNumber: r.job.jobNumber,
      jobTitle: r.job.title,
      clientName: r.job.clientName,
      salesRep: r.job.salesRep,
      note: r.note,
      submittedById: r.submittedById,
      submittedByName: r.submittedBy.name,
      submittedAt: r.submittedAt,
      sendCount: r.sendCount,
      decidedBy: r.decidedBy,
      decidedAt: r.decidedAt,
      rejectionNote: r.rejectionNote,
      withholding: file(r.withholdingName, r.withholdingUrl, r.withholdingKind),
      payments: r.payments.map((p) => ({
        id: p.id,
        amount: toNumber(p.amount),
        method: p.method,
        receipt: { name: p.receiptName, url: p.receiptUrl, kind: p.receiptKind },
      })),
      requestTotal,
      remainingBefore,
      remainingAfter: Math.max(0, round2(remainingBefore - requestTotal)),
      installDays: installDays(r.job.id),
      soldPrice: canApprove ? toNumber(r.job.costEstimateSoldPrice) : null,
      jobPayments: canApprove
        ? before.map((p) => ({
            id: p.id,
            type: p.type,
            amount: toNumber(p.amount),
            method: p.method,
            date: p.date,
            receipt: file(p.receiptName, p.receiptUrl, p.receiptKind),
          }))
        : null,
    };
  });
}

/** Jobs a request can be made for: in implementation, with no request waiting. */
export async function loadEligibleJobs(): Promise<EligibleJob[]> {
  const jobs = await prisma.job.findMany({
    where: { status: "ApprovedBudget", installationRequests: { none: { status: "Pending" } } },
    orderBy: { jobNumber: "desc" },
    select: { id: true, jobNumber: true, title: true, clientName: true, costEstimateSoldPrice: true, payments: { select: { type: true, amount: true } } },
  });
  return jobs.map((j) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    title: j.title,
    clientName: j.clientName,
    remaining: remainingPayment(j.costEstimateSoldPrice, j.payments),
  }));
}
