"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Trash2 } from "lucide-react";
import { OVERTIME_TYPES, type PayrollRates } from "@/lib/payroll/calc";
import { parsePayrollMonth, payrollMonthLabel } from "@/lib/payroll/month";
import {
  addPayrollDebtAction,
  createPayrollEmployeeAction,
  deletePayrollDebtAction,
  deletePayrollEmployeeAction,
  savePayrollSettingsAction,
  updatePayrollEmployeeAction,
  type PayrollActionState,
} from "./actions";
import { SubmitButton } from "../SubmitButton";
import { useAutosave } from "../useAutosave";
import { SaveStatusBadge } from "../SaveStatusBadge";

interface EmployeeRowData {
  id: string;
  name: string;
  salary: number;
  active: boolean;
  borrowed: number;
  repaid: number;
  owed: number;
}

interface DebtData {
  id: string;
  employeeName: string;
  amount: number;
  date: string;
  note: string | null;
  createdBy: string;
}

interface RepaymentData {
  id: string;
  employeeName: string;
  monthKey: string;
  amount: number;
}

const initialState: PayrollActionState = { error: null };

function money(n: number): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} Br`;
}

/** Resets its form after each successful submit. */
function useResettingForm(action: (prev: PayrollActionState, fd: FormData) => Promise<PayrollActionState>) {
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state !== initialState && state.error === null) formRef.current?.reset();
  }, [state]);
  return { state, formAction, formRef };
}

export function PayrollSettingsPanel({
  employees,
  rates,
  debts,
  repayments,
}: {
  employees: EmployeeRowData[];
  rates: PayrollRates;
  debts: DebtData[];
  repayments: RepaymentData[];
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <EmployeesCard employees={employees} />
      <RatesCard rates={rates} />
      <DebtsCard employees={employees} debts={debts} repayments={repayments} />
    </div>
  );
}

// -----------------------------------------------------------------------
// Employees
// -----------------------------------------------------------------------

function EmployeesCard({ employees }: { employees: EmployeeRowData[] }) {
  const { state, formAction, formRef } = useResettingForm(createPayrollEmployeeAction);

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div>
        <h3 style={{ margin: 0 }}>Employees</h3>
        <p className="label" style={{ marginTop: 4, marginBottom: 0, textTransform: "none" }}>
          A salary change here applies to months you start from now on. To change a month that&apos;s already
          started, edit the salary in that month&apos;s row.
        </p>
      </div>

      <form ref={formRef} action={formAction} style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 180px" }}>
          <label className="label" htmlFor="newEmployeeName">Name</label>
          <input className="input" id="newEmployeeName" name="name" required />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label className="label" htmlFor="newEmployeeSalary">Monthly Salary (Br)</label>
          <input className="input" id="newEmployeeSalary" name="salary" type="number" min="0" step="any" required />
        </div>
        <SubmitButton label="Add Employee" pendingLabel="Adding…" className="btn btn-sm btn-primary" />
        {state.error && <span className="login-error">{state.error}</span>}
      </form>

      {employees.length === 0 ? (
        <p className="label" style={{ margin: 0 }}>No employees yet.</p>
      ) : (
        <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Monthly Salary</th>
                <th>Active</th>
                <th>Owes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <EmployeeRow key={e.id} employee={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmployeeRow({ employee }: { employee: EmployeeRowData }) {
  const [name, setName] = useState(employee.name);
  const [salary, setSalary] = useState(String(employee.salary));
  const [active, setActive] = useState(employee.active);
  const autosave = useAutosave((fd) => updatePayrollEmployeeAction(employee.id, fd));
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function build(next: { name: string; salary: string; active: boolean }) {
    const fd = new FormData();
    fd.set("name", next.name);
    fd.set("salary", next.salary);
    if (next.active) fd.set("active", "on");
    return fd;
  }

  function remove() {
    if (!confirm(`Delete ${employee.name}?`)) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deletePayrollEmployeeAction(employee.id);
      if (result.error) setDeleteError(result.error);
    });
  }

  return (
    <tr style={active ? undefined : { opacity: 0.6 }}>
      <td data-label="Name">
        <input
          className="input"
          aria-label="Employee name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            autosave.schedule(() => build({ name: e.target.value, salary, active }));
          }}
        />
      </td>
      <td data-label="Monthly Salary">
        <input
          className="input"
          type="number"
          min="0"
          step="any"
          aria-label={`${employee.name} monthly salary`}
          value={salary}
          onChange={(e) => {
            setSalary(e.target.value);
            autosave.schedule(() => build({ name, salary: e.target.value, active }));
          }}
          style={{ width: 130 }}
        />
      </td>
      <td data-label="Active">
        <input
          type="checkbox"
          aria-label={`${employee.name} active`}
          checked={active}
          onChange={(e) => {
            setActive(e.target.checked);
            autosave.saveNow(() => build({ name, salary, active: e.target.checked }));
          }}
          style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
        />
      </td>
      <td data-label="Owes" className="mono">{employee.owed > 0 ? money(employee.owed) : "—"}</td>
      <td>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <SaveStatusBadge status={autosave.status} error={autosave.error} />
          {deleteError && <span className="login-error">{deleteError}</span>}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-label={`Delete ${employee.name}`}
            title="Delete"
            disabled={deleting}
            onClick={remove}
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// -----------------------------------------------------------------------
// Overtime rates
// -----------------------------------------------------------------------

function RatesCard({ rates }: { rates: PayrollRates }) {
  const [state, formAction] = useFormState(savePayrollSettingsAction, initialState);
  const saved = state !== initialState && state.error === null;

  return (
    <form action={formAction} className="card" style={{ padding: 16, display: "grid", gap: 12, maxWidth: 620 }}>
      <div>
        <h3 style={{ margin: 0 }}>Overtime Rates</h3>
        <p className="label" style={{ marginTop: 4, marginBottom: 0, textTransform: "none" }}>
          Hourly wage = monthly salary ÷ working hours per month. Overtime pay = hours × hourly wage × multiplier.
          For example, 10,400 Br ÷ 208 = 50 Br/hr, so 1 hour at ×1.75 pays 87.50 Br. Changes apply to months you
          start from now on.
        </p>
      </div>

      <div className="form-field" style={{ maxWidth: 220 }}>
        <label className="label" htmlFor="hoursPerMonth">Working Hours per Month</label>
        <input className="input" id="hoursPerMonth" name="hoursPerMonth" type="number" min="0" step="any" defaultValue={rates.hoursPerMonth} required />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {OVERTIME_TYPES.map((t) => (
          <div key={t.multiplierKey} style={{ flex: "1 1 120px" }}>
            <label className="label" htmlFor={t.multiplierKey}>{t.label} (×)</label>
            <input
              className="input"
              id={t.multiplierKey}
              name={t.multiplierKey}
              type="number"
              min="0"
              step="any"
              defaultValue={rates[t.multiplierKey]}
              required
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <SubmitButton label="Save Rates" pendingLabel="Saving…" className="btn btn-sm btn-primary" />
        {state.error && <span className="login-error">{state.error}</span>}
        {saved && <span className="label" style={{ margin: 0, textTransform: "none" }}>Saved</span>}
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------
// Debts and repayments
// -----------------------------------------------------------------------

function DebtsCard({
  employees,
  debts,
  repayments,
}: {
  employees: EmployeeRowData[];
  debts: DebtData[];
  repayments: RepaymentData[];
}) {
  const { state, formAction, formRef } = useResettingForm(addPayrollDebtAction);
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const withDebt = employees.filter((e) => e.borrowed > 0);

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
      <div>
        <h3 style={{ margin: 0 }}>Debts</h3>
        <p className="label" style={{ marginTop: 4, marginBottom: 0, textTransform: "none" }}>
          Record an advance or loan here. It&apos;s paid back by typing a repayment into a month&apos;s payroll.
        </p>
      </div>

      {employees.length === 0 ? (
        <p className="label" style={{ margin: 0 }}>Add an employee first.</p>
      ) : (
        <form ref={formRef} action={formAction} style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ flex: "2 1 170px" }}>
            <label className="label" htmlFor="debtEmployee">Employee</label>
            <select className="input" id="debtEmployee" name="employeeId" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}{e.active ? "" : " (inactive)"}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label className="label" htmlFor="debtAmount">Amount (Br)</label>
            <input className="input" id="debtAmount" name="amount" type="number" min="0" step="any" required />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label className="label" htmlFor="debtDate">Date</label>
            <input className="input" id="debtDate" name="date" type="date" defaultValue={today} required />
          </div>
          <div style={{ flex: "2 1 180px" }}>
            <label className="label" htmlFor="debtNote">Note</label>
            <input className="input" id="debtNote" name="note" placeholder="e.g. Salary advance" />
          </div>
          <SubmitButton label="Add Debt" pendingLabel="Adding…" className="btn btn-sm btn-primary" />
          {state.error && <span className="login-error">{state.error}</span>}
        </form>
      )}

      {withDebt.length > 0 && (
        <div>
          <h4 style={{ margin: "0 0 6px" }}>Balances</h4>
          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr><th>Employee</th><th>Borrowed</th><th>Repaid</th><th>Still Owes</th></tr>
              </thead>
              <tbody>
                {withDebt.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Employee">{e.name}</td>
                    <td data-label="Borrowed" className="mono">{money(e.borrowed)}</td>
                    <td data-label="Repaid" className="mono">{money(e.repaid)}</td>
                    <td data-label="Still Owes" className="mono" style={{ fontWeight: 700 }}>{money(e.owed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {debts.length > 0 && (
        <div>
          <h4 style={{ margin: "0 0 6px" }}>Debts Recorded</h4>
          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr><th>Date</th><th>Employee</th><th>Amount</th><th>Note</th><th>Added By</th><th></th></tr>
              </thead>
              <tbody>
                {debts.map((d) => (
                  <DebtRow key={d.id} debt={d} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {repayments.length > 0 && (
        <div>
          <h4 style={{ margin: "0 0 6px" }}>Repayments</h4>
          <div className="dtable-wrap">
            <table className="dtable">
              <thead>
                <tr><th>Month</th><th>Employee</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {repayments.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Month">
                      <a href={`/payroll?month=${r.monthKey}`}>{payrollMonthLabel(parsePayrollMonth(r.monthKey)!)}</a>
                    </td>
                    <td data-label="Employee">{r.employeeName}</td>
                    <td data-label="Amount" className="mono">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DebtRow({ debt }: { debt: DebtData }) {
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Delete this ${money(debt.amount)} debt for ${debt.employeeName}?`)) return;
    setError(null);
    startDelete(async () => {
      const result = await deletePayrollDebtAction(debt.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <tr>
      <td data-label="Date">{debt.date}</td>
      <td data-label="Employee">{debt.employeeName}</td>
      <td data-label="Amount" className="mono">{money(debt.amount)}</td>
      <td data-label="Note">{debt.note || "—"}</td>
      <td data-label="Added By">{debt.createdBy}</td>
      <td>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {error && <span className="login-error">{error}</span>}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-label={`Delete debt for ${debt.employeeName}`}
            title="Delete"
            disabled={deleting}
            onClick={remove}
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </td>
    </tr>
  );
}
