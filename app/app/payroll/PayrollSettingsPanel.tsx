"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { Plus, Trash2, X } from "lucide-react";
import { OVERTIME_TYPES, normalizePayTypes, type PayTypes, type PayrollRates } from "@/lib/payroll/calc";
import { ETHIOPIAN_MONTH_NAMES, ethiopianToday } from "@/lib/payroll/ethiopian";
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
import { money } from "./MonthlyPayroll";

export interface EmployeeRowData extends PayTypes {
  id: string;
  name: string;
  salary: number;
  active: boolean;
  borrowed: number;
  repaid: number;
  owed: number;
}

export interface DebtData {
  id: string;
  employeeName: string;
  amount: number;
  dateLabel: string;
  note: string | null;
  createdBy: string;
}

export interface RepaymentData {
  id: string;
  employeeName: string;
  monthLabel: string;
  monthKey: string;
  amount: number;
}

const initialState: PayrollActionState = { error: null };

const PAY_TYPES: [keyof PayTypes, string][] = [
  ["paySalary", "Salary"],
  ["payOvertime", "Overtime"],
  ["payCommission", "Commission"],
];

function useResettingForm(action: (prev: PayrollActionState, fd: FormData) => Promise<PayrollActionState>) {
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state !== initialState && state.error === null) formRef.current?.reset();
  }, [state]);
  return { state, formAction, formRef };
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span className="pr-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
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
    <div className="pr-stack">
      <EmployeesSection employees={employees} />
      <RatesSection rates={rates} />
      <DebtsSection employees={employees} debts={debts} repayments={repayments} />
    </div>
  );
}

// -----------------------------------------------------------------------
// Employees
// -----------------------------------------------------------------------

function EmployeesSection({ employees }: { employees: EmployeeRowData[] }) {
  const { state, formAction, formRef } = useResettingForm(createPayrollEmployeeAction);
  const [showForm, setShowForm] = useState(employees.length === 0);

  return (
    <div className="pr-section">
      <div className="pr-section-head">
        <h3>Employees</h3>
        <span className="pr-count">{employees.filter((e) => e.active).length} active</span>
        <button type="button" className="btn btn-sm pr-btn-soft" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X size={15} strokeWidth={2.25} /> : <Plus size={15} strokeWidth={2.25} />}
          {showForm ? "Close" : "Add employee"}
        </button>
      </div>

      {showForm && (
        <form ref={formRef} action={formAction} className="pr-form">
          <div>
            <label className="pr-k" htmlFor="newEmployeeName">
              Name
            </label>
            <input className="input" id="newEmployeeName" name="name" required />
          </div>
          <div>
            <label className="pr-k" htmlFor="newEmployeeSalary">
              Monthly salary (Br)
            </label>
            <input
              className="input"
              id="newEmployeeSalary"
              name="salary"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span className="pr-k">Gets paid</span>
            <div className="pr-pills" style={{ marginTop: 4 }}>
              {PAY_TYPES.map(([key, text]) => (
                <label key={key} className="pr-toggle" style={{ color: "var(--text)" }}>
                  <input type="checkbox" name={key} defaultChecked={key !== "payCommission"} />
                  {text}
                </label>
              ))}
            </div>
          </div>
          <SubmitButton label="Add Employee" pendingLabel="Adding…" className="btn btn-primary" />
          {state.error && (
            <span className="login-error" style={{ gridColumn: "1 / -1" }}>
              {state.error}
            </span>
          )}
        </form>
      )}

      {employees.length === 0 ? (
        <p className="pr-empty">No employees yet.</p>
      ) : (
        <div className="pr-list">
          {employees.map((e) => (
            <EmployeeRow key={e.id} employee={e} />
          ))}
        </div>
      )}
      <p className="pr-sub" style={{ margin: 0, whiteSpace: "normal" }}>
        Salary and pay-type changes here apply to months you start from now on. To change a month that&apos;s already
        started, edit it on that month&apos;s card. Overtime needs Salary, since it&apos;s calculated from it.
      </p>
    </div>
  );
}

