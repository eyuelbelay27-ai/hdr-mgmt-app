"use client";

import { toDateInputValue, businessToday } from "@/lib/crm/week";
import type { CrmLeadData } from "./listData";

/** The lead's facts, shared by the Admin's "New Lead" and "Edit" forms so
 * the two can never drift apart. */
export function LeadFormFields({
  reps,
  lead,
}: {
  reps: { id: string; name: string }[];
  lead?: CrmLeadData;
}) {
  const today = toDateInputValue(businessToday());

  return (
    <>
      <div className="form-row">
        <div className="form-field">
          <label className="label">Phone</label>
          <input className="input" name="phone" type="tel" inputMode="tel" defaultValue={lead?.phone ?? ""} required />
        </div>
        <div className="form-field">
          <label className="label">Location</label>
          <input className="input" name="location" defaultValue={lead?.location ?? ""} required />
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="label">Business Type</label>
          <input className="input" name="businessType" defaultValue={lead?.businessType ?? ""} required />
        </div>
        <div className="form-field">
          <label className="label">Source / Campaign</label>
          <input className="input" name="source" defaultValue={lead?.source ?? ""} placeholder="Optional" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="label">Date Received</label>
          <input
            className="input"
            name="receivedAt"
            type="date"
            defaultValue={lead ? toDateInputValue(lead.receivedAt) : today}
            required
          />
        </div>
        <div className="form-field">
          <label className="label">Assign To</label>
          <select className="input" name="assignedToId" defaultValue={lead?.assignedToId ?? ""} required>
            <option value="" disabled>
              Choose a sales rep…
            </option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {reps.length === 0 && (
        <p className="label" style={{ color: "var(--danger)" }}>
          No sales reps yet — grant a user the &ldquo;CRM: work assigned leads&rdquo; permission on the Users page first.
        </p>
      )}
    </>
  );
}
