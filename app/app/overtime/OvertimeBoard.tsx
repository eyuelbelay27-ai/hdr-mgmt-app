"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { OvertimeCard } from "./OvertimeCard";
import { AddOvertimeForm } from "./AddOvertimeForm";
import { loadMoreOvertimeRequestsAction, type OvertimeRequestData } from "./actions";

const FILTERS = ["All", "Pending", "Unpaid", "Paid", "Rejected"] as const;

/** "Unpaid"/"Paid" only ever mean Approved requests — a Pending or
 * Rejected one isn't owed anything yet. */
function matches(r: OvertimeRequestData, filter: (typeof FILTERS)[number]): boolean {
  if (filter === "All") return true;
  if (filter === "Unpaid") return r.status === "Approved" && !r.paid;
  if (filter === "Paid") return r.status === "Approved" && r.paid;
  return r.status === filter;
}

/**
 * Owns the request list as local state, seeded once from the server —
 * same pattern as the Price Database board, so approving/rejecting/
 * editing/withdrawing update the screen instantly without a page reload
 * or any risk of the list reshuffling under an in-progress edit.
 */
export function OvertimeBoard({
  initialRequests,
  initialHasMore,
  currentUserId,
  currentUserName,
  canSubmit,
  canApprove,
  canMarkPaid,
}: {
  initialRequests: OvertimeRequestData[];
  initialHasMore: boolean;
  currentUserId: string;
  currentUserName: string;
  canSubmit: boolean;
  canApprove: boolean;
  canMarkPaid: boolean;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [addOpen, setAddOpen] = useState(false);

  const handleUpdate = (id: string, patch: Partial<OvertimeRequestData>) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const handleRemove = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };
  const handleCreated = (request: OvertimeRequestData) => {
    setRequests((prev) => [request, ...prev]);
    setAddOpen(false);
  };
  const handleLoadMore = async () => {
    setLoadingMore(true);
    const result = await loadMoreOvertimeRequestsAction(requests.length);
    setRequests((prev) => [...prev, ...result.requests]);
    setHasMore(result.hasMore);
    setLoadingMore(false);
  };

  const visible = requests.filter((r) => matches(r, filter));
  const pendingCount = requests.filter((r) => r.status === "Pending").length;
  const unpaidCount = requests.filter((r) => matches(r, "Unpaid")).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {canSubmit && (
        addOpen ? (
          <div>
            <AddOvertimeForm onSubmitted={handleCreated} />
            <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-sm expense-add-toggle" onClick={() => setAddOpen(true)}>
            <Plus size={14} strokeWidth={2} /> New Overtime Request
          </button>
        )
      )}

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`tab${filter === f ? " active" : ""}`}
            style={{ whiteSpace: "nowrap" }}
            onClick={() => setFilter(f)}
          >
            {f}
            {f === "Pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            {f === "Unpaid" && unpaidCount > 0 ? ` (${unpaidCount})` : ""}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {visible.map((r) => (
          <OvertimeCard
            key={r.id}
            request={r}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            canSubmit={canSubmit}
            canApprove={canApprove}
            canMarkPaid={canMarkPaid}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
          />
        ))}
        {visible.length === 0 && <p className="label">No {filter === "All" ? "" : filter.toLowerCase() + " "}overtime requests.</p>}
      </div>

      {hasMore && filter === "All" && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button className="btn btn-sm" type="button" disabled={loadingMore} onClick={handleLoadMore}>
            {loadingMore ? "Loading…" : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
