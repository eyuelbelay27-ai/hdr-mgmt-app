"use client";

import { useState } from "react";
import type { CrmLeadStatus } from "@prisma/client";
import { CRM_STATUSES, CRM_STATUS_TONE } from "@/lib/crm/status";
import { setCrmLeadStatusAction } from "./actions";
import { LeadCard, type LeadCardHandlers } from "./LeadCard";
import type { CrmLeadData } from "./listData";

/**
 * The kanban. On a computer a card is dragged between columns; on a phone,
 * where HTML5 drag-and-drop doesn't exist, every card carries the same
 * moves as buttons — so the board is fully usable by tapping and the drag
 * is pure convenience, never the only way through.
 */
export function LeadBoard({ leads, ...handlers }: { leads: CrmLeadData[] } & LeadCardHandlers) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<CrmLeadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDrop(status: CrmLeadStatus) {
    const leadId = dragging;
    setDragging(null);
    setDropTarget(null);
    if (!leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;
    if (!handlers.isAdmin && lead.assignedToId !== handlers.currentUserId) {
      setError("That lead isn't assigned to you.");
      return;
    }
    setError(null);

    // Closing needs a figure and failing needs a reason. Rather than drop
    // the card into a column and then interrogate the user, the card opens
    // its own small form and moves once that's filled in.
    if (status === "Closed" || status === "Failed") {
      handlers.onRequestMove(leadId, status);
      return;
    }

    const result = await setCrmLeadStatusAction(leadId, status);
    if (result.error) setError(result.error);
    else if (result.lead) handlers.onUpdate(result.lead);
  }

  return (
    <div className="crm-board-wrap">
      {error && <div className="login-error" style={{ marginBottom: 8 }}>{error}</div>}
      <div className="crm-board">
        {CRM_STATUSES.map((status) => {
          const columnLeads = leads.filter((l) => l.status === status);
          const tone = CRM_STATUS_TONE[status];
          // Unseen isn't a destination — a lead that's been picked up can't
          // go back to never having been picked up.
          const droppable = status !== "Unseen";
          return (
            <section
              key={status}
              className={`crm-column${dropTarget === status ? " crm-column-over" : ""}`}
              onDragOver={(e) => {
                if (!droppable || !dragging) return;
                e.preventDefault();
                setDropTarget(status);
              }}
              onDragLeave={() => setDropTarget((t) => (t === status ? null : t))}
              onDrop={(e) => {
                if (!droppable) return;
                e.preventDefault();
                void handleDrop(status);
              }}
            >
              <header className="crm-column-head">
                <span className="badge" style={{ background: tone.bg, color: tone.fg }}>
                  {status}
                </span>
                <span className="crm-column-count">{columnLeads.length}</span>
              </header>

              <div className="crm-column-body">
                {columnLeads.map((lead) => {
                  const mine = handlers.isAdmin || lead.assignedToId === handlers.currentUserId;
                  return (
                    <div
                      key={lead.id}
                      draggable={mine}
                      onDragStart={() => setDragging(lead.id)}
                      onDragEnd={() => {
                        setDragging(null);
                        setDropTarget(null);
                      }}
                      className={dragging === lead.id ? "crm-dragging" : undefined}
                    >
                      <LeadCard lead={lead} {...handlers} />
                    </div>
                  );
                })}
                {columnLeads.length === 0 && <p className="crm-column-empty">—</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
