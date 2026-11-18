"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, FileDown, List, Pencil, Plus, TrendingUp, X } from "lucide-react";
import { Lightbox } from "../Lightbox";
import { prepareReceipt } from "../payroll/prepareReceipt";
import { ETH_MONTHS, addisToday, ethMonthLength, fromEth, toEth } from "@/lib/ethiopian";
import {
  TYPES,
  balance,
  budgetYearOf,
  effect,
  ethStr,
  gregStr,
  isTransfer,
  money,
  periodLabel,
  plData,
  range,
  sgn,
  shift,
  typeName,
  type Account,
  type AccountType,
  type Entry,
  type Period,
} from "@/lib/pnl";
import { deleteAccountAction, deleteEntryAction, saveAccountAction, saveEntryAction, uploadPnlReceiptAction } from "./actions";
import { downloadPlPdf } from "./pdf";

type Tab = "entries" | "accounts" | "reports";
type Draft = Partial<Omit<Entry, "id" | "createdAt">>;
type SheetState =
  | { kind: "entry"; id: string | null; draft?: Draft }
  | { kind: "account"; id: string | null; presetType?: AccountType; then?: (newId: string) => void; back?: () => void }
  | null;

const byDateDesc = (x: Entry, y: Entry) => (x.date < y.date ? 1 : x.date > y.date ? -1 : y.createdAt - x.createdAt);

