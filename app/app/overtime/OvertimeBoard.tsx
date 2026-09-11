"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { OvertimeCard } from "./OvertimeCard";
import { AddOvertimeForm } from "./AddOvertimeForm";
import { loadMoreOvertimeRequestsAction, type OvertimeRequestData } from "./actions";

const FILTERS = ["All", "Pending", "Approved", "Rejected"] as const;

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
}: {
  initialRequests: OvertimeRequestData[];
  initialHasMore: boolean;
  currentUserId: string;
  currentUserName: string;
  canSubmit: boolean;
  canApprove: boolean;
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

  const visible = filter === "All" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "Pending").length;

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
