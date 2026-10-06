"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { OVERTIME_TYPES, grossPay, netPay, overtimePay, type PayrollRow } from "@/lib/payroll/calc";
import { formatPayrollMonthKey, parsePayrollMonth, payrollMonthLabel } from "@/lib/payroll/month";
import { round2 } from "@/lib/money";
import { removePayrollEntryAction, startPayrollMonthAction, updatePayrollEntryAction } from "./actions";
import { useAutosave } from "../useAutosave";
import { SaveStatusBadge } from "../SaveStatusBadge";

export interface PayrollEntryData extends PayrollRow {
  id: string;
  employeeName: string;
  owedBefore: number;
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

function money(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function shiftMonth(monthKey: string, delta: number): string {
  const m = parsePayrollMonth(monthKey)!;
  const index = m.year * 12 + (m.month - 1) + delta;
  return formatPayrollMonthKey({ year: Math.floor(index / 12), month: (index % 12) + 1 });
}

/** Shown in the column header only when every row shares the same rate;
 * a row added after Settings changed keeps its own and shows it inline. */
function sharedMultiplier(entries: PayrollEntryData[], key: (typeof OVERTIME_TYPES)[number]["multiplierKey"]) {
  const first = entries[0]?.[key];
  return entries.every((e) => e[key] === first) ? first ?? null : null;
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
  const router = useRouter();
  const [values, setValues] = useState<Record<string, RowValues>>(() =>
    Object.fromEntries(entries.map((e) => [e.id, toValues(e)]))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = payrollMonthLabel(parsePayrollMonth(monthKey)!);

  function goTo(key: string) {
    if (parsePayrollMonth(key)) router.push(`/payroll?month=${key}`);
  }

  function addEmployees() {
    setError(null);
    startTransition(async () => {
      const result = await startPayrollMonthAction(monthKey);
      if (result.error) setError(result.error);
    });
  }

  const rows = entries.map((e) => asRow(e, values[e.id]));
  const totals = rows.reduce(
    (t, r) => ({
      salary: t.salary + r.salary,
      overtime: t.overtime + overtimePay(r),
      gross: t.gross + grossPay(r),
      repayment: t.repayment + r.debtRepayment,
      net: t.net + netPay(r),
    }),
    { salary: 0, overtime: 0, gross: 0, repayment: 0, net: 0 }
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-sm btn-ghost" aria-label="Previous month" onClick={() => goTo(shiftMonth(monthKey, -1))}>
          <ChevronLeft size={15} strokeWidth={1.75} />
        </button>
        <input
          className="input"
          type="month"
          aria-label="Payroll month"
          value={monthKey}
          onChange={(e) => goTo(e.target.value)}
          style={{ width: 170 }}
        />
        <button type="button" className="btn btn-sm btn-ghost" aria-label="Next month" onClick={() => goTo(shiftMonth(monthKey, 1))}>
          <ChevronRight size={15} strokeWidth={1.75} />
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="card" style={{ padding: 16, display: "grid", gap: 10, justifyItems: "start" }}>
          <h3 style={{ margin: 0 }}>{label}</h3>
          {activeCount === 0 ? (
            <p className="label" style={{ margin: 0 }}>Add employees in Settings first.</p>
          ) : (
            <>
              <p className="label" style={{ margin: 0 }}>
                No payroll for this month yet. Starting it adds a row for each of your {activeCount} active
                employee{activeCount === 1 ? "" : "s"}, using their current salary and overtime rates.
              </p>
              <button type="button" className="btn btn-sm btn-primary" disabled={pending} onClick={addEmployees}>
                {pending ? "Starting…" : `Start ${label} payroll`}
              </button>
            </>
          )}
          {error && <span className="login-error">{error}</span>}
        </div>
      ) : (
        <>
          {missingActive.length > 0 && (
            <div className="card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span className="label" style={{ margin: 0, textTransform: "none" }}>
                Not in {label}: {missingActive.join(", ")}
              </span>
              <button type="button" className="btn btn-sm" disabled={pending} onClick={addEmployees}>
                {pending ? "Adding…" : "Add to this month"}
              </button>
              {error && <span className="login-error">{error}</span>}
            </div>
          )}

          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Salary</th>
                  {OVERTIME_TYPES.map((t) => {
                    const m = sharedMultiplier(entries, t.multiplierKey);
                    return (
                      <th key={t.hoursKey} style={{ whiteSpace: "normal" }}>
                        {t.label} OT hrs{m !== null ? ` (×${m})` : ""}
                      </th>
                    );
                  })}
                  <th>OT Pay</th>
                  <th>Gross</th>
                  <th>Repayment</th>
                  <th>Debt Left</th>
                  <th>Net Pay</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    values={values[entry.id]}
                    monthLabel={label}
                    showMultipliers={OVERTIME_TYPES.some((t) => sharedMultiplier(entries, t.multiplierKey) === null)}
                    onChange={(next) => setValues((v) => ({ ...v, [entry.id]: next }))}
                  />
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td data-label="Totals">Totals ({entries.length})</td>
                  <td data-label="Salary" className="mono">{money(round2(totals.salary))}</td>
                  {OVERTIME_TYPES.map((t) => (
                    <td key={t.hoursKey}></td>
                  ))}
                  <td data-label="OT Pay" className="mono">{money(round2(totals.overtime))}</td>
                  <td data-label="Gross" className="mono">{money(round2(totals.gross))}</td>
                  <td data-label="Repayment" className="mono">{money(round2(totals.repayment))}</td>
                  <td></td>
                  <td data-label="Net Pay" className="mono" style={{ whiteSpace: "nowrap" }}>{money(round2(totals.net))} Br</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  values,
  monthLabel,
  showMultipliers,
  onChange,
}: {
  entry: PayrollEntryData;
  values: RowValues;
  monthLabel: string;
  showMultipliers: boolean;
  onChange: (next: RowValues) => void;
}) {
  const autosave = useAutosave((fd) => updatePayrollEntryAction(entry.id, fd));
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const row = asRow(entry, values);
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
    startRemove(async () => {
      const result = await removePayrollEntryAction(entry.id);
      if (result.error) setRemoveError(result.error);
    });
  }

  const input = (field: EditableField, labelText: string, width = 76) => (
    <input
      className="input"
      type="number"
      min="0"
      step="any"
      inputMode="decimal"
      aria-label={`${entry.employeeName} ${labelText}`}
      value={values[field]}
      onChange={(e) => edit(field, e.target.value)}
      style={{ width }}
    />
  );

  return (
    <tr>
      <td data-label="Employee" style={{ fontWeight: 600 }}>{entry.employeeName}</td>
      <td data-label="Salary">{input("salary", "salary", 96)}</td>
      {OVERTIME_TYPES.map((t) => (
        <td key={t.hoursKey} data-label={`${t.label} OT hrs (×${entry[t.multiplierKey]})`}>
          {input(t.hoursKey, `${t.label} overtime hours`, 64)}
          {showMultipliers && <div className="label" style={{ margin: "2px 0 0" }}>×{entry[t.multiplierKey]}</div>}
        </td>
      ))}
      <td data-label="OT Pay" className="mono">{money(overtimePay(row))}</td>
      <td data-label="Gross" className="mono">{money(grossPay(row))}</td>
      <td data-label="Repayment">
        {entry.owedBefore > 0 || row.debtRepayment > 0 ? input("debtRepayment", "debt repayment", 88) : <span className="label">No debt</span>}
      </td>
      <td data-label="Debt Left" className="mono">{entry.owedBefore > 0 || row.debtRepayment > 0 ? money(debtLeft) : "—"}</td>
      <td data-label="Net Pay" className="mono" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{money(netPay(row))} Br</td>
      <td>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <SaveStatusBadge status={autosave.status} error={autosave.error} />
          {removeError && <span className="login-error">{removeError}</span>}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-label={`Remove ${entry.employeeName} from this month`}
            title="Remove from this month"
            disabled={removing}
            onClick={remove}
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </td>
    </tr>
  );
}
