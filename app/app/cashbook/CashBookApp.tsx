"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, ChevronLeft, ChevronRight, FileDown, FileText, Minus, Plus, Search, Settings, Trash2 } from "lucide-react";
import { addisToday } from "@/lib/ethiopian";
import {
  byDateAsc, ecShort, ethStr, gcShort, gregStr, monthName, monthOf, monthRange, money, periodData, runningBalances, shiftMonth, spanLabels, switchCal,
  type Cal, type CbEntry, type CbSettings, type Month,
} from "@/lib/cashbook";
import { EthDate, Sheet } from "../pnl/PnlApp";
import { deleteCbEntryAction, saveCbEntryAction, saveCbSettingsAction } from "./actions";
import { downloadCashBookCsv, downloadCashBookPdf } from "./pdf";

type Tab = "book" | "report" | "settings";
type RepKind = "month" | "last" | "custom";
type SheetState = { id: string | null; type: "in" | "out" } | null;
const CAL_KEY = "hadar-cashbook-cal";
const bal = (v: number) => (v < 0 ? "−" : "") + money(v);

export function CashBookApp({ initialEntries, initialSettings }: { initialEntries: CbEntry[]; initialSettings: CbSettings }) {
  const today = addisToday();
  const [entries, setEntries] = useState(initialEntries);
  const [settings, setSettings] = useState(initialSettings);
  const [tab, setTab] = useState<Tab>("book");
  const [cal, setCalState] = useState<Cal>("ec");
  const [month, setMonth] = useState<Month>(monthOf("ec", today));
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [q, setQ] = useState("");
  const [rep, setRep] = useState<{ kind: RepKind; from: string; to: string }>({ kind: "month", from: "", to: "" });
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  // the calendar choice is remembered on this device
  useEffect(() => {
    try {
      const c = localStorage.getItem(CAL_KEY);
      if (c === "gc") { setCalState("gc"); setMonth((m) => switchCal(m, "gc")); }
    } catch { /* storage blocked */ }
  }, []);
  const setCal = (c: Cal) => {
    setCalState(c);
    setMonth((m) => switchCal(m, c));
    try { localStorage.setItem(CAL_KEY, c); } catch { /* storage blocked */ }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const balances = useMemo(() => runningBalances(entries, settings.opening), [entries, settings.opening]);

  async function updateSettings(patch: Partial<CbSettings>, msg?: string) {
    const prev = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      const res = await saveCbSettingsAction(next);
      if (res.error !== undefined) { setSettings(prev); setToast(res.error); return; }
      setSettings(res.settings);
      if (msg) setToast(msg);
    } catch {
      setSettings(prev);
      setToast("Couldn't save. Check your connection and try again.");
    }
  }

  const dayHead = (d: string) => (cal === "ec" ? { a: ethStr(d), b: gregStr(d) } : { a: gregStr(d), b: ethStr(d) });

  // ---------------- Cash Book ----------------
  function BookView() {
    const [from, to] = monthRange(month);
    const inMonth = entries.filter((e) => e.date >= from && e.date <= to);
    let tin = 0, tout = 0;
    for (const e of inMonth) if (e.type === "in") tin += e.amount; else tout += e.amount;
    const s = q.trim().toLowerCase();
    const list = inMonth
      .filter((e) => filter === "all" || e.type === filter)
      .filter((e) => !s || [e.description, e.bank, e.category, e.ref, e.createdBy].join(" ").toLowerCase().includes(s))
      .sort(byDateAsc)
      .reverse();
    const days: { date: string; items: CbEntry[] }[] = [];
    for (const e of list) {
      const last = days[days.length - 1];
      if (last && last.date === e.date) last.items.push(e); else days.push({ date: e.date, items: [e] });
    }
    const lbl = spanLabels(cal, from, to);
    return (
      <>
        <section className="cb-hero">
          <small>Cash on hand</small>
          <div className="cb-bal">{bal(balances.total)}<span>ETB</span></div>
          <div className="cb-month">
            <button type="button" className="pnl-iconbtn light" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}><ChevronLeft size={18} /></button>
            <div><b>{monthName(month)}</b><span>{lbl.s}</span></div>
            <button type="button" className="pnl-iconbtn light" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}><ChevronRight size={18} /></button>
          </div>
          <div className="cb-split">
            <div><small>Cash in</small><b>{money(tin)}</b></div>
            <div><small>Cash out</small><b>{money(tout)}</b></div>
          </div>
        </section>
        <div className="cb-actions">
          <button type="button" className="cb-big in" onClick={() => setSheet({ id: null, type: "in" })}><Plus size={20} /> Cash In</button>
          <button type="button" className="cb-big out" onClick={() => setSheet({ id: null, type: "out" })}><Minus size={20} /> Cash Out</button>
        </div>
        <div className="cb-filters">
          <div className="pnl-seg cb-mini" role="group" aria-label="Show">
            {(["all", "in", "out"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "in" ? "In" : "Out"}</button>
            ))}
          </div>
          <label className="cb-search">
            <Search size={16} />
            <input className="input" type="search" placeholder="Search entries" aria-label="Search entries" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {!days.length ? (
          <div className="pnl-empty">
            {entries.length === 0 ? (
              <>
                <BookOpen size={40} />
                <h2>Your cash book is empty</h2>
                <p>Tap <b>Cash In</b> when you withdraw from a bank, and <b>Cash Out</b> when you spend. Set your banks and opening balance in Settings.</p>
              </>
            ) : (
              <>
                <h2>No entries for this month</h2>
                <p>{s || filter !== "all" ? "Try clearing the search or filter." : "Use the arrows above to view another month."}</p>
              </>
            )}
          </div>
        ) : (
          days.map((d) => {
            const h = dayHead(d.date);
            return (
              <div key={d.date}>
                <div className="pnl-day"><b>{h.a}</b><span>{h.b}</span></div>
                <div className="card pnl-list">
                  {d.items.map((e) => {
                    const sub = [e.bank ? (e.type === "in" ? `From ${e.bank}` : e.bank) : "", e.category, e.ref ? `#${e.ref}` : "", `by ${e.createdBy}`].filter(Boolean).join(" · ");
                    return (
                      <button key={e.id} type="button" className="pnl-row" onClick={() => setSheet({ id: e.id, type: e.type })}>
                        <span className={`pnl-dot${e.type === "in" ? " in" : ""}`}>{e.type === "in" ? <ArrowDown size={16} /> : <ArrowUp size={16} />}</span>
                        <span className="pnl-mid"><b>{e.description}</b><span>{sub}</span></span>
                        <span className={`pnl-amt${e.type === "in" ? " in" : ""}`}>
                          {e.type === "in" ? "+" : "−"}{money(e.amount)}
                          <small>Bal {bal(balances.map.get(e.id) ?? 0)}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </>
    );
  }

  // ---------------- PDF Report ----------------
  function repRange(): [string, string] {
    const cur = monthOf(cal, today);
    if (rep.kind === "last") return monthRange(shiftMonth(cur, -1));
    if (rep.kind === "custom") {
      const [a, b] = monthRange(cur);
      let f = rep.from || a, t = rep.to || b;
      if (f > t) [f, t] = [t, f];
      return [f, t];
    }
    return monthRange(cur);
  }
  function ReportView() {
    const [from, to] = repRange();
    const p = periodData(entries, settings.opening, from, to);
    const lbl = spanLabels(cal, from, to);
    const show = p.rows.slice(0, 14);
    return (
      <>
        <div className="card cb-panel">
          <div className="pnl-seg" role="group" aria-label="Period">
            {([["month", "This month"], ["last", "Last month"], ["custom", "Custom"]] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={rep.kind === k} onClick={() => setRep((r) => ({ ...r, kind: k, from: k === "custom" && !r.from ? from : r.from, to: k === "custom" && !r.to ? to : r.to }))}>{l}</button>
            ))}
          </div>
          {rep.kind === "custom" && (
            <div className="cb-two">
              <label className="pnl-f"><span>From</span><input className="input" type="date" value={rep.from || from} onChange={(e) => e.target.value && setRep((r) => ({ ...r, from: e.target.value }))} /><em>{ethStr(rep.from || from)}</em></label>
              <label className="pnl-f"><span>To</span><input className="input" type="date" value={rep.to || to} onChange={(e) => e.target.value && setRep((r) => ({ ...r, to: e.target.value }))} /><em>{ethStr(rep.to || to)}</em></label>
            </div>
          )}
          <div className="cb-period"><b>{lbl.t}</b><span>{lbl.s}</span></div>
          <div className="cb-repsum">
            <div><small>Opening</small><b>{bal(p.open)}</b></div>
            <div><small>Closing</small><b>{bal(p.close)}</b></div>
            <div><small>Cash in</small><b className="in">{money(p.tin)}</b></div>
            <div><small>Cash out</small><b className="out">{money(p.tout)}</b></div>
          </div>
          <button
            type="button"
            className="btn btn-primary pnl-block"
            disabled={pdfBusy}
            onClick={async () => {
              setPdfBusy(true);
              try { await downloadCashBookPdf(p, from, to, settings); setToast("PDF downloaded"); } catch { setToast("Could not create the PDF. Try again."); }
              setPdfBusy(false);
            }}
          >
            <FileDown size={16} /> {pdfBusy ? "Preparing…" : "Download PDF"}
          </button>
          <p className="cb-note">{gcShort(from)} – {gcShort(to)} · {ecShort(from)} – {ecShort(to)} EC · {p.rows.length} entr{p.rows.length === 1 ? "y" : "ies"}</p>
        </div>

        <div className="cb-paperwrap">
          <div className="cb-paper" aria-label="PDF preview, first page">
            <div className="ph">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/hadar-mark.png" alt="" />
              <div className="co"><b>{settings.company}</b><span>{settings.address}</span></div>
              <div className="tt"><b>CASH BOOK</b><span>{gcShort(from)} – {gcShort(to)}</span><span>{ecShort(from)} – {ecShort(to)} EC</span></div>
            </div>
            <div className="rule" />
            <div className="sum">
              <div><span>Opening</span><b>{bal(p.open)}</b></div><div><span>Cash in</span><b>{money(p.tin)}</b></div>
              <div><span>Cash out</span><b>{money(p.tout)}</b></div><div><span>Closing</span><b>{bal(p.close)}</b></div>
            </div>
            <table>
              <thead><tr><th>Date (GC / EC)</th><th>Ref</th><th>Description</th><th>Bank / Category</th><th className="r">In</th><th className="r">Out</th><th className="r">Balance</th></tr></thead>
              <tbody>
                <tr><td>{gcShort(from)}<small>{ecShort(from)}</small></td><td /><td><b>Opening balance</b></td><td /><td /><td /><td className="r">{bal(p.open)}</td></tr>
                {show.map((e, i) => (
                  <tr key={e.id} className={i % 2 ? "alt" : ""}>
                    <td>{gcShort(e.date)}<small>{ecShort(e.date)}</small></td><td>{e.ref}</td><td>{e.description}</td><td>{[e.bank, e.category].filter(Boolean).join(" · ")}</td>
                    <td className="r">{e.type === "in" ? money(e.amount) : ""}</td><td className="r">{e.type === "out" ? money(e.amount) : ""}</td><td className="r">{bal(e.bal)}</td>
                  </tr>
                ))}
                {p.rows.length > show.length && <tr><td colSpan={7} className="more">+ {p.rows.length - show.length} more rows in the PDF</td></tr>}
                <tr className="tot"><td colSpan={4}>Totals</td><td className="r">{money(p.tin)}</td><td className="r">{money(p.tout)}</td><td className="r">{bal(p.close)}</td></tr>
              </tbody>
            </table>
            <div className="sig"><div>Prepared by{settings.preparedBy ? `: ${settings.preparedBy}` : ""}</div><div>Checked by</div><div>Approved by</div></div>
          </div>
        </div>
      </>
    );
  }

  // ---------------- Settings ----------------
  function ListEditor({ k, label }: { k: "banks" | "categories"; label: string }) {
    const items = settings[k];
    return (
      <>
        <div className="cb-listed">
          {items.length ? items.map((b) => (
            <div key={b}>
              <span>{b}</span>
              <button type="button" aria-label={`Remove ${b}`} onClick={() => updateSettings({ [k]: items.filter((x) => x !== b) }, "Removed")}><Trash2 size={16} /></button>
            </div>
          )) : <div><span className="label" style={{ margin: 0 }}>None yet</span></div>}
        </div>
        <form
          className="cb-addrow"
          onSubmit={(ev) => {
            ev.preventDefault();
            const inp = ev.currentTarget.elements.namedItem("v") as HTMLInputElement;
            const v = inp.value.trim();
            if (!v) return;
            inp.value = "";
            if (!items.some((x) => x.toLowerCase() === v.toLowerCase())) updateSettings({ [k]: [...items, v] }, "Added");
          }}
        >
          <input className="input" name="v" placeholder={`Add ${label}`} aria-label={`Add ${label}`} maxLength={100} />
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
      </>
    );
  }
  function SettingsView() {
    const txt = (k: "company" | "address" | "preparedBy", label: string) => (
      <label className="pnl-f">
        <span>{label}</span>
        <input className="input" defaultValue={settings[k]} maxLength={k === "address" ? 200 : 120} onBlur={(e) => e.target.value.trim() !== settings[k] && updateSettings({ [k]: e.target.value }, "Saved")} />
      </label>
    );
    return (
      <>
        <p className="label" style={{ margin: "4px 2px 0" }}>Changes save automatically.</p>
        <div className="card cb-panel">
          <h3>Banks</h3><p className="cb-s">Banks you withdraw cash from. You pick one on every entry.</p>
          {ListEditor({ k: "banks", label: "a bank" })}
        </div>
        <div className="card cb-panel">
          <h3>Opening balance</h3><p className="cb-s">Cash on hand before your first entry.</p>
          <div className="cb-two">
            <label className="pnl-f">
              <span>Amount (ETB)</span>
              <input
                className="input"
                inputMode="decimal"
                placeholder="0.00"
                defaultValue={settings.opening ? money(settings.opening) : ""}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value.replace(/,/g, "")) || 0;
                  if (v !== settings.opening) updateSettings({ opening: v }, "Opening balance saved");
                }}
              />
            </label>
            <label className="pnl-f">
              <span>As of</span>
              <input className="input" type="date" defaultValue={settings.openingDate ?? ""} onChange={(e) => updateSettings({ openingDate: e.target.value || null }, "Saved")} />
              {settings.openingDate && <em>{ethStr(settings.openingDate)}</em>}
            </label>
          </div>
        </div>
        <div className="card cb-panel">
          <h3>Categories</h3><p className="cb-s">Optional labels for what cash was spent on.</p>
          {ListEditor({ k: "categories", label: "a category" })}
        </div>
        <div className="card cb-panel">
          <h3>PDF details</h3>
          {txt("company", "Company name")}
          {txt("address", "Address line")}
          {txt("preparedBy", "Prepared by")}
        </div>
        <div className="card cb-panel">
          <h3>Backup</h3><p className="cb-s">Entries are saved in the app&apos;s database. You can also download them all as a spreadsheet.</p>
          <button type="button" className="btn pnl-block" style={{ marginTop: 0 }} onClick={() => { downloadCashBookCsv([...entries].sort(byDateAsc)); setToast("Backup downloaded"); }}>
            <FileDown size={16} /> Download all entries (CSV)
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="pnl">
      <div className="pnl-head">
        <div>
          <h1 style={{ margin: 0 }}>Cash Book</h1>
          <p className="label" style={{ margin: "4px 0 0" }}>Hadar Trading PLC · ETB</p>
        </div>
        <div className="pnl-seg cb-cal" role="group" aria-label="Calendar">
          <button type="button" aria-pressed={cal === "ec"} onClick={() => setCal("ec")}>Ethiopian</button>
          <button type="button" aria-pressed={cal === "gc"} onClick={() => setCal("gc")}>Gregorian</button>
        </div>
      </div>

      <div className="pnl-tabs">
        {([["book", "Cash Book", BookOpen], ["report", "PDF Report", FileText], ["settings", "Settings", Settings]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" className={`tab${tab === k ? " active" : ""}`} onClick={() => { setTab(k); window.scrollTo({ top: 0 }); }}>
            <Icon size={15} /> {l}
          </button>
        ))}
      </div>

      <div className="pnl-body">{tab === "book" ? BookView() : tab === "report" ? ReportView() : SettingsView()}</div>

      {sheet && (
        <EntrySheet
          key={sheet.id ?? `new-${sheet.type}`}
          entry={sheet.id ? entries.find((e) => e.id === sheet.id) : undefined}
          type={sheet.type}
          settings={settings}
          cal={cal}
          today={today}
          onClose={() => setSheet(null)}
          onSaved={(e, wasNew) => {
            setEntries((prev) => (prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [...prev, e]));
            setSheet(null);
            setMonth(monthOf(cal, e.date));
            setToast(!wasNew ? "Entry updated" : e.type === "in" ? "Cash in recorded" : "Cash out recorded");
          }}
          onDeleted={(id) => { setEntries((prev) => prev.filter((x) => x.id !== id)); setSheet(null); setToast("Entry deleted"); }}
          onGoSettings={() => { setSheet(null); setTab("settings"); }}
        />
      )}
      {toast && <div className="pnl-toast" role="status">{toast}</div>}
    </div>
  );
}

function EntrySheet({
  entry, type: type0, settings, cal, today, onClose, onSaved, onDeleted, onGoSettings,
}: {
  entry?: CbEntry;
  type: "in" | "out";
  settings: CbSettings;
  cal: Cal;
  today: string;
  onClose: () => void;
  onSaved: (e: CbEntry, wasNew: boolean) => void;
  onDeleted: (id: string) => void;
  onGoSettings: () => void;
}) {
  const [type, setType] = useState<"in" | "out">(entry?.type ?? type0);
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [date, setDate] = useState(entry?.date ?? today);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [bank, setBank] = useState(entry?.bank ?? "");
  const [category, setCategory] = useState(entry?.category ?? "");
  const [ref, setRef] = useState(entry?.ref ?? "");
  const [more, setMore] = useState(!!(entry?.category || entry?.ref));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const banks = entry?.bank && !settings.banks.includes(entry.bank) ? [...settings.banks, entry.bank] : settings.banks;
  const cats = entry?.category && !settings.categories.includes(entry.category) ? [...settings.categories, entry.category] : settings.categories;

  async function save() {
    setErr(null);
    const v = Math.round(parseFloat(amount.replace(/,/g, "")) * 100) / 100;
    if (!(v > 0)) return setErr("Enter an amount above zero.");
    if (!date) return setErr("Pick a date.");
    if (!description.trim()) return setErr("Enter a description before saving.");
    if (!bank) return setErr(banks.length ? "Choose the bank it was withdrawn from." : "Add a bank in Settings, then record this entry.");
    setBusy(true);
    try {
      const res = await saveCbEntryAction(entry?.id ?? null, { type, amount: v, date, description, bank, category, ref });
      if (res.error !== undefined) setErr(res.error); else onSaved(res.entry, !entry);
    } catch { setErr("Couldn't save. Check your connection and try again."); }
    setBusy(false);
  }

  return (
    <Sheet title={entry ? "Edit entry" : "New entry"} onClose={onClose}>
      <div className="pnl-seg big cb-type" role="group">
        <button type="button" className="in" aria-pressed={type === "in"} onClick={() => setType("in")}><Plus size={16} /> Cash In</button>
        <button type="button" aria-pressed={type === "out"} onClick={() => setType("out")}><Minus size={16} /> Cash Out</button>
      </div>
      <label className="pnl-f">
        <span>Amount (ETB)</span>
        <input className="input pnl-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!entry} />
      </label>
      {cal === "ec" ? (
        <EthDate value={date} onChange={setDate} />
      ) : (
        <label className="pnl-f">
          <span>Date</span>
          <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <em>Ethiopian: {ethStr(date)}</em>
        </label>
      )}
      <label className="pnl-f">
        <span>Description</span>
        <input className="input" maxLength={300} placeholder={type === "in" ? "e.g. Petty cash withdrawal" : "e.g. Acrylic sheets for Zemen Bank sign"} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="pnl-f">
        <span>{type === "in" ? "Withdrawn from" : "Bank"}</span>
        {banks.length ? (
          <div className="cb-chips">
            {banks.map((b) => <button key={b} type="button" className="cb-chip" aria-pressed={bank === b} onClick={() => setBank(b)}>{b}</button>)}
          </div>
        ) : (
          <em>No banks yet. <button type="button" className="cb-link" onClick={onGoSettings}>Add your banks in Settings</button>.</em>
        )}
      </div>
      {more ? (
        <div className="cb-two">
          <label className="pnl-f">
            <span>Category</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">None</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="pnl-f">
            <span>Ref / receipt no.</span>
            <input className="input" maxLength={100} value={ref} onChange={(e) => setRef(e.target.value)} />
          </label>
        </div>
      ) : (
        <button type="button" className="cb-link cb-more" onClick={() => setMore(true)}>+ Category &amp; receipt no.</button>
      )}
      {entry && <p className="label" style={{ margin: "0 0 12px" }}>Recorded by {entry.createdBy}</p>}
      {err && <p className="login-error">{err}</p>}
      <div className="pnl-sactions">
        {entry && (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={async () => {
              if (!armed) return setArmed(true);
              setBusy(true);
              try {
                const res = await deleteCbEntryAction(entry.id);
                if (res.error !== undefined) setErr(res.error); else onDeleted(entry.id);
              } catch { setErr("Couldn't delete. Check your connection and try again."); }
              setBusy(false);
            }}
          >
            {armed ? "Tap again to delete" : "Delete"}
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : entry ? "Save changes" : type === "in" ? "Record cash in" : "Record cash out"}
        </button>
      </div>
    </Sheet>
  );
}
