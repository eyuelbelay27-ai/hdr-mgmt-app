interface Entry {
  id: string;
  ts: Date;
  text: string;
}

/** Append-only audit log — read-only (Section 8.3). */
export function ActivityTab({ activity }: { activity: Entry[] }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {activity.map((a) => (
        <div key={a.id} className="card" style={{ padding: 10, display: "flex", gap: 12 }}>
          <div className="mono label" style={{ whiteSpace: "nowrap" }}>
            {a.ts.toISOString().replace("T", " ").slice(0, 16)}
          </div>
          <div>{a.text}</div>
        </div>
      ))}
      {activity.length === 0 && <p className="label">No activity yet.</p>}
    </div>
  );
}
