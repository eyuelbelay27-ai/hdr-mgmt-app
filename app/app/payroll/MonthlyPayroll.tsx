"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, Paperclip, Plus, Trash2, X } from "lucide-react";
import { OVERTIME_TYPES, grossPay, netPay, overtimePay, type PayrollRow } from "@/lib/payroll/calc";
import { parsePayrollMonth, payrollMonthLabel } from "@/lib/payroll/month";
import { round2 } from "@/lib/money";
import {
  removePayrollEntryAction,
  removePayrollReceiptAction,
  startPayrollMonthAction,
  updatePayrollEntryAction,
  uploadPayrollReceiptAction,
} from "./actions";
import { MonthSwitcher } from "./MonthSwitcher";
import { prepareReceipt } from "./prepareReceipt";
import { useAutosave } from "../useAutosave";
import { SaveStatusBadge } from "../SaveStatusBadge";
import { Lightbox, type FileRef } from "../Lightbox";

export interface PayrollEntryData extends PayrollRow {
  id: string;
  employeeName: string;
  owedBefore: number;
  deductionItems: { id: string; reason: string; amount: number }[];
  receipt: FileRef | null;
}

const EDITABLE_FIELDS = ["salary", ...OVERTIME_TYPES.map((t) => t.hoursKey), "debtRepayment"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];
type RowValues = Record<EditableField, string>;

function toValues(e: PayrollEntryData): RowValues {
  return Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, String(e[f])])) as RowValues;
}

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function asRow(entry: PayrollEntryData, values: RowValues): PayrollRow {
  return {
    ...entry,
    ...(Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, num(values[f])])) as Record<EditableField, number>),
  };
}

export function money(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "accent" | "negative" }) {
  return (
    <div>
      <div className="pr-k">{label}</div>
      <div className={`pr-v${tone ? ` ${tone}` : ""}`}>{value}</div>
    </div>
  );
}

function NetLine({ value, label }: { value: number; label: string }) {
  return (
    <div className={`pr-net${value < 0 ? " negative" : ""}`}>
      <span className="pr-k">{label}</span>
      <span className={`pr-v ${value < 0 ? "negative" : "accent"}`}>{money(value)} Br</span>
    </div>
  );
}

