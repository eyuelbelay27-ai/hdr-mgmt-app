"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, Paperclip, Plus, Trash2, X } from "lucide-react";
import {
  OVERTIME_TYPES,
  commissionPay,
  grossPay,
  netPay,
  normalizePayTypes,
  overtimePay,
  salaryPay,
  type PayTypes,
  type PayrollRow,
} from "@/lib/payroll/calc";
import { parsePayrollMonth, payrollMonthLabel } from "@/lib/payroll/month";
import { round2 } from "@/lib/money";
import {
  addPayrollCommissionAction,
  deletePayrollCommissionAction,
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

export interface CommissionLine {
  id: string;
  jobName: string;
  amount: number;
}

export interface PayrollEntryData extends PayrollRow {
  id: string;
  employeeName: string;
  owedBefore: number;
  deductionItems: { id: string; reason: string; amount: number }[];
  commissionItems: CommissionLine[];
  receipt: FileRef | null;
}

const EDITABLE_FIELDS = ["salary", ...OVERTIME_TYPES.map((t) => t.hoursKey), "debtRepayment"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];
type RowValues = Record<EditableField, string>;

const PAY_TYPE_LABELS: [keyof PayTypes, string][] = [
  ["paySalary", "Salary"],
  ["payOvertime", "Overtime"],
  ["payCommission", "Commission"],
];

function toValues(e: PayrollEntryData): RowValues {
  return Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, String(e[f])])) as RowValues;
}

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function asRow(entry: PayrollEntryData, values: RowValues, types: PayTypes, lines: CommissionLine[]): PayrollRow {
  return {
    ...entry,
    ...(Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, num(values[f])])) as Record<EditableField, number>),
    ...types,
    commission: round2(lines.reduce((s, l) => s + l.amount, 0)),
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

/** A row of figures with a divider between each; columns match the count. */
function Summary({ items }: { items: [string, string][] }) {
  return (
    <div className="pr-summary" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(([label, value]) => (
        <Stat key={label} label={label} value={value} />
      ))}
    </div>
  );
}

