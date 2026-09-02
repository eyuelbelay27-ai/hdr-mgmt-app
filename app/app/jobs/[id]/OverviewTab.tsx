import { canSeeTab, type PermissionSubject } from "@/lib/permissions";
import { Lightbox } from "../../Lightbox";

interface OverviewJob {
  clientName: string;
  clientContact: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  clientNotes: string | null;
  title: string;
  designer: string | null;
  supervisor: string | null;
  createdAt: Date;
  payments: {
    id: string;
    type: string;
    amount: unknown;
    date: Date;
    receiptName: string | null;
    receiptUrl: string | null;
    receiptKind: string | null;
  }[];
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

export function OverviewTab({ job, user }: { job: OverviewJob; user: PermissionSubject }) {
  // Advance payment display is financial info, so it's gated the same way
  // as the rest of the money-related surface: tab_payments (Admin-only by
  // default, per Section 5.5's explicit repeated design decision) — the
  // brief describes Overview's financial snapshot only as "permission-
  // gated" without naming the exact permission, so this mirrors that
  // house rule rather than inventing a new one.
  const canSeeFinancials = canSeeTab(user, "tab_payments");
  const advance = job.payments.find((p) => p.type === "Advance");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <Field label="Client" value={job.clientName} />
        <Field label="Contact" value={job.clientContact} />
        <Field label="Phone" value={job.clientPhone} />
        <Field label="Address" value={job.clientAddress} />
        <Field label="Job Title" value={job.title} />
        <Field label="Designer" value={job.designer} />
        <Field label="Supervisor" value={job.supervisor} />
        <Field label="Created" value={job.createdAt.toISOString().slice(0, 10)} />
      </div>

      {job.clientNotes && (
        <div className="card" style={{ padding: 16 }}>
          <div className="label">Client Notes</div>
          <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{job.clientNotes}</div>
        </div>
      )}

      {canSeeFinancials && advance && (
        <div className="card" style={{ padding: 16 }}>
          <div className="label" style={{ marginBottom: 8 }}>Advance Payment</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {advance.receiptUrl && (
              <Lightbox
                file={{
                  name: advance.receiptName ?? "Advance proof",
                  url: advance.receiptUrl,
                  kind: advance.receiptKind ?? "application/octet-stream",
                }}
                size={64}
              />
            )}
            <div>
              <div style={{ fontWeight: 700 }}>{String(advance.amount)} Br</div>
              <div className="label" style={{ marginTop: 2 }}>
                {advance.date.toISOString().slice(0, 10)} · {advance.receiptName ?? "no file"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