export function MonthlyPayroll({
  monthKey,
  entries,
  missingActive,
  activeCount,
}: {
  monthKey: string;
  entries: PayrollEntryData[];
  missingActive: string[];
  activeCount: number;
}) {
  const [values, setValues] = useState<Record<string, RowValues>>(() =>
    Object.fromEntries(entries.map((e) => [e.id, toValues(e)]))
  );
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(entries.length === 1 ? [entries[0].id] : []));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = payrollMonthLabel(parsePayrollMonth(monthKey)!);

  function addEmployees() {
    setError(null);
    startTransition(async () => {
      const result = await startPayrollMonthAction(monthKey);
      if (result.error) setError(result.error);
    });
  }

  function toggle(id: string) {
    setOpenIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOpen = entries.length > 0 && openIds.size === entries.length;
  const rows = entries.map((e) => asRow(e, values[e.id]));
  const totals = rows.reduce(
    (t, r) => ({
      salary: t.salary + r.salary,
      overtime: t.overtime + overtimePay(r),
      gross: t.gross + grossPay(r),
      repayment: t.repayment + r.debtRepayment,
      deductions: t.deductions + r.deductions,
      net: t.net + netPay(r),
    }),
    { salary: 0, overtime: 0, gross: 0, repayment: 0, deductions: 0, net: 0 }
  );
  const receipts = entries.filter((e) => e.receipt).length;

  return (
    <div className="pr-stack">
      <div className="pr-toolbar">
        <span />
        <MonthSwitcher monthKey={monthKey} />
        {entries.length > 1 ? (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setOpenIds(allOpen ? new Set() : new Set(entries.map((e) => e.id)))}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        ) : (
          <span />
        )}
      </div>

      {entries.length === 0 ? (
        <div className="pr-section" style={{ justifyItems: "center", textAlign: "center" }}>
          <h3 style={{ margin: 0 }}>{label}</h3>
          {activeCount === 0 ? (
            <p className="pr-empty" style={{ padding: 0 }}>Add employees in Settings first.</p>
          ) : (
            <>
              <p className="pr-empty" style={{ padding: 0 }}>
                No payroll for this month yet. Starting it adds your {activeCount} active employee
                {activeCount === 1 ? "" : "s"} with their current salary and overtime rates.
              </p>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={addEmployees}>
                {pending ? "Starting…" : `Start ${label} payroll`}
              </button>
            </>
          )}
          {error && <span className="login-error">{error}</span>}
        </div>
      ) : (
        <>
          {missingActive.length > 0 && (
            <div className="pr-banner">
              <AlertTriangle size={20} strokeWidth={2} color="var(--warn)" />
              <span className="pr-banner-text">
                Not in {label}: <strong>{missingActive.join(", ")}</strong>
              </span>
              <button type="button" className="btn btn-sm pr-btn-soft" disabled={pending} onClick={addEmployees}>
                <Plus size={15} strokeWidth={2.25} />
                {pending ? "Adding…" : "Add to this month"}
              </button>
              {error && <span className="login-error">{error}</span>}
            </div>
          )}

          <div className="pr-grid">
            {entries.map((entry) => (
              <EmployeeCard
                key={entry.id}
                entry={entry}
                values={values[entry.id]}
                open={openIds.has(entry.id)}
                monthLabel={label}
                onToggle={() => toggle(entry.id)}
                onChange={(next) => setValues((v) => ({ ...v, [entry.id]: next }))}
              />
            ))}
          </div>

          <div className="pr-totals">
            <div className="pr-totals-head">
              <span className="pr-totals-title">Totals ({entries.length})</span>
              <Stat label="Salary" value={money(round2(totals.salary))} />
            </div>
            <div className="pr-totals-body">
              <div className="pr-summary four" style={{ borderTop: 0, paddingTop: 0 }}>
                <Stat label="OT Pay" value={money(round2(totals.overtime))} />
                <Stat label="Gross" value={money(round2(totals.gross))} />
                <Stat label="Repayment" value={totals.repayment ? money(round2(totals.repayment)) : "—"} />
                <Stat label="Deductions" value={totals.deductions ? money(round2(totals.deductions)) : "—"} />
              </div>
              <NetLine value={round2(totals.net)} label="Total net pay" />
              <div className="pr-sub">
                Receipts uploaded: {receipts} of {entries.length}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmployeeCard({
  entry,
  values,
  open,
  monthLabel,
  onToggle,
  onChange,
}: {
  entry: PayrollEntryData;
  values: RowValues;
  open: boolean;
  monthLabel: string;
  onToggle: () => void;
  onChange: (next: RowValues) => void;
}) {
  const autosave = useAutosave((fd) => updatePayrollEntryAction(entry.id, fd));
  const [removing, startRemove] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const row = asRow(entry, values);
  const net = netPay(row);
  const hasDebt = entry.owedBefore > 0 || row.debtRepayment > 0;
  const debtLeft = round2(entry.owedBefore - row.debtRepayment);

  function edit(field: EditableField, value: string) {
    const next = { ...values, [field]: value };
    onChange(next);
    autosave.schedule(() => {
      const fd = new FormData();
      EDITABLE_FIELDS.forEach((f) => fd.set(f, next[f]));
      return fd;
    });
  }

  function remove() {
    if (!confirm(`Remove ${entry.employeeName} from ${monthLabel}?`)) return;
    setActionError(null);
    startRemove(async () => {
      const result = await removePayrollEntryAction(entry.id);
      if (result.error) setActionError(result.error);
    });
  }

  const flags = [
    entry.receipt ? "Receipt ✓" : "No receipt",
    entry.deductionItems.length ? `${entry.deductionItems.length} deduction${entry.deductionItems.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  const field = (key: EditableField, labelText: string, hint?: string) => (
    <div>
      <label className="pr-k" htmlFor={`${entry.id}-${key}`}>{labelText}</label>
      <input
        id={`${entry.id}-${key}`}
        className="input"
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        aria-label={`${entry.employeeName} ${labelText}`}
        value={values[key]}
        onChange={(e) => edit(key, e.target.value)}
      />
      {hint && <div className="pr-field-hint">{hint}</div>}
    </div>
  );

  return (
    <div className={`pr-card${open ? " open" : ""}`} data-employee={entry.employeeName}>
      <button type="button" className="pr-card-head" aria-expanded={open} onClick={onToggle}>
        <span className="pr-avatar">{entry.employeeName.trim().charAt(0).toUpperCase() || "?"}</span>
        <span className="pr-who">
          <div className="pr-name">{entry.employeeName}</div>
          <div className="pr-sub">{flags.join(" · ")}</div>
        </span>
        <span className="pr-head-stat">
          <Stat label="Salary" value={money(row.salary)} />
        </span>
        <span className="pr-head-stat">
          <Stat label="Net Pay" value={`${money(net)} Br`} tone={net < 0 ? "negative" : "accent"} />
        </span>
        <ChevronDown size={18} className="pr-chevron" />
      </button>

      {open && (
        <div className="pr-card-body">
          <div className="pr-panel">
            <div className="pr-fields">
              {OVERTIME_TYPES.map((t) => field(t.hoursKey, `${t.label} OT hrs (×${entry[t.multiplierKey]})`))}
              {field("salary", "Salary (Br)")}
              {hasDebt
                ? field("debtRepayment", "Debt repayment (Br)", `Owes ${money(entry.owedBefore)} · after this: ${money(debtLeft)}`)
                : (
                  <div>
                    <div className="pr-k">Debt repayment</div>
                    <div className="pr-field-hint" style={{ marginTop: 10 }}>No debt</div>
                  </div>
                )}
            </div>
            <div className="pr-summary four">
              <Stat label="OT Pay" value={money(overtimePay(row))} />
              <Stat label="Gross" value={money(grossPay(row))} />
              <Stat label="Repayment" value={row.debtRepayment ? money(row.debtRepayment) : "—"} />
              <Stat label="Deductions" value={row.deductions ? money(row.deductions) : "—"} />
            </div>
            {entry.deductionItems.length > 0 && (
              <div className="pr-chips">
                {entry.deductionItems.map((d) => (
                  <div key={d.id} className="pr-chip">
                    <span>{d.reason}</span>
                    <span className="mono">−{money(d.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <NetLine value={net} label="Net pay" />
          </div>

          <div className="pr-card-foot">
            <ReceiptControl entryId={entry.id} employeeName={entry.employeeName} initial={entry.receipt} onError={setActionError} />
            <span className="pr-spacer" />
            <SaveStatusBadge status={autosave.status} error={autosave.error} />
            {actionError && <span className="login-error">{actionError}</span>}
            <button type="button" className="btn btn-sm btn-ghost" disabled={removing} onClick={remove}>
              <Trash2 size={15} strokeWidth={1.75} />
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptControl({
  entryId,
  employeeName,
  initial,
  onError,
}: {
  entryId: string;
  employeeName: string;
  initial: FileRef | null;
  onError: (message: string | null) => void;
}) {
  const [receipt, setReceipt] = useState<FileRef | null>(initial);
  const [busy, startBusy] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(file: File | undefined) {
    if (!file) return;
    onError(null);
    startBusy(async () => {
      const prepared = await prepareReceipt(file);
      if ("error" in prepared) {
        onError(prepared.error);
        return;
      }
      const fd = new FormData();
      fd.set("receipt", prepared.file);
      const result = await uploadPayrollReceiptAction(entryId, fd);
      if (result.error) onError(result.error);
      else if (result.receipt) setReceipt(result.receipt);
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function clear() {
    if (!confirm("Remove this receipt?")) return;
    onError(null);
    startBusy(async () => {
      const result = await removePayrollReceiptAction(entryId);
      if (result.error) onError(result.error);
      else setReceipt(null);
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        hidden
        aria-label={`${employeeName} payment receipt`}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {receipt ? (
        <>
          <Lightbox file={receipt} size={34} />
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Uploading…" : "Replace"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost pr-icon-btn"
            aria-label="Remove receipt"
            title="Remove receipt"
            disabled={busy}
            onClick={clear}
          >
            <X size={15} />
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-sm pr-btn-soft" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Paperclip size={14} strokeWidth={2} />
          {busy ? "Uploading…" : "Upload receipt"}
        </button>
      )}
    </div>
  );
}