const dash = (n: number) => (n ? money(round2(n)) : "—");

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
  const [types, setTypes] = useState<Record<string, PayTypes>>(() =>
    Object.fromEntries(
      entries.map((e) => [e.id, { paySalary: e.paySalary, payOvertime: e.payOvertime, payCommission: e.payCommission }])
    )
  );
  const [lines, setLines] = useState<Record<string, CommissionLine[]>>(() =>
    Object.fromEntries(entries.map((e) => [e.id, e.commissionItems]))
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
  const rows = entries.map((e) => asRow(e, values[e.id], types[e.id], lines[e.id]));
  const totals = rows.reduce(
    (t, r) => ({
      salary: t.salary + salaryPay(r),
      overtime: t.overtime + overtimePay(r),
      commission: t.commission + commissionPay(r),
      gross: t.gross + grossPay(r),
      repayment: t.repayment + r.debtRepayment,
      deductions: t.deductions + r.deductions,
      net: t.net + netPay(r),
    }),
    { salary: 0, overtime: 0, commission: 0, gross: 0, repayment: 0, deductions: 0, net: 0 }
  );
  const receipts = entries.filter((e) => e.receipt).length;
  const anyOvertime = rows.some((r) => r.paySalary && r.payOvertime);
  const anyCommission = rows.some((r) => r.payCommission);

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
                {activeCount === 1 ? "" : "s"} with their current salary, pay types and overtime rates.
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
                types={types[entry.id]}
                lines={lines[entry.id]}
                open={openIds.has(entry.id)}
                monthLabel={label}
                onToggle={() => toggle(entry.id)}
                onValues={(next) => setValues((v) => ({ ...v, [entry.id]: next }))}
                onTypes={(next) => setTypes((t) => ({ ...t, [entry.id]: next }))}
                onLines={(update) => setLines((l) => ({ ...l, [entry.id]: update(l[entry.id]) }))}
              />
            ))}
          </div>

          <div className="pr-totals pr-sticky" data-testid="payroll-totals">
            <div className="pr-totals-head">
              <span className="pr-totals-title">Totals ({entries.length})</span>
              <Stat label="Salary" value={money(round2(totals.salary))} />
            </div>
            <div className="pr-totals-body">
              <Summary
                items={[
                  ...(anyOvertime ? [["OT Pay", dash(totals.overtime)] as [string, string]] : []),
                  ...(anyCommission ? [["Commission", dash(totals.commission)] as [string, string]] : []),
                  ["Gross", money(round2(totals.gross))],
                  ["Repayment", dash(totals.repayment)],
                  ["Deductions", dash(totals.deductions)],
                ]}
              />
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
  types,
  lines,
  open,
  monthLabel,
  onToggle,
  onValues,
  onTypes,
  onLines,
}: {
  entry: PayrollEntryData;
  values: RowValues;
  types: PayTypes;
  lines: CommissionLine[];
  open: boolean;
  monthLabel: string;
  onToggle: () => void;
  onValues: (next: RowValues) => void;
  onTypes: (next: PayTypes) => void;
  onLines: (update: (current: CommissionLine[]) => CommissionLine[]) => void;
}) {
  const autosave = useAutosave((fd) => updatePayrollEntryAction(entry.id, fd));
  const [removing, startRemove] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const row = asRow(entry, values, types, lines);
  const net = netPay(row);
  const hasDebt = entry.owedBefore > 0 || row.debtRepayment > 0;
  const debtLeft = round2(entry.owedBefore - row.debtRepayment);
  const showOvertime = types.paySalary && types.payOvertime;

  function buildFormData(nextValues: RowValues, nextTypes: PayTypes) {
    const fd = new FormData();
    EDITABLE_FIELDS.forEach((f) => fd.set(f, nextValues[f]));
    PAY_TYPE_LABELS.forEach(([key]) => {
      if (nextTypes[key]) fd.set(key, "on");
    });
    return fd;
  }

  function edit(field: EditableField, value: string) {
    const next = { ...values, [field]: value };
    onValues(next);
    autosave.schedule(() => buildFormData(next, types));
  }

  function switchType(key: keyof PayTypes) {
    const next = normalizePayTypes({ ...types, [key]: !types[key] });
    if (!next.paySalary && !next.payCommission) {
      setActionError("Keep Salary or Commission on.");
      return;
    }
    setActionError(null);
    onTypes(next);
    autosave.saveNow(() => buildFormData(values, next));
  }

  function remove() {
    if (!confirm(`Remove ${entry.employeeName} from ${monthLabel}? Its commission lines are removed too.`)) return;
    setActionError(null);
    startRemove(async () => {
      const result = await removePayrollEntryAction(entry.id);
      if (result.error) setActionError(result.error);
    });
  }

  const flags = [
    entry.receipt ? "Receipt ✓" : "No receipt",
    types.payCommission && lines.length ? `${lines.length} commission${lines.length > 1 ? "s" : ""}` : null,
    entry.deductionItems.length ? `${entry.deductionItems.length} deduction${entry.deductionItems.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  const field = (key: EditableField, labelText: string, hint?: string) => (
    <div key={key}>
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
          {types.paySalary ? (
            <Stat label="Salary" value={money(row.salary)} />
          ) : (
            <Stat label="Commission" value={money(commissionPay(row))} />
          )}
        </span>
        <span className="pr-head-stat">
          <Stat label="Net Pay" value={`${money(net)} Br`} tone={net < 0 ? "negative" : "accent"} />
        </span>
        <ChevronDown size={18} className="pr-chevron" />
      </button>

      {open && (
        <div className="pr-card-body">
          <div className="pr-pills" role="group" aria-label={`${entry.employeeName} pay types this month`}>
            {PAY_TYPE_LABELS.map(([key, text]) => {
              const disabled = key === "payOvertime" && !types.paySalary;
              return (
                <button
                  key={key}
                  type="button"
                  className={`pr-pill${types[key] ? " on" : ""}`}
                  aria-pressed={types[key]}
                  disabled={disabled}
                  title={disabled ? "Overtime needs Salary" : undefined}
                  onClick={() => switchType(key)}
                >
                  {text}
                </button>
              );
            })}
          </div>

          <div className="pr-panel">
            {(types.paySalary || hasDebt) && (
              <div className="pr-fields">
                {showOvertime && OVERTIME_TYPES.map((t) => field(t.hoursKey, `${t.label} OT hrs (×${entry[t.multiplierKey]})`))}
                {types.paySalary && field("salary", "Salary (Br)")}
                {hasDebt
                  ? field("debtRepayment", "Debt repayment (Br)", `Owes ${money(entry.owedBefore)} · after this: ${money(debtLeft)}`)
                  : (
                    <div>
                      <div className="pr-k">Debt repayment</div>
                      <div className="pr-field-hint" style={{ marginTop: 10 }}>No debt</div>
                    </div>
                  )}
              </div>
            )}

            {types.payCommission && (
              <CommissionLines
                entryId={entry.id}
                employeeName={entry.employeeName}
                lines={lines}
                onLines={onLines}
                onError={setActionError}
              />
            )}

            <Summary
              items={[
                ...(showOvertime ? [["OT Pay", money(overtimePay(row))] as [string, string]] : []),
                ...(types.payCommission ? [["Commission", money(commissionPay(row))] as [string, string]] : []),
                ["Gross", money(grossPay(row))],
                ["Repayment", dash(row.debtRepayment)],
                ["Deductions", dash(row.deductions)],
              ]}
            />
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

function CommissionLines({
  entryId,
  employeeName,
  lines,
  onLines,
  onError,
}: {
  entryId: string;
  employeeName: string;
  lines: CommissionLine[];
  onLines: (update: (current: CommissionLine[]) => CommissionLine[]) => void;
  onError: (message: string | null) => void;
}) {
  const [jobName, setJobName] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, startBusy] = useTransition();
  const total = round2(lines.reduce((s, l) => s + l.amount, 0));

  function add() {
    onError(null);
    const fd = new FormData();
    fd.set("jobName", jobName);
    fd.set("amount", amount);
    startBusy(async () => {
      const result = await addPayrollCommissionAction(entryId, fd);
      if (result.error) onError(result.error);
      else if (result.line) {
        const line = result.line;
        onLines((current) => [...current, line]);
        setJobName("");
        setAmount("");
      }
    });
  }

  function remove(line: CommissionLine) {
    if (!confirm(`Remove the ${money(line.amount)} Br commission for "${line.jobName}"?`)) return;
    onError(null);
    startBusy(async () => {
      const result = await deletePayrollCommissionAction(line.id);
      if (result.error) onError(result.error);
      else onLines((current) => current.filter((l) => l.id !== line.id));
    });
  }

  return (
    <div className="pr-commission">
      <div className="pr-k">Commission · {money(total)} Br</div>
      {lines.length > 0 && (
        <div className="pr-chips">
          {lines.map((l) => (
            <div key={l.id} className="pr-chip pr-chip-plus" data-commission={l.jobName}>
              <span>{l.jobName}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="mono">+{money(l.amount)}</span>
                <button
                  type="button"
                  className="pr-chip-x"
                  aria-label={`Remove commission for ${l.jobName}`}
                  disabled={busy}
                  onClick={() => remove(l)}
                >
                  <X size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      <form
        className="pr-commission-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="input"
          placeholder="Job / customer"
          aria-label={`${employeeName} commission job or customer`}
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
        />
        <input
          className="input"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          placeholder="Br"
          aria-label={`${employeeName} commission amount`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="submit" className="btn btn-sm pr-btn-soft" disabled={busy} aria-label={`Add commission for ${employeeName}`}>
          <Plus size={15} strokeWidth={2.25} />
          {busy ? "…" : "Add"}
        </button>
      </form>
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