function EmployeeRow({ employee }: { employee: EmployeeRowData }) {
  const [name, setName] = useState(employee.name);
  const [salary, setSalary] = useState(String(employee.salary));
  const [active, setActive] = useState(employee.active);
  const [types, setTypes] = useState<PayTypes>({
    paySalary: employee.paySalary,
    payOvertime: employee.payOvertime,
    payCommission: employee.payCommission,
  });
  const [typeError, setTypeError] = useState<string | null>(null);
  const autosave = useAutosave((fd) => updatePayrollEmployeeAction(employee.id, fd));
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function build(next: { name: string; salary: string; active: boolean; types: PayTypes }) {
    const fd = new FormData();
    fd.set("name", next.name);
    fd.set("salary", next.salary);
    if (next.active) fd.set("active", "on");
    PAY_TYPES.forEach(([key]) => {
      if (next.types[key]) fd.set(key, "on");
    });
    return fd;
  }

  function switchType(key: keyof PayTypes) {
    const next = normalizePayTypes({ ...types, [key]: !types[key] });
    if (!next.paySalary && !next.payCommission) {
      setTypeError("Keep Salary or Commission on.");
      return;
    }
    setTypeError(null);
    setTypes(next);
    autosave.saveNow(() => build({ name, salary, active, types: next }));
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
    <div className="pr-row pr-emp" style={active ? undefined : { opacity: 0.55 }} data-employee-row={employee.name}>
      <Avatar name={name} />
      <div className="pr-emp-main">
        <input
          className="input"
          aria-label="Employee name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            autosave.schedule(() => build({ name: e.target.value, salary, active, types }));
          }}
          style={{ flex: "1 1 180px", width: "auto" }}
        />
        {types.paySalary && (
          <input
            className="input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            aria-label={`${employee.name} monthly salary`}
            value={salary}
            onChange={(e) => {
              setSalary(e.target.value);
              autosave.schedule(() => build({ name, salary: e.target.value, active, types }));
            }}
            style={{ flex: "0 1 120px", width: 120 }}
          />
        )}
        <label className="pr-toggle">
          <input
            type="checkbox"
            aria-label={`${employee.name} active`}
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked);
              autosave.saveNow(() => build({ name, salary, active: e.target.checked, types }));
            }}
          />
          Active
        </label>
        <div className="pr-pills" role="group" aria-label={`${employee.name} pay types`} style={{ flexBasis: "100%" }}>
          {PAY_TYPES.map(([key, text]) => {
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
          {employee.owed > 0 && (
            <span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
              Owes {money(employee.owed)}
            </span>
          )}
        </div>
        <SaveStatusBadge status={autosave.status} error={autosave.error} />
        {typeError && <span className="login-error">{typeError}</span>}
        {deleteError && <span className="login-error">{deleteError}</span>}
      </div>
      <button
        type="button"
        className="btn btn-sm btn-ghost pr-icon-btn"
        aria-label={`Delete ${employee.name}`}
        title="Delete"
        disabled={deleting}
        onClick={remove}
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------
// Overtime rates
// -----------------------------------------------------------------------

function RatesSection({ rates }: { rates: PayrollRates }) {
  const [state, formAction] = useFormState(savePayrollSettingsAction, initialState);
  const saved = state !== initialState && state.error === null;

  return (
    <div className="pr-section">
      <div className="pr-section-head">
        <h3>Overtime Rates</h3>
      </div>
      <form
        action={formAction}
        className="pr-form"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}
      >
        <div>
          <label className="pr-k" htmlFor="hoursPerMonth">
            Hours / month
          </label>
          <input
            className="input"
            id="hoursPerMonth"
            name="hoursPerMonth"
            type="number"
            min="0"
            step="any"
            defaultValue={rates.hoursPerMonth}
            required
          />
        </div>
        {OVERTIME_TYPES.map((t) => (
          <div key={t.multiplierKey}>
            <label className="pr-k" htmlFor={t.multiplierKey}>
              {t.label} (×)
            </label>
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SubmitButton label="Save Rates" pendingLabel="Saving…" className="btn btn-primary" />
          {saved && <span className="pr-sub">Saved</span>}
        </div>
        {state.error && (
          <span className="login-error" style={{ gridColumn: "1 / -1" }}>
            {state.error}
          </span>
        )}
      </form>
      <p className="pr-sub" style={{ margin: 0, whiteSpace: "normal" }}>
        Hourly wage = salary ÷ hours per month. Overtime pay = hours × hourly wage × multiplier. For example, 10,400 ÷
        208 = 50 Br/hr, so 1 night hour at ×1.75 pays 87.50 Br. Changes apply to months you start from now on.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------
// Debts and repayments
// -----------------------------------------------------------------------

function EthiopianDateFields() {
  const today = ethiopianToday();
  const years = [today.year - 1, today.year, today.year + 1];
  return (
    <div style={{ gridColumn: "span 1" }}>
      <span className="pr-k">Date</span>
      <div style={{ display: "flex", gap: 4 }}>
        <select
          className="input"
          name="dateDay"
          aria-label="Day"
          defaultValue={today.day}
          style={{ flex: "0 0 62px", paddingRight: 2 }}
        >
          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="input"
          name="dateMonth"
          aria-label="Month"
          defaultValue={today.month}
          style={{ flex: 1, minWidth: 0 }}
        >
          {ETHIOPIAN_MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="input"
          name="dateYear"
          aria-label="Year"
          defaultValue={today.year}
          style={{ flex: "0 0 74px", paddingRight: 2 }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function DebtsSection({
  employees,
  debts,
  repayments,
}: {
  employees: EmployeeRowData[];
  debts: DebtData[];
  repayments: RepaymentData[];
}) {
  const { state, formAction, formRef } = useResettingForm(addPayrollDebtAction);
  const [showForm, setShowForm] = useState(false);
  const withDebt = employees.filter((e) => e.borrowed > 0);
  const [view, setView] = useState<"balances" | "debts" | "repayments">("balances");

  return (
    <div className="pr-section">
      <div className="pr-section-head">
        <h3>Debts</h3>
        <span className="pr-count">{money(withDebt.reduce((s, e) => s + e.owed, 0))} Br owed</span>
        <button
          type="button"
          className="btn btn-sm pr-btn-soft"
          onClick={() => setShowForm((v) => !v)}
          disabled={employees.length === 0}
        >
          {showForm ? <X size={15} strokeWidth={2.25} /> : <Plus size={15} strokeWidth={2.25} />}
          {showForm ? "Close" : "Add debt"}
        </button>
      </div>
      <p className="pr-sub" style={{ margin: 0, whiteSpace: "normal" }}>
        Record an advance or loan here. It&apos;s paid back by typing a repayment on a month&apos;s payroll card.
      </p>

      {showForm && (
        <form ref={formRef} action={formAction} className="pr-form">
          <div>
            <label className="pr-k" htmlFor="debtEmployee">
              Employee
            </label>
            <select className="input" id="debtEmployee" name="employeeId" required defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="pr-k" htmlFor="debtAmount">
              Amount (Br)
            </label>
            <input
              className="input"
              id="debtAmount"
              name="amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              required
            />
          </div>
          <EthiopianDateFields />
          <div>
            <label className="pr-k" htmlFor="debtNote">
              Note
            </label>
            <input className="input" id="debtNote" name="note" placeholder="e.g. Salary advance" />
          </div>
          <SubmitButton label="Add Debt" pendingLabel="Adding…" className="btn btn-primary" />
          {state.error && (
            <span className="login-error" style={{ gridColumn: "1 / -1" }}>
              {state.error}
            </span>
          )}
        </form>
      )}

      <div className="pr-segmented" style={{ justifySelf: "start" }}>
        {(
          [
            ["balances", "Balances"],
            ["debts", `Debts (${debts.length})`],
            ["repayments", `Repayments (${repayments.length})`],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            type="button"
            className={`pr-seg${view === key ? " active" : ""}`}
            style={{
              border: 0,
              cursor: "pointer",
              padding: "6px 10px",
              fontSize: 12,
            }}
            onClick={() => setView(key)}
          >
            {text}
          </button>
        ))}
      </div>

      {view === "balances" &&
        (withDebt.length === 0 ? (
          <p className="pr-empty">Nobody owes anything.</p>
        ) : (
          <div className="pr-list">
            {withDebt.map((e) => (
              <div key={e.id} className="pr-row" data-balance={e.name}>
                <Avatar name={e.name} />
                <span className="pr-who">
                  <div className="pr-name" style={{ fontSize: 13.5 }}>
                    {e.name}
                  </div>
                  <div className="pr-sub">
                    Borrowed {money(e.borrowed)} · Repaid {money(e.repaid)}
                  </div>
                </span>
                <span>
                  <div className="pr-k">Still owes</div>
                  <div className="pr-v">{money(e.owed)} Br</div>
                </span>
              </div>
            ))}
          </div>
        ))}

      {view === "debts" &&
        (debts.length === 0 ? (
          <p className="pr-empty">No debts recorded.</p>
        ) : (
          <div className="pr-list">
            {debts.map((d) => (
              <DebtRow key={d.id} debt={d} />
            ))}
          </div>
        ))}

      {view === "repayments" &&
        (repayments.length === 0 ? (
          <p className="pr-empty">No repayments yet.</p>
        ) : (
          <div className="pr-list">
            {repayments.map((r) => (
              <div key={r.id} className="pr-row">
                <Avatar name={r.employeeName} />
                <span className="pr-who">
                  <div className="pr-name" style={{ fontSize: 13.5 }}>
                    {r.employeeName}
                  </div>
                  <a className="pr-sub" href={`/payroll?month=${r.monthKey}`} style={{ textDecoration: "underline" }}>
                    {r.monthLabel}
                  </a>
                </span>
                <span className="pr-v">{money(r.amount)} Br</span>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function DebtRow({ debt }: { debt: DebtData }) {
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`Delete this ${money(debt.amount)} Br debt for ${debt.employeeName}?`)) return;
    setError(null);
    startDelete(async () => {
      const result = await deletePayrollDebtAction(debt.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="pr-row" data-debt={debt.note ?? ""}>
      <Avatar name={debt.employeeName} />
      <span className="pr-who">
        <div className="pr-name" style={{ fontSize: 13.5 }}>
          {debt.employeeName}
        </div>
        <div className="pr-sub">
          {debt.dateLabel}
          {debt.note ? ` · ${debt.note}` : ""} · by {debt.createdBy}
        </div>
      </span>
      <span className="pr-v">{money(debt.amount)} Br</span>
      {error && <span className="login-error">{error}</span>}
      <button
        type="button"
        className="btn btn-sm btn-ghost pr-icon-btn"
        aria-label={`Delete debt for ${debt.employeeName}`}
        title="Delete"
        disabled={deleting}
        onClick={remove}
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}
