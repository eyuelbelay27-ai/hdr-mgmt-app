import type { OvertimeRequestData } from "./actions";

export const OVERTIME_PAGE_SIZE = 25;

export function toRequestData(r: {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  employeeNames: string[];
  status: "Pending" | "Approved" | "Rejected";
  submittedById: string;
  submittedBy: { name: string };
  decidedBy: string | null;
  decidedAt: Date | null;
  rejectionNote: string | null;
}): OvertimeRequestData {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    startAt: r.startAt,
    employeeNames: r.employeeNames,
    status: r.status,
    submittedById: r.submittedById,
    submittedByName: r.submittedBy.name,
    decidedBy: r.decidedBy,
    decidedAt: r.decidedAt,
    rejectionNote: r.rejectionNote,
  };
}
