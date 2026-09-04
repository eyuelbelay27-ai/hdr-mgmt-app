import { Role } from "@prisma/client";

/**
 * Permission system — Section 5 of the handoff brief.
 *
 * Three independent dimensions:
 *   - Pages   (PAGE_KEYS): top-level nav visibility, one checkbox each.
 *   - Actions (ACTION_KEYS): paired View/Edit checkboxes gating specific
 *     buttons/forms, not whole pages or tabs. Edit auto-grants View.
 *   - Tabs    (TAB_KEYS): single View checkbox gating a whole tab/section
 *     (Job Detail tabs AND Dashboard items), no edit pairing.
 *
 * `role` ONLY seeds the initial permission maps at user-creation time
 * (buildPermSet below). Every other permission check in the app must read
 * the user's actual stored actions/actionViews/pages/tabs — never branch
 * on `role` directly. Admin is the only role allowed a blanket "all true"
 * default; every other role's defaults are assembled explicitly.
 */

export const ACTION_KEYS = [
  { key: "createJob", label: "Create new jobs" },
  { key: "manageDraftJobs", label: "See and edit draft jobs" },
  { key: "editDesign", label: "Edit design spec & components" },
  { key: "editCutList", label: "Edit cut list (file uploads)" },
  { key: "manageCostEstimate", label: "Fill Cost Estimate quantities (Cash/Stock sheet)" },
  { key: "addCostEstimateItem", label: "Add ad-hoc items to Cost Estimate" },
  { key: "manageSalePriceProfit", label: "View & edit the Sale Price & Profit card" },
  { key: "manageCostEstimateNotes", label: "Edit Cost Estimate notes" },
  { key: "submitForApproval", label: "Submit a Draft job for approval" },
  { key: "approveBudget", label: "Approve a submitted budget" },
  { key: "manageBudget", label: "Edit budget line items" },
  { key: "editApprovedJob", label: "Unlock an approved job's content for editing" },
  { key: "submitForReconciliation", label: "Submit an approved-budget job for reconciliation" },
  { key: "manageExpenses", label: "Log purchases/receipts in Expenses" },
  { key: "managePayments", label: "Record payments" },
  { key: "reconcileBudget", label: "Mark a job Reconciled / Flagged / Pending" },
  { key: "closeJob", label: "Close a job" },
  { key: "reopenJob", label: "Reopen a closed job" },
  { key: "cancelJob", label: "Cancel a job" },
  { key: "deleteJob", label: "Delete a job completely (irreversible)" },
  { key: "manageSignagePrices", label: "Edit the Price Database" },
  { key: "manageInventory", label: "Record manual Stock In/Out" },
  { key: "submitPurchaseOrder", label: "Issue a Purchase Order" },
  { key: "approvePurchaseOrder", label: "Approve/reject a Purchase Order" },
  { key: "revertPurchaseOrderApproval", label: "Undo an approved Purchase Order" },
  { key: "uploadPurchaseOrderReceipt", label: "Upload a Purchase Order's receipt" },
  { key: "auditPurchaseOrder", label: "Mark a Purchase Order Audited" },
  { key: "manageUsers", label: "Manage users & permissions" },
] as const;

export type ActionKey = (typeof ACTION_KEYS)[number]["key"];

export const PAGE_KEYS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "jobs", label: "Jobs" },
  { key: "calculator", label: "Price Database" },
  { key: "inventory", label: "Inventory" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "users", label: "Users" },
  { key: "settings", label: "Settings" },
] as const;

export type PageKey = (typeof PAGE_KEYS)[number]["key"];

export const TAB_KEYS = [
  { key: "tab_overview", label: "Overview Tab" },
  { key: "tab_design", label: "Design Tab" },
  { key: "tab_cutlist", label: "Cut List Tab" },
  { key: "tab_cost", label: "Cost Estimate Tab" },
  { key: "tab_budget", label: "Budget Tab" },
  { key: "tab_expenses", label: "Expenses Tab" },
  { key: "tab_payments", label: "Payments & Profit Tab" },
  { key: "tab_activity", label: "Activity Tab" },
  { key: "dash_draft", label: "Dashboard: Draft" },
  { key: "dash_approval", label: "Dashboard: Waiting for Approval" },
  { key: "dash_budget", label: "Dashboard: Approved Budget" },
  { key: "dash_reconciliation", label: "Dashboard: Waiting for Reconciliation" },
  { key: "dash_remaining", label: "Dashboard: Remaining Payments" },
  { key: "dash_purchaseOrders", label: "Dashboard: Purchase Orders" },
] as const;

export type TabKey = (typeof TAB_KEYS)[number]["key"];

/**
 * `requestRevision` (sending a submitted job back to Draft) is an implied
 * permission — it reuses whatever `approveBudget` is set to, since the
 * person reviewing a submission is the one positioned to reject it. There
 * is no separate stored permission for it.
 */
export const IMPLIED_ACTIONS: Record<string, ActionKey> = {
  requestRevision: "approveBudget",
};

