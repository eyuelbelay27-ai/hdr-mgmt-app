import { JobStatus } from "@prisma/client";
import { STATUS_COLOR, STATUS_LABEL, deadlineBadgeTone } from "@/lib/job-status";

export function StatusBadge({ status }: { status: JobStatus }) {
  const { bg, fg } = STATUS_COLOR[status];
  return (
    <span className="badge" style={{ background: bg, color: fg }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const TONE_COLOR = {
  amber: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  red: { bg: "var(--danger-soft)", fg: "var(--danger)" },
};

/** Shown next to the client name everywhere the job appears (Section 6.1). */
export function DeadlineBadge({ deadline, status }: { deadline: Date; status: JobStatus }) {
  const tone = deadlineBadgeTone(deadline, status);
  if (!tone) return null;
  const { bg, fg } = TONE_COLOR[tone];
  return (
    <span className="badge" style={{ background: bg, color: fg }}>
      Due {deadline.toISOString().slice(0, 10)}
    </span>
  );
}
