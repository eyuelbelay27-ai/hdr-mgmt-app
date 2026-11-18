"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { ETH_MONTHS, addisToday, ethMonthLength, fromEth, toEth } from "@/lib/ethiopian";
import { gregStr } from "@/lib/cashbook";

/** Bottom sheet (phone) / centred dialog (PC). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.documentElement.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.documentElement.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="cb-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="cb-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="cb-shead"><h2>{title}</h2><button type="button" className="cb-iconbtn light" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <div className="cb-sbody">{children}</div>
      </section>
    </div>
  );
}

/** Day / month / year pickers in the Ethiopian calendar, Gregorian shown below. */
export function EthDate({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const e = toEth(value);
  const ty = toEth(addisToday()).y;
  const years: number[] = [];
  for (let y = ty - 4; y <= ty + 1; y++) years.push(y);
  const set = (y: number, m: number, d: number) => onChange(fromEth(y, m, Math.min(d, ethMonthLength(y, m))));
  return (
    <label className="cb-f">
      <span>Date</span>
      <div className="cb-date3">
        <select className="input" aria-label="Day" value={e.d} onChange={(x) => set(e.y, e.m, +x.target.value)}>
          {Array.from({ length: ethMonthLength(e.y, e.m) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <select className="input" aria-label="Month" value={e.m} onChange={(x) => set(e.y, +x.target.value, e.d)}>
          {ETH_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </select>
        <select className="input" aria-label="Year" value={e.y} onChange={(x) => set(+x.target.value, e.m, e.d)}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <em>Gregorian: {gregStr(value)}</em>
    </label>
  );
}
