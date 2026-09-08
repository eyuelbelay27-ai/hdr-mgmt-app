"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";

/**
 * Typed employee-name chips, not a picker off the Users table (Section:
 * user request) — who's going out for overtime isn't the same set of
 * people as who has a login. Each chip becomes a hidden `employeeNames`
 * input, so the server just reads `formData.getAll("employeeNames")`.
 */
export function EmployeeNamesField({ initialNames = [] }: { initialNames?: string[] }) {
  const [names, setNames] = useState<string[]>(initialNames);
  const [draft, setDraft] = useState("");

  const addName = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setNames((prev) => [...prev, trimmed]);
    setDraft("");
  };

  return (
    <div>
      <label className="label">Employees Going Out ({names.length})</label>
      <div style={{ display: "flex", gap: 8, marginBottom: names.length > 0 ? 8 : 0 }}>
        <input
          className="input"
          value={draft}
          placeholder="Type a name, then Add"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addName();
            }
          }}
        />
        <button type="button" className="btn btn-sm" onClick={addName}>
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>
      {names.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {names.map((name, i) => (
            <span key={`${name}-${i}`} className="badge" style={{ background: "var(--surface-3)", color: "var(--text)", gap: 6 }}>
              {name}
              <input type="hidden" name="employeeNames" value={name} />
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => setNames((prev) => prev.filter((_, idx) => idx !== i))}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", color: "inherit" }}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
