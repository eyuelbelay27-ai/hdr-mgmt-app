"use client";

import { useState } from "react";
import { DollarSign, Wallet, Clock, CalendarDays, ChevronRight } from "lucide-react";
import { StatusBadge, DeadlineBadge } from "../StatusBadge";
import { loadMoreJobsAction } from "./listActions";
import type { JobListItem, JobListFilter } from "./listData";

/**
 * Owns the loaded job rows as local state, seeded once from the server —
 * same "client owns the list" pattern as Price Database/Overtime. Load
 * More appends the next page instead of the page ever re-fetching
 * everything at once (Section: pagination fix).
 */
export function JobsList({
  initialJobs,
  initialHasMore,
  canSeeFinancials,
  filter,
}: {
  initialJobs: JobListItem[];
  initialHasMore: boolean;
  canSeeFinancials: boolean;
  filter: JobListFilter;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const handleLoadMore = async () => {
    setLoading(true);
    const result = await loadMoreJobsAction(filter, jobs.length);
    setJobs((prev) => [...prev, ...result.jobs]);
    setHasMore(result.hasMore);
    setLoading(false);
  };

  return (
    <>
      <div className="jobs-desktop-table card dtable-wrap">
        <table className="dtable">
          <thead>
            <tr>
              {[
                "Job #",
                "Client",
                "Designer",
                "Status",
                ...(canSeeFinancials ? ["Final Price", "Advance", "Remaining"] : []),
                "Updated",
                "Record",
                "",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className="mono" data-label="Job #">
                  <a href={`/jobs/${j.id}`} style={{ color: "inherit" }}>{j.jobNumber}</a>
                </td>
                <td data-label="Client">
                  <a href={`/jobs/${j.id}`} style={{ display: "flex", gap: 8, alignItems: "center", color: "inherit" }}>
                    {j.clientName}
                    {j.deadline && <DeadlineBadge deadline={j.deadline} status={j.status} />}
                  </a>
                </td>
                <td data-label="Designer">{j.designer || "—"}</td>
                <td data-label="Status">
                  <StatusBadge status={j.status} />
                </td>
                {canSeeFinancials && (
                  <>
                    <td className="mono" data-label="Final Price">{j.finalPrice.toLocaleString()}</td>
                    <td className="mono" data-label="Advance">{j.advance.toLocaleString()}</td>
                    <td className="mono" data-label="Remaining">{j.remaining.toLocaleString()}</td>
                  </>
                )}
                <td data-label="Updated">{j.updatedAt.toISOString().slice(0, 10)}</td>
                <td data-label="Record">
                  {j.status !== "Draft" && (
                    <a className="btn btn-sm" href={`/jobs/${j.id}/print`}>Print</a>
                  )}
                </td>
                <td>
                  <a href={`/jobs/${j.id}`} style={{ color: "inherit" }}>Open ›</a>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td className="label" colSpan={canSeeFinancials ? 9 : 6}>
                  No jobs match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="jobs-mobile-cards">
        {jobs.map((j) => (
          <div key={j.id} className="card job-card">
            <div className="job-card-top">
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Job #</div>
                <div className="job-card-id">{j.jobNumber}</div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Client</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{j.clientName}</div>
              </div>
              <div className="job-card-badges">
                {j.deadline && <DeadlineBadge deadline={j.deadline} status={j.status} />}
              </div>
            </div>

            <div className="job-card-secondary">
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Designer</div>
                <div style={{ fontSize: 13.5 }}>{j.designer || "—"}</div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 2 }}>Status</div>
                <StatusBadge status={j.status} />
              </div>
            </div>

            {canSeeFinancials && (
              <div className="job-card-financials">
                <div className="job-card-fin-item">
                  <span className="job-card-fin-icon"><DollarSign size={13} strokeWidth={2} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="label" style={{ marginBottom: 0 }}>Final Price</div>
                    <div className="mono" style={{ fontSize: 13.5 }}>{j.finalPrice.toLocaleString()}</div>
                  </div>
                </div>
                <div className="job-card-fin-item">
                  <span className="job-card-fin-icon"><Wallet size={13} strokeWidth={2} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="label" style={{ marginBottom: 0 }}>Advance</div>
                    <div className="mono" style={{ fontSize: 13.5 }}>{j.advance.toLocaleString()}</div>
                  </div>
                </div>
                <div className="job-card-fin-item">
                  <span className="job-card-fin-icon"><Clock size={13} strokeWidth={2} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="label" style={{ marginBottom: 0 }}>Remaining</div>
                    <div className="mono" style={{ fontSize: 13.5 }}>{j.remaining.toLocaleString()}</div>
                  </div>
                </div>
                <div className="job-card-fin-item">
                  <span className="job-card-fin-icon"><CalendarDays size={13} strokeWidth={2} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="label" style={{ marginBottom: 0 }}>Updated</div>
                    <div style={{ fontSize: 13.5 }}>{j.updatedAt.toISOString().slice(0, 10)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="job-card-footer">
              <a className="job-card-open-link" href={`/jobs/${j.id}`}>
                Open details <ChevronRight size={14} strokeWidth={2} />
              </a>
              {j.status !== "Draft" && (
                <a className="btn btn-sm" href={`/jobs/${j.id}/print`}>Print</a>
              )}
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="card" style={{ padding: 20 }}>
            <p className="label" style={{ marginBottom: 0 }}>No jobs match.</p>
          </div>
        )}
      </div>

      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
          <button className="btn btn-sm" type="button" disabled={loading} onClick={handleLoadMore}>
            {loading ? "Loading…" : "Load More"}
          </button>
        </div>
      )}
    </>
  );
}
