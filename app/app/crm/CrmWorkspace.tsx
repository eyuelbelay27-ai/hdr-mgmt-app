"use client";

import { useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { LeadCard, type LeadCardHandlers } from "./LeadCard";
import { AddLeadForm } from "./AddLeadForm";
import { LeadFilters } from "./LeadFilters";
import { PeriodSummaryBar } from "./PeriodSummaryBar";
import { CrmSettingsPanel } from "./CrmSettingsPanel";
import { getCrmPeriodSummaryAction, loadMoreCrmLeadsAction, type CrmOverdueRep } from "./actions";
import type { CrmLeadData, CrmLeadFilters, CrmPeriodSummary } from "./listData";
import type { CrmSchedule } from "@/lib/crm/schedule";

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
  initialDueLeads,
  overdueReps,
  schedule,
}: {
  currentUserId: string;
  isAdmin: boolean;
  reps: { id: string; name: string }[];
  initialLeads: CrmLeadData[];
  initialHasMore: boolean;
  initialDueLeads: CrmLeadData[];
  overdueReps: CrmOverdueRep[];
  schedule: CrmSchedule;
}) {
  const [section, setSection] = useState<"leads" | "settings">("leads");
  const [leads, setLeads] = useState(initialLeads);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<CrmLeadFilters>(NO_FILTER);
  const [filtering, setFiltering] = useState(false);
  const [summary, setSummary] = useState<CrmPeriodSummary | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<PendingMove>(null);
  // The rep-side blocking gate — a lead drops out of this list the moment
  // its status is re-confirmed, and once it's empty the normal Leads view
  // appears with no reload needed.
  const [dueLeads, setDueLeads] = useState(initialDueLeads);

  const handleUpdate = (lead: CrmLeadData) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
    // Still flagged (e.g. only the phone was just revealed) → update it in
    // place so the gate reflects the fresh data. No longer flagged (a
    // status was just confirmed) → drop it, resolved.
    setDueLeads((prev) =>
      lead.dueForReview ? prev.map((l) => (l.id === lead.id ? lead : l)) : prev.filter((l) => l.id !== lead.id)
    );
    setPendingMove(null);
  };
  const handleRemove = (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setDueLeads((prev) => prev.filter((l) => l.id !== id));
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

  // A rep with anything flagged sees only the gate — no filters, no rest
  // of the list — until every flagged lead has a status re-confirmed.
  if (!isAdmin && dueLeads.length > 0) {
    return (
      <div className="crm-root">
        <div className="card crm-gate">
          <div className="crm-gate-head">
            <ShieldAlert size={20} strokeWidth={1.75} />
            <div>
              <h1 style={{ margin: 0, fontSize: 18 }}>Update Required</h1>
              <p className="label" style={{ margin: "4px 0 0" }}>
                It&apos;s time for your scheduled pipeline check. Confirm the status of every lead below — even if
                nothing&apos;s changed, re-picking its current status counts — to get back into the CRM.
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            {dueLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} {...cardProps} />
            ))}
          </div>
        </div>
      </div>
    );
  }

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

      {isAdmin && (
        <div className="crm-toolbar">
          <button type="button" className={`tab${section === "leads" ? " active" : ""}`} onClick={() => setSection("leads")}>
            Leads
          </button>
          <button type="button" className={`tab${section === "settings" ? " active" : ""}`} onClick={() => setSection("settings")}>
            Settings
          </button>
        </div>
      )}

      {section === "settings" && isAdmin ? (
        <CrmSettingsPanel schedule={schedule} />
      ) : (
        <div className="crm-section">
          {isAdmin && overdueReps.length > 0 && (
            <div className="card crm-overdue-notice">
              <ShieldAlert size={15} strokeWidth={1.75} />
              <span>
                Waiting on a pipeline update from{" "}
                {overdueReps.map((r, i) => (
                  <span key={r.repId}>
                    {i > 0 ? ", " : ""}
                    <strong>{r.repName}</strong> ({r.count})
                  </span>
                ))}
                .
              </span>
            </div>
          )}

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
      )}
    </div>
  );
}
