"use client";

import { useState } from "react";
import { Plus, LayoutGrid, List } from "lucide-react";
import { LeadBoard } from "./LeadBoard";
import { LeadCard } from "./LeadCard";
import { AddLeadForm } from "./AddLeadForm";
import { LeadFilters } from "./LeadFilters";
import { ReportPanel } from "./ReportPanel";
import { CrmSettingsPanel } from "./CrmSettingsPanel";
import { loadMoreCrmLeadsAction } from "./actions";
import type { CrmLeadData, CrmLeadFilters, CrmReportData } from "./listData";

export type PendingMove = { leadId: string; status: "Closed" | "Failed" } | null;

/**
 * Owns the lead list as local state, seeded once from the server — the same
 * client-owns-the-list pattern as the Price Database, Overtime and Purchase
 * Order boards. Moving a card updates the screen instantly, and nothing
 * reshuffles under an in-progress edit.
 */
export function CrmWorkspace({
  currentUserId,
  isAdmin,
  isRep,
  reps,
  initialLeads,
  initialHasMore,
  reports,
  reportDay,
  dueWeek,
  pendingReps,
  selfOwes,
}: {
  currentUserId: string;
  isAdmin: boolean;
  isRep: boolean;
  reps: { id: string; name: string }[];
  initialLeads: CrmLeadData[];
  initialHasMore: boolean;
  reports: CrmReportData[];
  reportDay: number;
  dueWeek: { start: string; end: string } | null;
  pendingReps: { id: string; name: string }[];
  selfOwes: boolean;
}) {
  const [section, setSection] = useState<"leads" | "reports" | "settings">("leads");
  const [view, setView] = useState<"board" | "list">("board");
  const [leads, setLeads] = useState(initialLeads);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<CrmLeadFilters>({});
  const [filtering, setFiltering] = useState(false);
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
    const result = await loadMoreCrmLeadsAction(0, next);
    setLeads(result.leads);
    setHasMore(result.hasMore);
    setFiltering(false);
  };

  const cardProps = {
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
            ? "Register every incoming lead, assign it to a sales rep, and follow the week's results."
            : "Your assigned leads. Move each one to its outcome, then file the weekly report."}
        </p>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        <button type="button" className={`tab${section === "leads" ? " active" : ""}`} onClick={() => setSection("leads")}>
          Leads
        </button>
        <button type="button" className={`tab${section === "reports" ? " active" : ""}`} onClick={() => setSection("reports")}>
          Weekly Reports
          {pendingReps.length > 0 ? ` (${pendingReps.length})` : ""}
        </button>
        {isAdmin && (
          <button type="button" className={`tab${section === "settings" ? " active" : ""}`} onClick={() => setSection("settings")}>
            Settings
          </button>
        )}
      </div>

      {section === "leads" && (
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

          {isAdmin && <LeadFilters reps={reps} busy={filtering} onApply={handleApplyFilters} />}

          <div className="crm-toolbar">
            <span className="label" style={{ margin: 0 }}>
              {leads.length} lead{leads.length === 1 ? "" : "s"}
              {hasMore ? "+" : ""} shown
            </span>
            <div className="crm-view-toggle">
              <button
                type="button"
                className={`btn btn-sm${view === "board" ? " btn-primary" : ""}`}
                onClick={() => setView("board")}
              >
                <LayoutGrid size={14} strokeWidth={1.75} /> Board
              </button>
              <button
                type="button"
                className={`btn btn-sm${view === "list" ? " btn-primary" : ""}`}
                onClick={() => setView("list")}
              >
                <List size={14} strokeWidth={1.75} /> List
              </button>
            </div>
          </div>

          {view === "board" ? (
            <LeadBoard leads={leads} {...cardProps} />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} {...cardProps} />
              ))}
              {leads.length === 0 && <p className="label">No leads yet.</p>}
            </div>
          )}

          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button className="btn btn-sm" type="button" disabled={loadingMore} onClick={handleLoadMore}>
                {loadingMore ? "Loading…" : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}

      {section === "reports" && (
        <ReportPanel
          isAdmin={isAdmin}
          isRep={isRep}
          reports={reports}
          reportDay={reportDay}
          dueWeek={dueWeek}
          pendingReps={pendingReps}
          selfOwes={selfOwes}
        />
      )}

      {section === "settings" && isAdmin && <CrmSettingsPanel reportDay={reportDay} />}
    </div>
  );
}
