"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { RequestCard } from "./RequestCard";
import { RequestForm, br } from "./RequestForm";
import type { EligibleJob, InstallationRequestData } from "./data";

const FILTERS = ["Waiting", "Approved", "Rejected", "All"] as const;
const STATUS: Record<(typeof FILTERS)[number], string | null> = { Waiting: "Pending", Approved: "Approved", Rejected: "Rejected", All: null };

/**
 * Same pattern as Overtime Control: the list lives in local state seeded
 * from the server, so approving / rejecting / editing updates instantly.
 */
export function InstallationBoard({
  initialRequests,
  jobs,
  currentUserId,
  currentUserName,
  canRequest,
  canApprove,
}: {
  initialRequests: InstallationRequestData[];
  jobs: EligibleJob[];
  currentUserId: string;
  currentUserName: string;
  canRequest: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(canApprove && initialRequests.some((r) => r.status === "Pending") ? "Waiting" : "All");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<{ editing?: InstallationRequestData } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const replace = (req: InstallationRequestData) => setRequests((prev) => [req, ...prev.filter((r) => r.id !== req.id)]);
  const update = (id: string, patch: Partial<InstallationRequestData>) => setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    router.refresh(); // the job becomes available for a new request again
  };

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f, STATUS[f] ? requests.filter((r) => r.status === STATUS[f]).length : requests.length])) as Record<(typeof FILTERS)[number], number>,
    [requests]
  );
  const q = query.trim().toLowerCase();
  const visible = requests.filter(
    (r) =>
      (!STATUS[filter] || r.status === STATUS[filter]) &&
      (!q || [r.jobNumber, r.jobTitle, r.clientName, r.submittedByName].some((x) => x.toLowerCase().includes(q)))
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {canRequest &&
        (form ? (
          <RequestForm
            jobs={jobs}
            editing={form.editing}
            onCancel={() => setForm(null)}
            onDone={(req) => {
              replace(req);
              setForm(null);
              setFilter("All");
              router.refresh();
            }}
          />
        ) : (
          <button type="button" className="btn btn-sm expense-add-toggle" onClick={() => setForm({})}>
            <Plus size={14} strokeWidth={2} /> New Installation Request
          </button>
        ))}

      <div className="inst-toolbar">
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", overflowX: "auto", flex: "1 1 auto" }}>
          {FILTERS.map((f) => (
            <button key={f} type="button" className={`tab${filter === f ? " active" : ""}`} style={{ whiteSpace: "nowrap" }} onClick={() => setFilter(f)}>
              {f}
              {counts[f] > 0 && f !== "All" ? ` (${counts[f]})` : ""}
            </button>
          ))}
        </div>
        <label className="inst-search">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search job, client, person" aria-label="Search requests" />
        </label>
      </div>

      {flash && <div className="inst-flash" role="status">{flash}</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {visible.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            canRequest={canRequest}
            canApprove={canApprove}
            onUpdate={update}
            onReplace={(req) => {
              replace(req);
              if (req.status === "Approved") {
                setFlash(`Approved ${req.jobNumber}.${req.payments.length ? ` ${req.payments.length} payment${req.payments.length === 1 ? "" : "s"} (${br(req.requestTotal)}) recorded on the job.` : ""}`);
                router.refresh();
              }
            }}
            onRemove={remove}
            onEdit={(req) => {
              setForm({ editing: req });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        ))}
        {visible.length === 0 && <p className="label">No {filter === "All" ? "" : filter.toLowerCase() + " "}installation requests{q ? " match the search" : ""}.</p>}
      </div>
    </div>
  );
}
