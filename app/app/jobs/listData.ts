import { Prisma, JobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can, type PermissionSubject } from "@/lib/permissions";
import { remainingPayment } from "@/lib/calc/payments";
import { toNumber } from "@/lib/money";

export const JOBS_PAGE_SIZE = 25;

export const STATUS_OPTIONS: JobStatus[] = [
  "Draft",
  "WaitingForApproval",
  "ApprovedBudget",
  "WaitingForReconciliation",
  "Closed",
  "Cancelled",
];

export interface JobListItem {
  id: string;
  jobNumber: string;
  clientName: string;
  designer: string | null;
  status: JobStatus;
  deadline: Date | null;
  updatedAt: Date;
  finalPrice: number;
  advance: number;
  remaining: number;
}

export interface JobListFilter {
  q: string;
  status: string;
}

function buildWhere(user: PermissionSubject, filter: JobListFilter): Prisma.JobWhereInput | undefined {
  const conditions: Prisma.JobWhereInput[] = [];
  // Draft jobs are visible only to users with manageDraftJobs (Section 5.4) —
  // deliberately decoupled from createJob.
  if (!can(user, "manageDraftJobs")) conditions.push({ status: { not: "Draft" } });
  const statusFilter = filter.status && STATUS_OPTIONS.includes(filter.status as JobStatus) ? (filter.status as JobStatus) : "";
  if (statusFilter) conditions.push({ status: statusFilter });
  const q = filter.q.trim();
  if (q) {
    conditions.push({
      OR: [
        { clientName: { contains: q, mode: "insensitive" } },
        { jobNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  return conditions.length ? { AND: conditions } : undefined;
}

function toListItem(j: {
  id: string;
  jobNumber: string;
  clientName: string;
  designer: string | null;
  status: JobStatus;
  deadline: Date | null;
  updatedAt: Date;
  costEstimateSoldPrice: unknown;
  payments: { type: string; amount: unknown }[];
}): JobListItem {
  const advance = j.payments.filter((p) => p.type === "Advance").reduce((s, p) => s + toNumber(p.amount), 0);
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    clientName: j.clientName,
    designer: j.designer,
    status: j.status,
    deadline: j.deadline,
    updatedAt: j.updatedAt,
    finalPrice: toNumber(j.costEstimateSoldPrice),
    advance,
    remaining: remainingPayment(j.costEstimateSoldPrice, j.payments),
  };
}

/** Fetches one page of jobs, `skip` rows in, ordered by most recently
 * updated. Returns one extra row beyond `JOBS_PAGE_SIZE` (trimmed off) so
 * the caller knows whether a further page exists without a second count
 * query. */
export async function fetchJobsPage(
  user: PermissionSubject,
  filter: JobListFilter,
  skip: number
): Promise<{ jobs: JobListItem[]; hasMore: boolean }> {
  const rows = await prisma.job.findMany({
    where: buildWhere(user, filter),
    orderBy: { updatedAt: "desc" },
    include: { payments: true },
    skip,
    take: JOBS_PAGE_SIZE + 1,
  });
  const hasMore = rows.length > JOBS_PAGE_SIZE;
  return { jobs: rows.slice(0, JOBS_PAGE_SIZE).map(toListItem), hasMore };
}
