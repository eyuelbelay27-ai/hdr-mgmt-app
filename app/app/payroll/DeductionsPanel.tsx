"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Plus, Trash2, X } from "lucide-react";
import { PAYROLL_MONTH_NAMES, parsePayrollMonth, payrollMonthLabel } from "@/lib/payroll/month";
import { round2 } from "@/lib/money";
import { addPayrollDeductionAction, deletePayrollDeductionAction, type PayrollActionState } from "./actions";
import { MonthSwitcher } from "./MonthSwitcher";
import { SubmitButton } from "../SubmitButton";
import { money } from "./MonthlyPayroll";

export interface DeductionData {
  id: string;
  employeeName: string;
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

const initialState: PayrollActionState = { error: null };

export function DeductionsPanel({
  monthKey,
  deductions,
  employees,
}: {
  monthKey: string;
  deductions: DeductionData[];
  employees: { id: string; name: string; active: boolean }[];
}) {
  const [state, formAction] = useFormState(addPayrollDeductionAction, initialState);
  const [showForm, setShowForm] = useState(deductions.length === 0);
  const formRef = useRef<HTMLFormElement>(null);
  const month = parsePayrollMonth(monthKey)!;
  const label = payrollMonthLabel(month);
  const total = round2(deductions.reduce((s, d) => s + d.amount, 0));

  useEffect(() => {
    if (state !== initialState && state.error === null) formRef.current?.reset();
  }, [state]);

  return (
    <div className="pr-stack">
      <MonthSwitcher monthKey={monthKey} tab="deductions" />

      <div className="pr-section">
        <div className="pr-section-head">
          <h3>Deductions · {label}</h3>
          <span className="pr-count">{deductions.length}</span>
          <button type="button" className="btn btn-sm pr-btn-soft" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={15} strokeWidth={2.25} /> : <Plus size={15} strokeWidth={2.25} />}
            {showForm ? "Close" : "Add deduction"}
          </button>
        </div>
        <p className="pr-sub" style={{ margin: 0, whiteSpace: "normal" }}>
          Penalties and other deductions are subtracted from the employee&apos;s net pay for the month you pick.
        </p>

        {showForm &&
          (employees.length === 0 ? (
            <p className="pr-empty">Add employees in Settings first.</p>
          ) : (
            <form ref={formRef} action={formAction} className="pr-form">
              <div>
                <label className="pr-k" htmlFor="deductionEmployee">Employee</label>
                <select className="input" id="deductionEmployee" name="employeeId" required defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}{e.active ? "" : " (inactive)"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="pr-k" htmlFor="deductionMonth">Month</label>
                <select className="input" id="deductionMonth" name="month" defaultValue={monthKey} key={monthKey}>
                  {[month.year - 1, month.year, month.year + 1].flatMap((y) =>
                    PAYROLL_MONTH_NAMES.map((name, i) => {
                      const key = `${y}-${String(i + 1).padStart(2, "0")}`;
                      return <option key={key} value={key}>{name} {y}</option>;
                    })
                  )}
                </select>
              </div>
              <div>
                <label className="pr-k" htmlFor="deductionAmount">Amount (Br)</label>
                <input className="input" id="deductionAmount" name="amount" type="number" min="0" step="any" inputMode="decimal" required />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="pr-k" htmlFor="deductionReason">Reason</label>
                <input className="input" id="deductionReason" name="reason" placeholder="e.g. Late arrival penalty" required />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <SubmitButton label="Add" pendingLabel="Adding…" className="btn btn-primary" />
              </div>
              {state.error && <span className="login-error" style={{ gridColumn: "1 / -1" }}>{state.error}</span>}
            </form>
          ))}

        {deductions.length === 0 ? (
          <p className="pr-empty">No deductions for {label}.</p>
        ) : (
          <div className="pr-list">
            {deductions.map((d) => (
              <DeductionRow key={d.id} deduction={d} />
            ))}
            <div className="pr-row" style={{ fontWeight: 700 }}>
              <span style={{ flex: 1 }}>Total</span>
              <span className="pr-v negative">−{money(total)} Br</span>
              <span style={{ width: 34 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeductionRow({ deduction }: { deduction: DeductionData }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Delete this ${money(deduction.amount)} Br deduction for ${deduction.employeeName}?`)) return;
    setError(null);
    start(async () => {
      const result = await deletePayrollDeductionAction(deduction.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="pr-row" data-deduction={deduction.reason}>
      <span className="pr-avatar" style={{ width: 32, height: 32, fontSize: 14 }}>
        {deduction.employeeName.trim().charAt(0).toUpperCase() || "?"}
      </span>
      <span className="pr-who">
        <div className="pr-name" style={{ fontSize: 13.5 }}>{deduction.employeeName}</div>
        <div className="pr-sub">{deduction.reason} · by {deduction.createdBy}</div>
      </span>
      <span className="pr-v negative">−{money(deduction.amount)}</span>
      {error && <span className="login-error">{error}</span>}
      <button
        type="button"
        className="btn btn-sm btn-ghost pr-icon-btn"
        aria-label={`Delete deduction for ${deduction.employeeName}`}
        title="Delete"
        disabled={busy}
        onClick={remove}
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}
