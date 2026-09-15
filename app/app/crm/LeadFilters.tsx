"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import type { CrmLeadFilters } from "./listData";

/** Admin-only. A rep is pinned to their own leads server-side, so there's
 * nothing here for them to narrow. */
export function LeadFilters({
  reps,
  busy,
  onApply,
}: {
  reps: { id: string; name: string }[];
  busy: boolean;
  onApply: (filters: CrmLeadFilters) => void;
}) {
  const [repId, setRepId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const apply = (next: CrmLeadFilters) => onApply(next);

  return (
    <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
      <div className="form-row">
        <div className="form-field">
          <label className="label">Sales Rep</label>
          <select className="input" value={repId} onChange={(e) => setRepId(e.target.value)}>
            <option value="">All reps</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="label">Received From</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="label">Received To</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={busy}
          onClick={() => apply({ repId: repId || null, from: from || null, to: to || null })}
        >
          <Filter size={13} strokeWidth={1.75} /> {busy ? "Filtering…" : "Apply"}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={busy}
          onClick={() => {
            setRepId("");
            setFrom("");
            setTo("");
            apply({});
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
