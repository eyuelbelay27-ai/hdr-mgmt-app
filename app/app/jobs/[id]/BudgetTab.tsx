import { can, type PermissionSubject } from "@/lib/permissions";
import { totalAllocatedCash } from "@/lib/calc/budget";
import { pullFromCostEstimateAction, undoBudgetApprovalAction } from "./budgetActions";
import { BudgetItemRow } from "./BudgetItemRow";
import { AddBudgetItemForm } from "./AddBudgetItemForm";
import { ApproveBudgetControl } from "./ApproveBudgetControl";

interface BudgetJob {
  id: string;
  status: string;
  budgetStatus: string;
  budgetApprovedBy: string | null;
  budgetApprovedAt: Date | null;
  adminUnlocked: boolean;
  budgetItems: {
    id: string;
    label: string;
    category: string;
    amount: unknown;
    qty: unknown;
    unit: string | null;
    comment: string | null;
    source: string;
  }[];
}

export function BudgetTab({ job, user }: { job: BudgetJob; user: PermissionSubject }) {
  const editable = job.budgetStatus === "Draft" && job.status !== "Closed" && job.status !== "Cancelled" && can(user, "manageBudget");
  const totalCash = totalAllocatedCash(job.budgetItems);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="label">Total Allocated (Cash)</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{totalCash.toLocaleString()} Br</div>
        </div>
        {job.status === "WaitingForApproval" && job.budgetStatus === "Draft" && can(user, "approveBudget") && (
          <ApproveBudgetControl jobId={job.id} />
        )}
        {job.budgetStatus === "Approved" && job.adminUnlocked && can(user, "approveBudget") && (
          <form action={undoBudgetApprovalAction.bind(null, job.id)}>
            <button className="btn btn-sm btn-danger" type="submit">Undo Approval</button>
          </form>
        )}
      </div>

      {job.budgetStatus === "Approved" && (
        <p className="label">
          Approved by {job.budgetApprovedBy} on {job.budgetApprovedAt?.toISOString().slice(0, 10)}.
        </p>
      )}

      {editable && (
        <form action={pullFromCostEstimateAction.bind(null, job.id)}>
          <button className="btn btn-sm" type="submit">Pull From Cost Estimate</button>
        </form>
      )}

      <div className="card dtable-wrap">
      <table className="dtable">
        <thead>
          <tr>
            <th>Description</th>
            <th>Category</th>
            <th>Amount / Qty+Unit</th>
            <th>Comment</th>
            <th>{editable ? "" : "Source"}</th>
          </tr>
        </thead>
        <tbody>
          {job.budgetItems.map((item) => (
            <BudgetItemRow key={item.id} item={item} jobId={job.id} editable={editable} />
          ))}
          {job.budgetItems.length === 0 && (
            <tr>
              <td className="label" colSpan={5}>No budget lines yet.</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {editable && <AddBudgetItemForm jobId={job.id} />}
    </div>
  );
}
