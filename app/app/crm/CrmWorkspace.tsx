"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { LeadCard, type LeadCardHandlers } from "./LeadCard";
import { AddLeadForm } from "./AddLeadForm";
import { LeadFilters } from "./LeadFilters";
import { PeriodSummaryBar } from "./PeriodSummaryBar";
import { getCrmPeriodSummaryAction, loadMoreCrmLeadsAction } from "./actions";
import type { CrmLeadData, CrmLeadFilters, CrmPeriodSummary } from "./listData";

export type PendingMove = { leadId: string; status: "Closed" | "Failed" } | null;

const NO_FILTER: CrmLeadFilters = { period: { mode: "all" } };

/**
 * Owns the lead list as local state, seeded once from the server — the same
 * client-owns-the-list pattern as the Price Database, Overtime and Purchase
 * Order boards. Moving a card updates the screen instantly, and nothing
 * reshuffles under an in-progress edit.
 */
export function CrmWorkspace({
  currentUserId,
  isAdmin,
  reps,
  initialLeads,
  initialHasMore,
}: {
  currentUserId: string;
  isAdmin: boolean;
  reps: { id: string; name: string }[];
  initialLeads: CrmLeadData[];
  initialHasMore: boolean;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<CrmLeadFilters>(NO_FILTER);
  const [filtering, setFiltering] = useState(false);
  const [summary, setSummary] = useState<CrmPeriodSummary | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<PendingMove>(null);

  const handleUpdate = (lead: CrmLeadData) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
    setPendingMove(null);
  };
  const handleRemove = (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };
  const handleCreated = (lead: CrmLeadData) => {
    setLeads((prev) => [lead, ...prev]);
    setAddOpen(false);
  };
  const handleLoadMore = async () => {
    setLoadingMore(true);
    const result = await loadMoreCrmLeadsAction(leads.length, filters);
    setLeads((prev) => [...prev, ...result.leads]);
    setHasMore(result.hasMore);
    setLoadingMore(false);
  };
  const handleApplyFilters = async (next: CrmLeadFilters) => {
    setFiltering(true);
    setFilters(next);
    const [listResult, summaryResult] = await Promise.all([
      loadMoreCrmLeadsAction(0, next),
      getCrmPeriodSummaryAction(next),
    ]);
    setLeads(listResult.leads);
    setHasMore(listResult.hasMore);
    setSummary(next.period && next.period.mode !== "all" ? summaryResult : null);
    setFiltering(false);
  };

  const cardProps: LeadCardHandlers = {
    currentUserId,
    isAdmin,
    reps,
    pendingMove,
    onRequestMove: (leadId: string, status: "Closed" | "Failed") => setPendingMove({ leadId, status }),
    onCancelMove: () => setPendingMove(null),
    onUpdate: handleUpdate,
    onRemove: handleRemove,
  };

  return (
    <div className="crm-root">
      <div>
        <h1 style={{ marginTop: 0, marginBottom: 4 }}>CRM</h1>
        <p className="label" style={{ marginBottom: 0 }}>
          {isAdmin
            ? "Register every incoming lead and assign it to a sales rep. Filter by week or month to see how things are going."
            : "Your assigned leads. Move each one to its outcome as soon as you know it."}
        </p>
      </div>

      <div className="crm-section">
        {isAdmin &&
          (addOpen ? (
            <div>
              <AddLeadForm reps={reps} onCreated={handleCreated} />
              <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={() => setAddOpen(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-sm expense-add-toggle" onClick={() => setAddOpen(true)}>
              <Plus size={14} strokeWidth={2} /> New Lead
            </button>
          ))}

        <LeadFilters reps={reps} isAdmin={isAdmin} busy={filtering} onApply={handleApplyFilters} />

        {summary && <PeriodSummaryBar summary={summary} />}

        <span className="label" style={{ margin: 0 }}>
          {leads.length} lead{leads.length === 1 ? "" : "s"}
          {hasMore ? "+" : ""} shown
        </span>

        <div style={{ display: "grid", gap: 8 }}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} {...cardProps} />
          ))}
          {leads.length === 0 && <p className="label">No leads for this filter.</p>}
        </div>

        {hasMore && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="btn btn-sm" type="button" disabled={loadingMore} onClick={handleLoadMore}>
              {loadingMore ? "Loading…" : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