export const DEFAULT_ACTIONS_BY_ROLE: Record<Role, ActionKey[]> = {
  Designer: ["editDesign", "editCutList"],
  Supervisor: [
    "editCutList",
    "manageExpenses",
    "submitForReconciliation",
    "submitPurchaseOrder",
  ],
  Manager: ["createJob", "manageDraftJobs", "submitForApproval"],
  OwnerFinance: [
    "createJob",
    "manageDraftJobs",
    "submitForApproval",
    "manageCostEstimate",
    "addCostEstimateItem",
    "manageSalePriceProfit",
    "manageCostEstimateNotes",
    "manageInventory",
  ],
  Admin: ACTION_KEYS.map((a) => a.key),
};

export const DEFAULT_PAGES_BY_ROLE: Record<Role, PageKey[]> = {
  Designer: ["dashboard", "jobs"],
  Supervisor: ["dashboard", "jobs"],
  Manager: ["dashboard", "jobs", "calculator"],
  OwnerFinance: ["dashboard", "jobs", "calculator", "inventory", "reconciliation"],
  Admin: ["dashboard", "jobs", "calculator", "inventory", "reconciliation", "users", "settings"],
};

export const DEFAULT_TABS_BY_ROLE: Record<Role, TabKey[]> = {
  Designer: [
    "tab_overview",
    "tab_design",
    "tab_cutlist",
    "tab_activity",
    "dash_approval",
    "dash_budget",
    "dash_reconciliation",
  ],
  Supervisor: [
    "tab_overview",
    "tab_design",
    "tab_cutlist",
    "tab_expenses",
    "tab_activity",
    "dash_approval",
    "dash_budget",
    "dash_reconciliation",
    "dash_purchaseOrders",
  ],
  Manager: [
    "tab_overview",
    "tab_design",
    "tab_cutlist",
    "tab_cost",
    "tab_activity",
    "dash_draft",
    "dash_approval",
    "dash_budget",
    "dash_reconciliation",
  ],
  OwnerFinance: [
    "tab_overview",
    "tab_design",
    "tab_cutlist",
    "tab_cost",
    "tab_activity",
    "dash_draft",
    "dash_approval",
    "dash_budget",
    "dash_reconciliation",
    "dash_remaining",
  ],
  // Payments & Profit tab is deliberately Admin-only, at every job phase,
  // for every other role — an explicit, repeated design decision.
  Admin: TAB_KEYS.map((t) => t.key),
};

export type PermissionMap = Record<string, boolean>;

export interface PermSet {
  actions: PermissionMap;
  actionViews: PermissionMap;
  pages: PermissionMap;
  tabs: PermissionMap;
}

/** Builds the initial permission maps assigned when a user is created. */
export function buildPermSet(role: Role): PermSet {
  const actions: PermissionMap = {};
  const actionViews: PermissionMap = {};
  ACTION_KEYS.forEach(({ key }) => {
    const on = DEFAULT_ACTIONS_BY_ROLE[role].includes(key);
    actions[key] = on;
    // Allow View defaults to match Allow Edit until an Admin customizes it.
    actionViews[key] = on;
  });

  const pages: PermissionMap = {};
  PAGE_KEYS.forEach(({ key }) => {
    pages[key] = DEFAULT_PAGES_BY_ROLE[role].includes(key);
  });

  const tabs: PermissionMap = {};
  TAB_KEYS.forEach(({ key }) => {
    tabs[key] = DEFAULT_TABS_BY_ROLE[role].includes(key);
  });

  return { actions, actionViews, pages, tabs };
}

/** Minimal shape needed to run permission checks — matches the User model. */
export interface PermissionSubject {
  actions: unknown;
  actionViews: unknown;
  pages: unknown;
  tabs: unknown;
}

function asMap(value: unknown): PermissionMap {
  return (value && typeof value === "object" ? (value as PermissionMap) : {}) ?? {};
}

/** "Allow Edit" check for an action, resolving requestRevision's implied grant. */
export function can(user: PermissionSubject, action: ActionKey | "requestRevision"): boolean {
  const resolved = IMPLIED_ACTIONS[action as string] ?? action;
  return !!asMap(user.actions)[resolved];
}

/**
 * "Allow View" check for an action. Edit auto-grants View — a user with
 * Edit but (incorrectly) no stored View flag should still be able to see
 * what they're allowed to edit.
 */
export function canViewAction(user: PermissionSubject, action: ActionKey | "requestRevision"): boolean {
  const resolved = IMPLIED_ACTIONS[action as string] ?? action;
  return !!asMap(user.actionViews)[resolved] || !!asMap(user.actions)[resolved];
}

export function canSeePage(user: PermissionSubject, page: PageKey): boolean {
  return !!asMap(user.pages)[page];
}

export function canSeeTab(user: PermissionSubject, tab: TabKey): boolean {
  return !!asMap(user.tabs)[tab];
}

/** Thrown by requireX helpers so API routes/server actions can map it to a 403. */
export class PermissionError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "PermissionError";
  }
}

export function requireAction(
  user: PermissionSubject,
  action: ActionKey | "requestRevision",
  level: "view" | "edit" = "edit"
): void {
  const ok = level === "edit" ? can(user, action) : canViewAction(user, action);
  if (!ok) throw new PermissionError(`Missing ${level} permission for action "${action}"`);
}

export function requirePage(user: PermissionSubject, page: PageKey): void {
  if (!canSeePage(user, page)) throw new PermissionError(`Missing access to page "${page}"`);
}

export function requireTab(user: PermissionSubject, tab: TabKey): void {
  if (!canSeeTab(user, tab)) throw new PermissionError(`Missing access to tab "${tab}"`);
}
