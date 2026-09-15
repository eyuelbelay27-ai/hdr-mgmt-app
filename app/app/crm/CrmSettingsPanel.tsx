"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_NAMES } from "@/lib/crm/week";
import { setCrmReportDayAction } from "./actions";

/** One company-wide report day, Admin-only. */
export function CrmSettingsPanel({ reportDay }: { reportDay: number }) {
  const router = useRouter();
  const [day, setDay] = useState(reportDay);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(next: number) {
    setDay(next);
    setBusy(true);
    setSaved(false);
    await setCrmReportDayAction(next);
    setBusy(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 10, maxWidth: 420 }}>
      <h3 style={{ margin: 0 }}>Report Day</h3>
      <p className="label" style={{ margin: 0 }}>
        The day each reporting week closes. A week is the seven days ending on it, and every rep reports on the same
        schedule.
      </p>
      <select className="input" value={day} disabled={busy} onChange={(e) => void save(Number(e.target.value))}>
        {WEEKDAY_NAMES.map((name, i) => (
          <option key={name} value={i}>
            {name}
          </option>
        ))}
      </select>
      {busy && <span className="label" style={{ margin: 0 }}>Saving…</span>}
      {saved && !busy && <span className="label" style={{ margin: 0, color: "var(--success)" }}>Saved.</span>}
    </div>
  );
}