export function PnlApp({ initialAccounts, initialEntries }: { initialAccounts: Account[]; initialEntries: Entry[] }) {
  const today = addisToday();
  const T = toEth(today);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [entries, setEntries] = useState(initialEntries);
  const [tab, setTab] = useState<Tab>("entries");
  const [P, setP] = useState<Period>({ mode: "month", y: T.y, m: T.m });
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const accName = (id: string) => byId.get(id)?.name ?? "(deleted)";

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const upsertAccount = (a: Account) => setAccounts((prev) => (prev.some((x) => x.id === a.id) ? prev.map((x) => (x.id === a.id ? a : x)) : [...prev, a]));
  const upsertEntry = (e: Entry) => setEntries((prev) => (prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [...prev, e]));

  const switchTab = (t: Tab) => {
    setTab(t);
    setLedgerId(null);
    if (t !== "reports" && P.mode === "year") setP({ mode: "month", y: T.y, m: T.m });
    window.scrollTo({ top: 0 });
  };

  const stepper = (
    <div className="pnl-stepper">
      <button type="button" className="pnl-iconbtn" aria-label="Previous" onClick={() => setP((p) => shift(p, -1))}>
        <ChevronLeft size={18} />
      </button>
      <div className="pnl-stepper-lbl">
        <b>{periodLabel(P).t}</b>
        <span>{periodLabel(P).s}</span>
      </div>
      <button type="button" className="pnl-iconbtn" aria-label="Next" onClick={() => setP((p) => shift(p, 1))}>
        <ChevronRight size={18} />
      </button>
    </div>
  );

  // ---------------- Entries ----------------
  function EntriesView() {
    if (!accounts.length) return <StartEmpty />;
    const [a, b] = range(P);
    const list = entries.filter((e) => e.date >= a && e.date <= b).sort(byDateDesc);
    let tin = 0, tout = 0;
    for (const e of list) {
      if (isTransfer(e, byId)) continue;
      if (e.kind === "in") tin += e.amount; else tout += e.amount;
    }
    const days: { date: string; items: Entry[] }[] = [];
    for (const e of list) {
      const last = days[days.length - 1];
      if (last && last.date === e.date) last.items.push(e); else days.push({ date: e.date, items: [e] });
    }
    return (
      <>
        {stepper}
        <div className="pnl-sum">
          <div><small>Money in</small><b>{money(tin)}</b></div>
          <div><small>Money out</small><b>{money(tout)}</b></div>
          <div><small>Net</small><b>{sgn(tin - tout)}</b></div>
        </div>
        {!list.length ? (
          <div className="pnl-empty">
            <h2>No entries in {ETH_MONTHS[P.m - 1]}</h2>
            <p>Tap New entry to record money coming in or going out.</p>
          </div>
        ) : (
          days.map((d) => (
            <div key={d.date}>
              <div className="pnl-day"><b>{ethStr(d.date)}</b><span>{gregStr(d.date)}</span></div>
              <div className="card pnl-list">{d.items.map((e) => <EntryRow key={e.id} e={e} />)}</div>
            </div>
          ))
        )}
      </>
    );
  }
  function EntryRow({ e, runBal, forAcc }: { e: Entry; runBal?: number; forAcc?: Account }) {
    const tr = isTransfer(e, byId);
    const v = forAcc ? effect(forAcc, e) : e.kind === "in" ? e.amount : -e.amount;
    const pos = forAcc ? v > 0 : e.kind === "in" && !tr;
    const flow = e.kind === "in" ? `${accName(e.accountId)} → ${accName(e.cashId)}` : `${accName(e.cashId)} → ${accName(e.accountId)}`;
    return (
      <button type="button" className="pnl-row" onClick={() => setSheet({ kind: "entry", id: e.id })}>
        <span className={`pnl-dot${pos && !tr ? " in" : ""}`}>{tr ? <ArrowLeftRight size={16} /> : e.kind === "in" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
        <span className="pnl-mid">
          <b>
            {e.note || accName(e.accountId)}
            {tr && <span className="pnl-chip">Transfer</span>}
            {e.receipt && <span className="pnl-chip">Receipt</span>}
          </b>
          <span>{forAcc ? `${ethStr(e.date)} · ${gregStr(e.date)}` : flow}{e.ref ? ` · ${e.ref}` : ""}</span>
        </span>
        <span className={`pnl-amt${pos ? " in" : ""}`}>
          {v >= 0 ? "+" : "−"}{money(v)}
          {runBal !== undefined && <small>Bal {sgn(runBal)}</small>}
        </span>
      </button>
    );
  }
  function StartEmpty() {
    return (
      <div className="pnl-empty">
        <h2>Start with your accounts</h2>
        <p>Add a cash or bank account, then the accounts you sort money into, like Sales, Materials or Rent.</p>
        <button type="button" className="btn btn-primary" onClick={() => setSheet({ kind: "account", id: null, presetType: "asset" })}>Add first account</button>
      </div>
    );
  }

  // ---------------- Accounts + ledger ----------------
  function AccountsView() {
    if (!accounts.length) return <StartEmpty />;
    const led = ledgerId ? byId.get(ledgerId) : null;
    if (led) {
      const es = entries.filter((e) => e.cashId === led.id || e.accountId === led.id).sort((x, y) => -byDateDesc(x, y));
      let run = 0;
      const rows = es.map((e) => { run += effect(led, e); return { e, run: Math.round(run * 100) / 100 }; }).reverse();
      return (
        <>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setLedgerId(null)}><ChevronLeft size={14} /> All accounts</button>
          <div className="pnl-lhead">
            <div><small>{typeName(led.type)} · balance today</small><b>{sgn(balance(led, entries))}</b><span>{led.name}</span></div>
            <button type="button" className="pnl-iconbtn light" aria-label="Edit account" onClick={() => setSheet({ kind: "account", id: led.id })}><Pencil size={16} /></button>
          </div>
          {rows.length ? (
            <>
              <div className="card pnl-list">{rows.map(({ e, run }) => <EntryRow key={e.id} e={e} forAcc={led} runBal={run} />)}</div>
              <p className="label" style={{ textAlign: "center" }}>Newest first · balance shown after each entry</p>
            </>
          ) : (
            <div className="pnl-empty"><p style={{ margin: 0 }}>No entries on this account yet.</p></div>
          )}
        </>
      );
    }
    return (
      <>
        {TYPES.map((t) => {
          const as = accounts.filter((a) => a.type === t.k).sort((x, y) => x.name.localeCompare(y.name));
          if (!as.length) return null;
          const tot = as.reduce((s, a) => s + balance(a, entries), 0);
          return (
            <div key={t.k}>
              <div className="pnl-sechead"><h3>{t.p}</h3><span>{sgn(tot)}</span></div>
              <div className="card pnl-list">
                {as.map((a) => {
                  const n = entries.filter((e) => e.cashId === a.id || e.accountId === a.id).length;
                  return (
                    <button type="button" key={a.id} className="pnl-row" onClick={() => setLedgerId(a.id)}>
                      <span className="pnl-mid"><b>{a.name}</b><span>{n} entr{n === 1 ? "y" : "ies"} · tap for ledger</span></span>
                      <span className="pnl-amt">{sgn(balance(a, entries))}</span>
                      <ChevronRight size={16} className="pnl-chev" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <button type="button" className="pnl-addrow" onClick={() => setSheet({ kind: "account", id: null })}><Plus size={16} /> Add account</button>
      </>
    );
  }

  // ---------------- Reports (P&L) ----------------
  function ReportsView() {
    const d = plData(P, accounts, entries);
    const busy = pdfBusy, setBusy = setPdfBusy, err = pdfErr, setErr = setPdfErr;
    const part = (label: string, s: typeof d.inc) => (
      <>
        <div className="pnl-sechead"><h3>{label}</h3></div>
        <div className="card pnl-pl">
          {s.rows.length ? s.rows.map((r) => <div className="pnl-line" key={r.name}><span>{r.name}</span><span>{sgn(r.total)}</span></div>) : <div className="pnl-line"><span className="label" style={{ margin: 0 }}>Nothing recorded</span><span /></div>}
          <div className="pnl-line tot"><span>Total {label.toLowerCase()}</span><span>{sgn(s.tot)}</span></div>
        </div>
      </>
    );
    return (
      <>
        <div className="pnl-seg" role="group">
          <button type="button" aria-pressed={P.mode === "month"} onClick={() => setP({ mode: "month", y: T.y, m: T.m })}>Month</button>
          <button type="button" aria-pressed={P.mode === "year"} onClick={() => setP({ mode: "year", y: budgetYearOf(today), m: T.m })}>Budget year</button>
        </div>
        {stepper}
        {part("Income", d.inc)}
        {part("Expenses", d.exp)}
        <div className="pnl-net">
          <div><small>{d.net >= 0 ? "Net profit" : "Net loss"}</small><b>{sgn(d.net)}</b></div>
          <span>ETB</span>
        </div>
        <button
          type="button"
          className="btn btn-primary pnl-block"
          disabled={busy}
          onClick={async () => {
            setBusy(true); setErr(null);
            try { await downloadPlPdf(d); setToast("PDF downloaded"); } catch { setErr("Could not create the PDF. Try again."); }
            setBusy(false);
          }}
        >
          <FileDown size={16} /> {busy ? "Preparing…" : "Download P&L PDF"}
        </button>
        {err && <p className="login-error">{err}</p>}
      </>
    );
  }

  return (
    <div className="pnl">
      <div className="pnl-head">
        <div>
          <h1 style={{ margin: 0 }}>P&amp;L</h1>
          <p className="label" style={{ margin: "4px 0 0" }}>General ledger · Hadar Trading PLC · ETB</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setSheet({ kind: "entry", id: null })}><Plus size={16} /> New entry</button>
      </div>

      <div className="pnl-tabs">
        {([["entries", "Entries", List], ["accounts", "Accounts", BookOpen], ["reports", "Reports", TrendingUp]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" className={`tab${tab === k ? " active" : ""}`} onClick={() => switchTab(k)}>
            <Icon size={15} /> {l}
          </button>
        ))}
      </div>

      <div className="pnl-body">{tab === "entries" ? EntriesView() : tab === "accounts" ? AccountsView() : ReportsView()}</div>

      {sheet?.kind === "entry" && (
        <EntrySheet
          key={sheet.id ?? "new"}
          id={sheet.id}
          draft={sheet.draft}
          accounts={accounts}
          entries={entries}
          today={today}
          onClose={() => setSheet(null)}
          onSaved={(e, wasNew) => {
            upsertEntry(e);
            setSheet(null);
            if (wasNew && tab === "entries" && P.mode === "month") { const d = toEth(e.date); setP({ mode: "month", y: d.y, m: d.m }); }
            setToast(wasNew ? "Entry saved" : "Entry updated");
          }}
          onDeleted={(id) => { setEntries((prev) => prev.filter((x) => x.id !== id)); setSheet(null); setToast("Entry deleted"); }}
          onNewAccount={(draft, field, type) =>
            setSheet({
              kind: "account",
              id: null,
              presetType: type,
              then: (nid) => setSheet({ kind: "entry", id: sheet.id, draft: { ...draft, [field]: nid } }),
              back: () => setSheet({ kind: "entry", id: sheet.id, draft }),
            })
          }
        />
      )}
      {sheet?.kind === "account" && (
        <AccountSheet
          id={sheet.id}
          presetType={sheet.presetType}
          accounts={accounts}
          used={!!sheet.id && entries.some((e) => e.cashId === sheet.id || e.accountId === sheet.id)}
          onClose={() => (sheet.back ? sheet.back() : setSheet(null))}
          onSaved={(a, wasNew) => {
            upsertAccount(a);
            setToast(wasNew ? "Account added" : "Account updated");
            if (sheet.then && wasNew) sheet.then(a.id); else setSheet(null);
          }}
          onDeleted={(id) => { setAccounts((prev) => prev.filter((x) => x.id !== id)); setLedgerId(null); setSheet(null); setToast("Account deleted"); }}
        />
      )}
      {toast && <div className="pnl-toast" role="status">{toast}</div>}
    </div>
  );
}

// ================= sheets =================
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.documentElement.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.documentElement.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="pnl-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="pnl-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="pnl-shead"><h2>{title}</h2><button type="button" className="pnl-iconbtn light" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <div className="pnl-sbody">{children}</div>
      </section>
    </div>
  );
}

function EthDate({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const e = toEth(value);
  const ty = toEth(addisToday()).y;
  const years: number[] = [];
  for (let y = ty - 4; y <= ty + 1; y++) years.push(y);
  const set = (y: number, m: number, d: number) => onChange(fromEth(y, m, Math.min(d, ethMonthLength(y, m))));
  return (
    <label className="pnl-f">
      <span>Date</span>
      <div className="pnl-date3">
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

function EntrySheet({
  id, draft, accounts, entries, today, onClose, onSaved, onDeleted, onNewAccount,
}: {
  id: string | null;
  draft?: Draft;
  accounts: Account[];
  entries: Entry[];
  today: string;
  onClose: () => void;
  onSaved: (e: Entry, wasNew: boolean) => void;
  onDeleted: (id: string) => void;
  onNewAccount: (draft: Draft, field: "cashId" | "accountId", type: AccountType) => void;
}) {
  const assets = accounts.filter((a) => a.type === "asset");
  const orig = id ? entries.find((x) => x.id === id) : undefined;
  const start: Draft = { kind: "out", amount: undefined, cashId: assets[0]?.id ?? "", accountId: "", date: today, note: "", ref: "", receipt: null, ...(orig ?? {}), ...(draft ?? {}) };
  const [kind, setKind] = useState<"in" | "out">(start.kind ?? "out");
  const [amount, setAmount] = useState(start.amount ? String(start.amount) : "");
  const [cashId, setCashId] = useState(assets.some((a) => a.id === start.cashId) ? start.cashId! : assets[0]?.id ?? "");
  const [accountId, setAccountId] = useState(start.accountId ?? "");
  const [date, setDate] = useState(start.date ?? today);
  const [note, setNote] = useState(start.note ?? "");
  const [ref, setRef] = useState(start.ref ?? "");
  const [receipt, setReceipt] = useState(start.receipt ?? null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);

  const draftNow = (): Draft => ({ kind, amount: Number(amount) || undefined, cashId, accountId, date, note, ref, receipt });

  if (!assets.length) {
    return (
      <Sheet title="New entry" onClose={onClose}>
        <div className="pnl-empty">
          <h2>Add a cash or bank account first</h2>
          <p>Every entry goes into or out of a cash or bank account, such as Cash on hand or CBE account.</p>
          <button type="button" className="btn btn-primary" onClick={() => onNewAccount(draftNow(), "cashId", "asset")}>Add cash or bank account</button>
        </div>
      </Sheet>
    );
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true); setErr(null);
    const prepared = await prepareReceipt(file);
    if ("error" in prepared) { setErr(prepared.error); setUploading(false); return; }
    const fd = new FormData();
    fd.append("file", prepared.file);
    try {
      const res = await uploadPnlReceiptAction(fd);
      if (res.error !== undefined) setErr(res.error); else setReceipt(res.file);
    } catch { setErr("Couldn't upload the picture. Check your connection and try again."); }
    setUploading(false);
  }

  async function save() {
    setErr(null);
    const v = Math.round(parseFloat(amount.replace(/,/g, "")) * 100) / 100;
    if (!(v > 0)) return setErr("Enter an amount above zero.");
    if (!accountId) return setErr(kind === "in" ? "Choose what the money was received for." : "Choose what the money was spent on.");
    if (!note.trim()) return setErr("Enter a description.");
    setBusy(true);
    try {
      const res = await saveEntryAction(id, { kind, amount: v, cashId, accountId, date, note, ref, receipt });
      if (res.error !== undefined) setErr(res.error); else onSaved(res.entry, !id);
    } catch { setErr("Couldn't save. Check your connection and try again."); }
    setBusy(false);
  }

  const catGroups = TYPES.map((t) => ({ t, as: accounts.filter((x) => x.type === t.k && x.id !== cashId) })).filter((g) => g.as.length);

  return (
    <Sheet title={id ? "Edit entry" : "New entry"} onClose={onClose}>
      <div className="pnl-seg big" role="group">
        <button type="button" aria-pressed={kind === "in"} onClick={() => setKind("in")}><ArrowDownLeft size={16} /> Money in</button>
        <button type="button" aria-pressed={kind === "out"} onClick={() => setKind("out")}><ArrowUpRight size={16} /> Money out</button>
      </div>
      <label className="pnl-f">
        <span>Amount (ETB)</span>
        <input className="input pnl-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!id} />
      </label>
      <label className="pnl-f">
        <span>{kind === "in" ? "Received into" : "Paid from"}</span>
        <select className="input" value={cashId} onChange={(e) => (e.target.value === "__new" ? onNewAccount(draftNow(), "cashId", "asset") : setCashId(e.target.value))}>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value="__new">+ New cash or bank account…</option>
        </select>
      </label>
      <label className="pnl-f">
        <span>{kind === "in" ? "Received for" : "Spent on"}</span>
        <select className="input" value={accountId} onChange={(e) => (e.target.value === "__new" ? onNewAccount(draftNow(), "accountId", kind === "in" ? "income" : "expense") : setAccountId(e.target.value))}>
          <option value="">Choose…</option>
          {catGroups.map((g) => (
            <optgroup key={g.t.k} label={g.t.p}>{g.as.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
          ))}
          <option value="__new">+ New account…</option>
        </select>
        <em>{kind === "in" ? "Usually an Income account, like Sales." : "Usually an Expense account. Pick an Asset account to move money between cash and bank."}</em>
      </label>
      <EthDate value={date} onChange={setDate} />
      <label className="pnl-f">
        <span>Description</span>
        <input className="input" placeholder="e.g. Shop sign for Zemen Bank" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="pnl-f">
        <span>Reference <span className="label" style={{ display: "inline", margin: 0 }}>(optional)</span></span>
        <input className="input" placeholder="Invoice or receipt no." value={ref} onChange={(e) => setRef(e.target.value)} />
      </label>
      <div className="pnl-f">
        <span>Receipt photo <span className="label" style={{ display: "inline", margin: 0 }}>(optional)</span></span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {receipt && <Lightbox file={receipt} size={48} />}
          <label className="btn btn-sm">
            {uploading ? "Uploading…" : receipt ? "Change" : "Attach receipt"}
            <input type="file" accept="image/*,.pdf" hidden disabled={uploading} onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {receipt && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setReceipt(null)}>Remove</button>}
        </div>
      </div>
      {err && <p className="login-error">{err}</p>}
      <div className="pnl-sactions">
        {id && (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={async () => {
              if (!armed) return setArmed(true);
              setBusy(true);
              const res = await deleteEntryAction(id);
              setBusy(false);
              if (res.error !== undefined) setErr(res.error); else onDeleted(id);
            }}
          >
            {armed ? "Tap again to delete" : "Delete"}
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={busy || uploading} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Sheet>
  );
}

function AccountSheet({
  id, presetType, accounts, used, onClose, onSaved, onDeleted,
}: {
  id: string | null;
  presetType?: AccountType;
  accounts: Account[];
  used: boolean;
  onClose: () => void;
  onSaved: (a: Account, wasNew: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const cur = id ? accounts.find((a) => a.id === id) : undefined;
  const [name, setName] = useState(cur?.name ?? "");
  const [type, setType] = useState<AccountType>(cur?.type ?? presetType ?? "asset");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  return (
    <Sheet title={id ? "Edit account" : "New account"} onClose={onClose}>
      <label className="pnl-f">
        <span>Account name</span>
        <input className="input" placeholder="e.g. Cash on hand, CBE account, Signage sales" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!id} />
      </label>
      <div className="pnl-f">
        <span>Type</span>
        <div className="pnl-types">
          {TYPES.map((t) => (
            <button key={t.k} type="button" disabled={used} aria-pressed={type === t.k} onClick={() => setType(t.k)}>
              <b>{t.n}</b><small>{t.h}</small>
            </button>
          ))}
        </div>
        {used && <em>Type is locked because this account has entries.</em>}
      </div>
      {err && <p className="login-error">{err}</p>}
      <div className="pnl-sactions">
        {id && (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={async () => {
              if (used) return setErr("This account has entries. Delete or move them first.");
              if (!armed) return setArmed(true);
              setBusy(true);
              const res = await deleteAccountAction(id);
              setBusy(false);
              if (res.error !== undefined) setErr(res.error); else onDeleted(id);
            }}
          >
            {armed ? "Tap again to delete" : "Delete"}
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setErr(null);
            if (!name.trim()) return setErr("Give the account a name.");
            setBusy(true);
            try {
              const res = await saveAccountAction(id, name, type);
              if (res.error !== undefined) setErr(res.error); else onSaved(res.account, !id);
            } catch { setErr("Couldn't save. Check your connection and try again."); }
            setBusy(false);
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Sheet>
  );
}
