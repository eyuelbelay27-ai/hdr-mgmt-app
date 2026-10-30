"use client";

import { useMemo, useState } from "react";
import { ETH_MONTHS, addisToday, ethLong, ethMonthLength, fromEth, toEth } from "@/lib/ethiopian";

/**
 * A date picked in the Ethiopian calendar (day / month / year), submitted as
 * a Gregorian "YYYY-MM-DD" in a hidden input named `name`.
 */
export function EthDateField({ id, name, label, defaultValue, required }: { id: string; name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  const start = defaultValue ? toEth(defaultValue) : null;
  const thisYear = toEth(addisToday()).y;
  const [d, setD] = useState(start ? String(start.d) : "");
  const [m, setM] = useState(start ? String(start.m) : "");
  const [y, setY] = useState(String(start ? start.y : thisYear));

  const years = useMemo(() => Array.from(new Set([start?.y ?? thisYear, thisYear, thisYear + 1])).sort(), [start?.y, thisYear]);
  const iso = d && m && y ? fromEth(+y, +m, Math.min(+d, ethMonthLength(+y, +m))) : "";

  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr) 92px", gap: 6 }}>
        <select className="input" id={id} value={d} onChange={(e) => setD(e.target.value)} required={required} aria-label="Day">
          <option value="">Day</option>
          {Array.from({ length: 30 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        <select className="input" value={m} onChange={(e) => setM(e.target.value)} required={required} aria-label="Month">
          <option value="">Month</option>
          {ETH_MONTHS.map((n, i) => (
            <option key={n} value={i + 1}>{n}</option>
          ))}
        </select>
        <select className="input" value={y} onChange={(e) => setY(e.target.value)} required={required} aria-label="Year">
          {years.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
      <input type="hidden" name={name} value={iso} />
      {iso && <div className="label" style={{ marginTop: 4 }}>{ethLong(iso)}</div>}
    </div>
  );
}
