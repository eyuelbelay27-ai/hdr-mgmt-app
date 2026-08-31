import React, { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import {
  Home, Briefcase, PlusCircle, Scissors, Calculator, Wallet, CreditCard,
  Package, FileBarChart, Users as UsersIcon, Settings as SettingsIcon,
  X, Printer, Upload, Trash2, ChevronRight, Bell, Lock, CheckCircle2,
  AlertTriangle, ArrowLeft, ChevronDown, Search, Menu, RefreshCw, Undo2,
  LogOut, KeyRound, ShieldCheck, Eye, EyeOff, UserPlus, Scale, Flag, Clock, Copy, Boxes, ArrowDownCircle, ArrowUpCircle
} from "lucide-react";

/* =========================================================================
   HADAR ADVERTISING — SIGNAGE JOB MANAGEMENT (FUNCTIONAL PROTOTYPE)
   -------------------------------------------------------------------------
   This is a client-side prototype: every number on screen is computed live
   from the job record in React state — nothing is hard-coded. It exists to
   validate the workflow, data model, and calculations before the real
   build (Next.js + Prisma/Postgres + Auth.js) which needs a server and a
   database this environment can't run. Business logic lives in the `calc`
   object below, deliberately separated from the UI, mirroring lib/calculations
   in the target architecture. Role switching simulates authentication.
   ========================================================================= */

/* ---------------------------- design tokens ---------------------------- */
const TOKENS = `
:root{
  --bg:#131315; --surface:#1B1B1F; --surface-2:#222227; --surface-3:#2A2A31;
  --border:#302F36; --border-soft:#26262C;
  --text:#EDEAE2; --text-dim:#9C99A3; --text-faint:#69666F;
  --accent:#C7962F; --accent-soft:rgba(199,150,47,0.14); --accent-text:#E8C77A;
  --success:#4F9D6E; --success-soft:rgba(79,157,110,0.14);
  --danger:#C1493D; --danger-soft:rgba(193,73,61,0.14);
  --warn:#D9A441; --warn-soft:rgba(217,164,65,0.14);
  --info:#5E90BF; --info-soft:rgba(94,144,191,0.14);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --sans: ui-sans-serif, "Inter", "Segoe UI", "Noto Sans Ethiopic", "Nyala", system-ui, sans-serif;
}
.hadar-root{ background:var(--bg); color:var(--text); font-family:var(--sans);
  min-height:600px; display:flex; width:100%; }
.mono{font-family:var(--mono);}
.card{ background:var(--surface); border:1px solid var(--border); border-radius:10px; }
.card-2{ background:var(--surface-2); border:1px solid var(--border); border-radius:10px; }
.hr{ border-top:1px solid var(--border-soft); }
.btn{ font-family:var(--sans); font-size:12.5px; font-weight:600; border-radius:7px;
  padding:7px 12px; border:1px solid var(--border); background:var(--surface-2);
  color:var(--text); cursor:pointer; display:inline-flex; align-items:center; gap:6px;
  transition:filter .12s, opacity .12s; white-space:nowrap; }
.btn:hover{ filter:brightness(1.15); }
.btn:disabled{ opacity:.35; cursor:not-allowed; }
.btn-primary{ background:var(--accent); border-color:var(--accent); color:#1A1406; }
.btn-danger{ background:var(--danger-soft); border-color:var(--danger); color:#F0A99F; }
.btn-ghost{ background:transparent; border-color:transparent; }
.btn-sm{ padding:4px 9px; font-size:11.5px; border-radius:6px; }
.input, select.input, textarea.input{ width:100%; background:var(--surface-2); border:1px solid var(--border);
  border-radius:7px; padding:7px 10px; color:var(--text); font-size:13px; font-family:var(--sans); }
.input:focus, select.input:focus, textarea.input:focus{ outline:none; border-color:var(--accent); }
.input:disabled{ opacity:.5; }
.label{ font-size:11px; color:var(--text-dim); font-weight:600; text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; display:block;}
.nav-item{ display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:8px; font-size:13px;
  color:var(--text-dim); cursor:pointer; font-weight:500; }
.nav-item:hover{ background:var(--surface-2); color:var(--text); }
.nav-item.active{ background:var(--accent-soft); color:var(--accent-text); }
.badge{ display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:100px;
  font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; white-space:nowrap;}
.tab{ padding:9px 4px; font-size:12.5px; font-weight:600; color:var(--text-dim); cursor:pointer;
  border-bottom:2px solid transparent; white-space:nowrap; }
.tab.active{ color:var(--accent-text); border-color:var(--accent); }
.tab:hover{ color:var(--text); }
table.dtable{ width:100%; border-collapse:collapse; font-size:12.5px; }
table.dtable th{ text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.03em;
  color:var(--text-faint); font-weight:700; padding:8px 10px; border-bottom:1px solid var(--border); }
table.dtable td{ padding:8px 10px; border-bottom:1px solid var(--border-soft); vertical-align:middle; }
table.dtable tr:hover td{ background:var(--surface-2); }
::placeholder{ color:var(--text-faint); }
.scrollbar-thin::-webkit-scrollbar{ width:6px; height:6px; }
.scrollbar-thin::-webkit-scrollbar-thumb{ background:var(--border); border-radius:4px; }
.step{ display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; min-width:60px; }
.step-dot{ width:10px; height:10px; border-radius:50%; background:var(--border); border:2px solid var(--border); }
.step-dot.done{ background:var(--accent); border-color:var(--accent); }
.step-dot.now{ background:var(--bg); border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
.step-line{ flex:1; height:2px; background:var(--border); margin-top:5px; }
.step-line.done{ background:var(--accent); }
.mat-preview{ background-image:linear-gradient(var(--border-soft) 1px, transparent 1px),
  linear-gradient(90deg, var(--border-soft) 1px, transparent 1px); background-size:8px 8px;
  background-color:var(--surface-2); border:1px solid var(--border); border-radius:6px; }
.print-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:100; display:flex;
  align-items:center; justify-content:center; padding:24px; }
.print-sheet{ background:#fff; color:#111; width:100%; max-width:680px; max-height:90%; overflow:auto;
  border-radius:6px; padding:28px; }
@media print{
  .no-print{ display:none !important; }
  .print-overlay{ position:static; background:none; padding:0; display:block; }
  .print-sheet{ max-width:none; max-height:none; box-shadow:none; }
}
`;

let ID = 1000;
const nid = (p) => `${p}-${(ID++).toString(36)}`;

/* ------------------------------ constants ------------------------------ */
// NOTE: There is intentionally no "Sales" role — client intake is handled by
// Admin / Manager / Owner-Finance. Access is per-user, not just per-role:
// every user has their own login, and an Admin can grant or revoke exactly
// which actions and which pages that specific person can see (see Users page).
const ROLES = ["Designer", "Supervisor", "Manager", "Owner/Finance", "Admin"];

const ACTION_KEYS = [
  { key: "createJob", label: "Create new jobs" },
  { key: "manageDraftJobs", label: "See and edit draft jobs" },
  { key: "editDesign", label: "Edit design spec & components" },
  { key: "editCutList", label: "Edit material cut list" },
  { key: "manageCostEstimate", label: "Fill Cost Estimate quantities (Cash/Stock sheet)" },
  { key: "addCostEstimateItem", label: "Add ad-hoc items to Cost Estimate" },
  { key: "manageSalePriceProfit", label: "View & edit Sale Price & Profit card" },
  { key: "manageCostEstimateNotes", label: "Edit Cost Estimate notes" },
  { key: "submitForApproval", label: "Submit job (design+cutlist+cost) for approval" },
  { key: "approveBudget", label: "Fill & approve budget (approves the whole job)" },
  { key: "manageBudget", label: "Edit budget breakdown" },
  { key: "editApprovedJob", label: "Unlock an approved job for editing" },
  { key: "submitForReconciliation", label: "Submit implemented job for reconciliation" },
  { key: "manageExpenses", label: "Log expenses / purchases" },
  { key: "managePayments", label: "Record payments & edit pricing" },
  { key: "reconcileBudget", label: "Reconcile approved budget vs. supervisor expense reports" },
  { key: "closeJob", label: "Close a job" },
  { key: "reopenJob", label: "Reopen a closed job" },
  { key: "cancelJob", label: "Cancel a job" },
  { key: "manageSignagePrices", label: "Edit Price Database (used by Cost Estimation)" },
  { key: "submitPurchaseOrder", label: "Issue purchase orders (out-of-project purchases)" },
  { key: "approvePurchaseOrder", label: "Approve / reject purchase orders" },
  { key: "manageInventory", label: "Record manual stock in/out" },
  { key: "manageUsers", label: "Manage users & permissions" },
];
// requestRevision (send an approval request back to Draft) reuses the
// approveBudget permission, since the Admin reviewing the submission is the
// one who'd reject it.
const IMPLIED = { requestRevision: "approveBudget" };

const PAGE_KEYS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "jobs", label: "Jobs" },
  { key: "calculator", label: "Price Database" },
  { key: "inventory", label: "Inventory" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "users", label: "Users" },
  { key: "settings", label: "Settings" },
];

// Every tab inside a Job's detail view gets its own "Allow View" toggle,
// independent of whatever edit permission governs that tab's content.
const TAB_KEYS = [
  { key: "tab_overview", label: "Overview Tab" },
  { key: "tab_design", label: "Design Tab" },
  { key: "tab_cutlist", label: "Cut List Tab" },
  { key: "tab_cost", label: "Cost Estimate Tab" },
  { key: "tab_budget", label: "Budget Tab" },
  { key: "tab_expenses", label: "Expenses Tab" },
  { key: "tab_payments", label: "Payments & Profit Tab" },
  { key: "tab_activity", label: "Activity Tab" },
  // Dashboard items — one toggle per tab shown on the Dashboard page,
  // independent of any other permission that might otherwise imply access.
  { key: "dash_draft", label: "Dashboard: Draft" },
  { key: "dash_approval", label: "Dashboard: Waiting for Approval" },
  { key: "dash_budget", label: "Dashboard: Approved Budget" },
  { key: "dash_reconciliation", label: "Dashboard: Waiting for Reconciliation" },
  { key: "dash_remaining", label: "Dashboard: Remaining Payments" },
  { key: "dash_purchaseOrders", label: "Dashboard: Purchase Orders" },
];

// -----------------------------------------------------------------------
// Workflow (rebuilt): Draft → Waiting for Approval → Approved Budget →
// Waiting for Reconciliation → Closed (+ Cancelled as an exception path).
// Draft is private to whoever can create jobs. The Admin reviews the whole
// submitted package and approves it by filling in the Budget himself —
// there's no separate "approve the design" step anymore. Once approved,
// Design/Cut List/Cost Estimate/Budget lock for everyone except the Admin,
// who has a dedicated unlock toggle. The implementing user submits for
// reconciliation once work + expenses are logged. Payments & Profit is an
// Admin-only tool, visible to the Admin at every phase and to nobody else.
// -----------------------------------------------------------------------
const DEFAULT_ACTIONS_BY_ROLE = {
  "Designer": ["editDesign", "editCutList"],
  "Supervisor": ["editCutList", "manageExpenses", "submitForReconciliation", "submitPurchaseOrder"],
  "Manager": ["createJob", "manageDraftJobs", "submitForApproval"],
  "Owner/Finance": ["createJob", "manageDraftJobs", "submitForApproval", "manageCostEstimate", "addCostEstimateItem", "manageSalePriceProfit", "manageCostEstimateNotes", "manageInventory"],
  "Admin": ACTION_KEYS.map((a) => a.key),
};
const DEFAULT_PAGES_BY_ROLE = {
  "Designer": ["dashboard", "jobs"],
  "Supervisor": ["dashboard", "jobs"],
  "Manager": ["dashboard", "jobs", "calculator"],
  "Owner/Finance": ["dashboard", "jobs", "calculator", "inventory", "reconciliation"],
  "Admin": ["dashboard", "jobs", "calculator", "inventory", "reconciliation", "users", "settings"],
};
const DEFAULT_TABS_BY_ROLE = {
  "Designer": ["tab_overview", "tab_design", "tab_cutlist", "tab_activity", "dash_approval", "dash_budget", "dash_reconciliation"],
  "Supervisor": ["tab_overview", "tab_design", "tab_cutlist", "tab_expenses", "tab_activity", "dash_approval", "dash_budget", "dash_reconciliation", "dash_purchaseOrders"],
  "Manager": ["tab_overview", "tab_design", "tab_cutlist", "tab_cost", "tab_activity", "dash_draft", "dash_approval", "dash_budget", "dash_reconciliation"],
  "Owner/Finance": ["tab_overview", "tab_design", "tab_cutlist", "tab_cost", "tab_activity", "dash_draft", "dash_approval", "dash_budget", "dash_reconciliation", "dash_remaining"],
  // Payments & Profit is deliberately Admin-only, at every phase, for every
  // other role — not part of any other role's default tab set.
  "Admin": TAB_KEYS.map((t) => t.key),
};
function buildPermSet(role) {
  const actions = {}; ACTION_KEYS.forEach((a) => { actions[a.key] = (DEFAULT_ACTIONS_BY_ROLE[role] || []).includes(a.key); });
  // Every "Allow Edit" action also gets its own independent "Allow View" flag —
  // lets an Admin grant someone visibility into an action's related info
  // (e.g. who approved a budget, close/reopen status) without granting the
  // ability to perform that action themselves. Defaults to match the edit
  // default so behavior is unchanged until an Admin customizes it.
  const actionViews = {}; ACTION_KEYS.forEach((a) => { actionViews[a.key] = (DEFAULT_ACTIONS_BY_ROLE[role] || []).includes(a.key); });
  const pages = {}; PAGE_KEYS.forEach((p) => { pages[p.key] = (DEFAULT_PAGES_BY_ROLE[role] || []).includes(p.key); });
  const tabs = {}; TAB_KEYS.forEach((t) => { tabs[t.key] = (DEFAULT_TABS_BY_ROLE[role] || []).includes(t.key); });
  return { actions, actionViews, pages, tabs };
}

function userSeed(u) {
  const { actions, actionViews, pages, tabs } = buildPermSet(u.role);
  return { id: nid("user"), active: true, actions, actionViews, pages, tabs, ...u };
}
const USERS_SEED = [
  // Admin authority sits with Bereket. Eyuel keeps his account and retains
  // Owner/Finance access, but the Admin role — and everything that comes
  // with it (budget approval, payments, users, materials) — belongs to
  // Bereket by default.
  userSeed({ username: "eyuel", password: "admin123", name: "Eyuel", role: "Owner/Finance" }),
  userSeed({ username: "bereket", password: "owner123", name: "Bereket", role: "Admin" }),
  userSeed({ username: "netsi", password: "design123", name: "Netsi", role: "Designer" }),
  userSeed({ username: "yonas", password: "manager123", name: "Yonas", role: "Manager" }),
  userSeed({ username: "dawit", password: "super123", name: "Dawit", role: "Supervisor" }),
];

const STATUSES = ["Draft", "Waiting for Approval", "Approved Budget", "Waiting for Reconciliation", "Closed", "Cancelled"];

const STATUS_COLOR = {
  "Draft": { bg: "var(--surface-3)", fg: "var(--text-dim)" },
  "Waiting for Approval": { bg: "var(--info-soft)", fg: "#8FBEE8" },
  "Approved Budget": { bg: "var(--accent-soft)", fg: "var(--accent-text)" },
  "Waiting for Reconciliation": { bg: "var(--warn-soft)", fg: "#F0C878" },
  "Closed": { bg: "var(--success-soft)", fg: "#8FD1A8" },
  "Cancelled": { bg: "var(--danger-soft)", fg: "#F0A99F" },
};

const PROGRESS_STAGES = ["Draft", "Waiting for Approval", "Approved Budget", "Reconciliation", "Closed"];
const STAGE_FOR_STATUS = {
  "Draft": 0, "Waiting for Approval": 1, "Approved Budget": 2, "Waiting for Reconciliation": 3, "Closed": 4, "Cancelled": -1,
};

const LED_COLORS = ["White", "Warm White", "RGB", "Custom"];
const SIGN_TYPES = ["Lightbox", "Neon", "LED Sign", "Foam / 3D Sign", "Mica Sign", "Clad / Aluminum Sign", "Sticker / Print", "Relief", "Engraving", "Rollup", "Repair / Service", "Custom"];
const SHAPES = ["Rectangle", "Circle", "Lettering (Cut)", "Custom Shape"];

/* ------------------------------ seed data ------------------------------ */

/* --------------------- Signage Calculator price database ---------------------
   The single shared material/price catalog used by both the Price Database
   page and every job's Cost Estimate tab. Prices below are taken directly
   from the supplied Hadar Sign Shop price list; every entry with no
   confirmed price is marked inactive with a note instead of guessing.
   ------------------------------------------------------------------------- */
function matSeed(m) { return { id: nid("smat"), active: true, defaultQty: null, notes: "", priceHistory: [], ...m }; }
const SIGNAGE_MATERIALS_SEED = [
  // Main / cash materials — priced directly from the supplied table
  matSeed({ name: "Mica", category: "cash", unit: "Kare", rate: 5000 }),
  matSeed({ name: "Transparent Mica 8mm", category: "cash", unit: "Kare", rate: 15000 }),
  matSeed({ name: "Color Board", category: "cash", unit: "Kare", rate: 8000 }),
  matSeed({ name: "LED Module", category: "cash", unit: "pc", rate: 27 }),
  matSeed({ name: "LED Strip", category: "cash", unit: "m", rate: 500 }),
  matSeed({ name: "Foam 20mm", category: "cash", unit: "Kare", rate: 4500 }),
  matSeed({ name: "Foam 10mm", category: "cash", unit: "Kare", rate: 3500 }),
  matSeed({ name: "Foam 5mm", category: "cash", unit: "Kare", rate: 3000 }),
  matSeed({ name: "Aluminum Service", category: "cash", unit: "Kare", rate: 600 }),
  matSeed({ name: "Metal", category: "cash", unit: "Berga", rate: 1650 }),
  matSeed({ name: "Aluminum Panel 3.50", category: "cash", unit: "pc", rate: 14000 }),
  matSeed({ name: "Aluminum Panel 2.44", category: "cash", unit: "pc", rate: 12000 }),
  matSeed({ name: "Power Supply 60W", category: "cash", unit: "pc", rate: 1800 }),
  // Priced via the worked examples in the source (section 7), not the main table
  matSeed({ name: "Wire", category: "stock", unit: "m", rate: 58.46, notes: "Price derived from source worked example (8 × 58.46 = 467.68 ETB)." }),
  matSeed({ name: "Adapter", category: "stock", unit: "pc", rate: 800, notes: "Price derived from source worked example (2 × 800 = 1,600 ETB)." }),
  // Stock/consumable items with a stated default quantity but no confirmed price
  matSeed({ name: "Amir", category: "stock", unit: "", rate: null, active: false, defaultQty: 1.3, notes: "Default quantity given in source; unit price not confirmed." }),
  matSeed({ name: "Mebeyeya Electrode", category: "stock", unit: "pc", rate: null, active: false, defaultQty: 5, notes: "Default quantity given in source; unit price not confirmed." }),
  // Remaining stock/consumable items named in the source with no price or unit given —
  // left inactive and blank rather than inventing a value. Set the real price/unit here
  // once known and they'll become selectable automatically.
  ...[
    "Socket", "Neon Transparent Wire", "Small Chain", "Bigger Chain", "Screw", "Fisher",
    "Jumper", "Angle Bar", "Anchor Bolt", "Hook", "Paint", "Power Supplies (other)",
    "UV Print", "UV Board", "Clad / Alucobond", "Transparent Sticker", "Transport",
    "Footing", "Scaffolding", "Spacer", "Relief", "Transparent Mica 3mm", "Clad Relief",
    "Engraving", "Rollup", "Metal 60", "Mesh Sticker", "White Sticker", "Frosted Sticker",
    "MDF", "Mica Service", "Lid", "Banner", "Service", "Mesh",
  ].map((name) => matSeed({ name, category: "stock", unit: "", rate: null, active: false, notes: "Price not confirmed in source — update in Price Database." })),
];

/* ------------------------- purchase orders ------------------------------
   Standalone, job-independent purchases (office supplies, one-off
   equipment, anything not billed to a specific project). Whoever issues one
   (Supervisor by default) submits it for the Admin to approve or reject —
   entirely separate from any job's Expenses/Budget.
   ------------------------------------------------------------------------- */
let PO_COUNTER = 1;
function poSeed(p) {
  return {
    id: nid("po"), poNumber: `PO-2026-${String(PO_COUNTER++).padStart(4, "0")}`,
    status: "Pending", approvedBy: "", approvedAt: null, note: "", history: [],
    createdAt: new Date().toISOString(), ...p,
  };
}
const PURCHASE_ORDERS_SEED = [];

/* ---------------------------- inventory ----------------------------------
   A running ledger of stock-item movements. Stock In entries are logged
   manually (e.g. receiving a purchase order). Stock Out entries are logged
   the same way for manual adjustments, and generated automatically whenever
   a job's Budget — which carries qty/unit for any line pulled from a Stock
   Items Cost Estimate line — gets approved, so approving a budget with
   stock items on it immediately reduces the on-hand balance.
   ------------------------------------------------------------------------- */
function inventoryEntry(e) {
  return { id: nid("inv"), date: new Date().toISOString().slice(0, 10), note: "", createdAt: new Date().toISOString(), ...e };
}
const INVENTORY_SEED = [];

function emptyJob(over = {}) {
  return {
    id: nid("job"),
    jobNumber: "",
    clientName: "", clientContact: "", clientPhone: "", clientAddress: "",
    title: "", clientNotes: "",
    status: "Draft",
    previousStatus: null,
    deadline: null,
    revisionNote: "", revisionNoteBy: "",
    // When true, the Admin has unlocked Design/Cut List/Cost Estimate/Budget
    // for editing after approval — otherwise those tabs lock once the job
    // reaches Approved Budget or later, for everyone including the Admin.
    adminUnlocked: false,
    designer: "", supervisor: "",
    productionNotes: "",
    designApprovedBy: "", designApprovedAt: null, revisionCount: 0,
    components: [],
    cutFiles: [],
    costEstimate: { items: [], preparedBy: "", generatedAt: null, notes: "", priceListFile: null, soldPrice: 0, commissionActive: false },
    budget: { items: [], approvedBy: "", approvedAt: null, status: "Draft" },
    expenses: [],
    payments: [],
    monitoring: {
      originalPrice: 0, negotiation: 0, commissionPercent: 10,
      closed: false, closedAt: null, closedBy: "",
    },
    checklist: { withholdingCollected: false, receiptAttached: false },
    // Reconciliation compares the approved Budget line items against what
    // the Supervisor actually logged in Expenses. "status" is set by an
    // Admin/Owner-Finance user with the reconcileBudget action.
    reconciliation: { status: "Pending", note: "", reconciledBy: "", reconciledAt: null },
    activity: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...over,
  };
}

function seedJobs() {
  const j1 = emptyJob({
    jobNumber: "HAD-2026-0001",
    clientName: "Brana Kitfo & Lounge", clientContact: "Ato Brana Tesfaye",
    clientPhone: "0911223344", clientAddress: "Bole, Addis Ababa",
    title: "Combined Sign — Storefront + Lightbox", clientNotes: "Rush job, opening event in 3 weeks.",
    status: "Closed", designer: "Netsi", supervisor: "Bereket",
    
    productionNotes: "Front elevation, mount above entrance. Waterproof housing required.\nየፊት ገጽታ ከመግቢያው በላይ ይገጠማል። የውሃ መከላከያ ሽፋን ያስፈልጋል።",
    designApprovedBy: "Netsi", designApprovedAt: "2026-06-02T09:12:00.000Z", revisionCount: 1,
    components: [
      { id: nid("c"), name: "Main Storefront Sign", width: 5, height: 1, qty: 1, ledColor: "Warm White", art: null },
      { id: nid("c"), name: "Circle Logo", width: 0.8, height: 0.8, qty: 1, ledColor: "RGB", art: null },
      { id: nid("c"), name: "Lightbox Lettering", width: 2.2, height: 0.6, qty: 1, ledColor: "Warm White", art: null },
    ],
    expenses: [], costEstimate: { items: [], preparedBy: "", generatedAt: null, notes: "", priceListFile: null, soldPrice: 0, commissionActive: false },
    budget: { items: [], approvedBy: "", approvedAt: null, status: "Draft" },
    payments: [],
    monitoring: { originalPrice: 68000, negotiation: -3000, commissionPercent: 8, closed: true, closedAt: "2026-07-10T14:00:00.000Z", closedBy: "Bereket" },
    reconciliation: { status: "Reconciled", note: "All budget lines matched against Bereket's expense log within tolerance.", reconciledBy: "Eyuel", reconciledAt: "2026-07-10T15:00:00.000Z" },
    checklist: { withholdingCollected: true, receiptAttached: true },
    activity: [],
  });
  j1.costEstimate = {
    preparedBy: "Bereket (Owner/Finance)", generatedAt: "2026-06-05T10:00:00.000Z",
    notes: "Angle Bar and Workshop Services priced against Hadar's July supplier price list. Power Supply unit sourced locally, not on the standard list.",
    priceListFile: null,
    items: [
      { id: nid("ce"), name: "White Mica", category: "cash", unit: "sqm", qty: 4.6, unitPrice: 950, source: "Cut List" },
      { id: nid("ce"), name: "LED Module", category: "cash", unit: "pc", qty: 18, unitPrice: 45, source: "Cut List" },
      { id: nid("ce"), name: "Power Supply", category: "cash", unit: "pc", qty: 2, unitPrice: 850, source: "Manual" },
      { id: nid("ce"), name: "Transport", category: "cash", unit: "trip", qty: 1, unitPrice: 800, source: "Manual" },
      { id: nid("ce"), name: "Angle Bar", category: "stock", unit: "m", qty: 6, unitPrice: 350, source: "Manual" },
      { id: nid("ce"), name: "Workshop Services", category: "stock", unit: "job", qty: 1, unitPrice: 1500, source: "Manual" },
    ].map((i) => ({ ...i, materialId: SIGNAGE_MATERIALS_SEED.find((m) => m.name === i.name)?.id, total: round2(i.qty * i.unitPrice) })),
  };
  j1.budget = {
    status: "Approved", approvedBy: "Manager — Yonas", approvedAt: "2026-06-06T08:00:00.000Z",
    items: [
      { id: nid("b"), label: "Materials", amount: 13000, comment: "Mica, LED modules, transparent sticker" },
      { id: nid("b"), label: "Labor", amount: 9000, comment: "Fabrication + install crew, 2 days" },
      { id: nid("b"), label: "Transport", amount: 800, comment: "" },
      { id: nid("b"), label: "Contingency", amount: 1200, comment: "Buffer for waste/kerf adjustments" },
    ],
  };
  j1.expenses = [
    { id: nid("e"), date: "2026-06-08", purchaser: "Bereket", item: "White Mica sheets", material: "White Mica", description: "4.6 sqm", qty: 4.6, unitPrice: 950, budgetRef: "Materials", receipt: null },
    { id: nid("e"), date: "2026-06-09", purchaser: "Netsi", item: "LED Modules", material: "LED Module", description: "18 pcs, warm white + RGB", qty: 18, unitPrice: 45, budgetRef: "Materials", receipt: null },
    { id: nid("e"), date: "2026-06-10", purchaser: "Bereket", item: "Workshop labor", material: "Workshop Services", description: "Fabrication + install crew", qty: 1, unitPrice: 8600, budgetRef: "Labor", receipt: null },
    { id: nid("e"), date: "2026-06-11", purchaser: "Netsi", item: "Site transport", material: "Transport", description: "Delivery + install trip", qty: 1, unitPrice: 800, budgetRef: "Transport", receipt: null },
  ].map((e) => ({ ...e, totalPrice: round2(e.qty * e.unitPrice), withholding: calc.withholding(round2(e.qty * e.unitPrice)) }));
  j1.payments = [
    { id: nid("p"), amount: 32500, type: "Advance", method: "Bank Transfer (CBE)", date: "2026-06-03", notes: "50% upfront", receipt: null },
    { id: nid("p"), amount: 32500, type: "Final", method: "Cheque", date: "2026-07-09", notes: "Balance on delivery", receipt: null },
  ];
  j1.activity = [
    { ts: "2026-07-10T14:00:00.000Z", text: "Job closed by Bereket (Owner/Finance)" },
    { ts: "2026-07-09T09:00:00.000Z", text: "Final payment recorded — ETB 32,500.00" },
    { ts: "2026-06-11T09:00:00.000Z", text: "Expense recorded — Site transport" },
    { ts: "2026-06-10T09:00:00.000Z", text: "Expense recorded — Workshop labor" },
    { ts: "2026-06-09T09:00:00.000Z", text: "Expense recorded — LED Modules" },
    { ts: "2026-06-08T09:00:00.000Z", text: "Expense recorded — White Mica sheets" },
    { ts: "2026-06-06T08:00:00.000Z", text: "Budget approved by Manager — Yonas" },
    { ts: "2026-06-05T10:00:00.000Z", text: "Cost estimate generated by Bereket (Owner/Finance)" },
    { ts: "2026-06-03T09:00:00.000Z", text: "Advance payment recorded — ETB 32,500.00" },
    { ts: "2026-06-02T09:12:00.000Z", text: "Design approved by Netsi" },
    { ts: "2026-06-01T10:30:00.000Z", text: "Design submitted for approval" },
    { ts: "2026-06-01T09:00:00.000Z", text: "Job created by Bereket (Owner/Finance)" },
  ];

  const j2 = emptyJob({
    jobNumber: "HAD-2026-0002",
    clientName: "Zewde Trading PLC", clientContact: "W/ro Hana Alemu",
    clientPhone: "0922334455", clientAddress: "CMC, Addis Ababa",
    title: "Warehouse Lightbox Sign", clientNotes: "",
    status: "Waiting for Approval", designer: "Netsi", supervisor: "",
    
    productionNotes: "Double-sided lightbox, pole mount.",
    designApprovedBy: "Netsi", designApprovedAt: "2026-08-05T11:00:00.000Z", revisionCount: 0,
    components: [
      { id: nid("c"), name: "Main Lightbox", width: 3, height: 1.2, qty: 2, ledColor: "White", art: null },
      { id: nid("c"), name: "Support Frame Sign", width: 0.6, height: 0.6, qty: 4, ledColor: "White", art: null },
    ],
  });
  j2.activity = [
    { ts: "2026-08-05T11:00:00.000Z", text: "Design approved by Netsi — cut list auto-generated" },
    { ts: "2026-08-04T15:00:00.000Z", text: "Design submitted for approval" },
    { ts: "2026-08-04T10:00:00.000Z", text: "Job created by Yonas (Manager)" },
  ];

  const j3 = emptyJob({
    jobNumber: "HAD-2026-0003",
    clientName: "NIB International Bank", clientContact: "Ato Kaleb Girma",
    clientPhone: "0933445566", clientAddress: "Ayat, Addis Ababa",
    title: "ATM Branding Package", status: "Draft", designer: "", supervisor: "",
  });
  j3.activity = [{ ts: "2026-08-11T09:00:00.000Z", text: "Job created by Eyuel (Admin)" }];

  return [j1, j2, j3];
}

/* ------------------------------ calc lib -------------------------------
   Centralized business logic — kept out of components on purpose (would
   live at lib/calculations/*.ts in the real build). Every formula used
   anywhere in the UI is defined exactly once, here.
   ------------------------------------------------------------------------- */
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

const calc = {
  lineTotal: (qty, price) => round2(qty * price),
  costEstimateTotals: (items) => {
    const cash = round2(items.filter((i) => i.category === "cash").reduce((s, i) => s + i.total, 0));
    const stock = round2(items.filter((i) => i.category === "stock").reduce((s, i) => s + i.total, 0));
    return { cash, stock, grand: round2(cash + stock) };
  },
  // Stock items are usually inventory already on hand, not new spend that
  // needs approval — they're excluded from the allocated total. Any row
  // without a category (manual "Add Row" entries) counts as cash by default.
  budgetTotal: (items) => round2(items.filter((i) => i.category !== "stock").reduce((s, i) => s + (Number(i.amount) || 0), 0)),
  budgetStockValue: (items) => round2(items.filter((i) => i.category === "stock").reduce((s, i) => s + (Number(i.amount) || 0), 0)),
  totalExpenses: (expenses) => round2(expenses.reduce((s, e) => s + e.totalPrice, 0)),
  totalWithholding: (expenses) => round2(expenses.reduce((s, e) => s + e.withholding, 0)),
  withholding: (total, rate = 3) => (Number(total) || 0) > 20000 ? round2((total * rate) / 100) : 0,
  advanceFromPayments: (payments) => round2(payments.filter((p) => p.type === "Advance").reduce((s, p) => s + Number(p.amount || 0), 0)),
  finalReceivedFromPayments: (payments) => round2(payments.filter((p) => p.type === "Final").reduce((s, p) => s + Number(p.amount || 0), 0)),
  // Sold Price is the source of truth now (set on Cost Estimate) — the old
  // Original Price/Negotiation fields have no editing UI anywhere anymore.
  remainingPayment: (soldPrice, advance, finalReceived) => Math.max(0, round2(soldPrice - advance - finalReceived)),
  commissionAmount: (finalPrice, pct) => round2((finalPrice * (Number(pct) || 0)) / 100),
  // Profit = Final Price − Total Actual Expenses − Commission Amount.
  // Documented here as the single source of truth for the profit formula.
  profitAmount: (finalPrice, totalExpenses, commissionAmount) => round2(finalPrice - totalExpenses - commissionAmount),
  profitPercent: (profitAmount, finalPrice) => (finalPrice ? round2((profitAmount / finalPrice) * 100) : 0),
};

function getFinancials(job) {
  const ceTotals = calc.costEstimateTotals(job.costEstimate.items);
  const budgetTotal = calc.budgetTotal(job.budget.items);
  const totalExpenses = calc.totalExpenses(job.expenses);
  const totalWithholding = calc.totalWithholding(job.expenses);
  const advance = calc.advanceFromPayments(job.payments);
  const finalReceived = calc.finalReceivedFromPayments(job.payments);
  const finalPrice = round2(Number(job.costEstimate.soldPrice) || 0);
  const remaining = calc.remainingPayment(finalPrice, advance, finalReceived);
  const commissionAmount = calc.commissionAmount(finalPrice, job.monitoring.commissionPercent);
  const profitAmount = calc.profitAmount(finalPrice, totalExpenses, commissionAmount);
  const profitPercent = calc.profitPercent(profitAmount, finalPrice);
  let budgetStatus = "Balanced";
  if (ceTotals.grand - budgetTotal > 1) budgetStatus = "Over Budget";
  else if (budgetTotal - ceTotals.grand > 1) budgetStatus = "Under Budget";
  return {
    ceTotals, budgetTotal, totalExpenses, totalWithholding, advance, finalReceived,
    finalPrice, remaining, commissionAmount, profitAmount, profitPercent, budgetStatus,
  };
}

function fmtETB(n) {
  return `ETB ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(s) { if (!s) return "—"; const d = new Date(s); return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
function fmtDateTime(s) { if (!s) return "—"; const d = new Date(s); return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

/* -------------------------------- app ----------------------------------- */
export default function App() {
  const [users, setUsers] = useState(USERS_SEED);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [jobs, setJobs] = useState(seedJobs);
  const [signageMaterials, setSignageMaterials] = useState(SIGNAGE_MATERIALS_SEED);
  const [purchaseOrders, setPurchaseOrders] = useState(PURCHASE_ORDERS_SEED);
  const [inventoryLedger, setInventoryLedger] = useState(INVENTORY_SEED);
  const [withholdingRate, setWithholdingRate] = useState(3);
  const [view, setView] = useState("dashboard");
  const [activeJobId, setActiveJobId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [printDoc, setPrintDoc] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [jobFilter, setJobFilter] = useState({ status: "All", q: "" });
  const jobCounter = useRef(4);

  // IMPORTANT: currentUser can be null (logged out). All hooks below must
  // run unconditionally on every render — the login gate is handled purely
  // in JSX further down, never via an early `return` up here, or React's
  // hook order breaks the moment someone logs in.
  const currentUser = users.find((u) => u.id === currentUserId) || null;

  const can = (action) => !!currentUser?.actions?.[IMPLIED[action] || action];
  const canViewAction = (action) => !!currentUser?.actionViews?.[IMPLIED[action] || action];
  const canSeePage = (pageId) => !!currentUser?.pages?.[pageId];
  const canSeeTab = (tabId) => !!currentUser?.tabs?.[tabId];
  // Display label used throughout for activity logs / "prepared by" fields.
  const role = currentUser ? `${currentUser.name} (${currentUser.role})` : "";

  const patchJob = (id, fn) => setJobs((prev) => prev.map((j) => (j.id === id ? { ...fn(j), updatedAt: new Date().toISOString() } : j)));
  const logJob = (job, text) => ({ ...job, activity: [{ ts: new Date().toISOString(), text }, ...job.activity] });
  const openJob = (id) => { setActiveJobId(id); setActiveTab("overview"); setView("jobDetail"); };

  const activeJob = jobs.find((j) => j.id === activeJobId) || null;

  const dashboardData = useMemo(() => {
    const attention = jobs.filter((j) => {
      if (["Closed", "Cancelled"].includes(j.status)) return false;
      const f = getFinancials(j);
      if (f.budgetStatus === "Over Budget") return true;
      return false;
    });
    return { attention };
  }, [jobs]);

  const notifications = dashboardData.attention.map((j) => ({ id: j.id, text: `${j.jobNumber} — ${j.clientName} needs attention` }));

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (j.status === "Draft" && !can("manageDraftJobs")) return false; // Drafts are private to whoever has draft access
      if (jobFilter.status === "Outstanding") {
        const f = getFinancials(j);
        if (!(f.remaining > 0 && !["Closed", "Cancelled"].includes(j.status))) return false;
      } else if (jobFilter.status === "Active") {
        if (["Closed", "Cancelled"].includes(j.status)) return false;
      } else if (jobFilter.status !== "All" && j.status !== jobFilter.status) {
        return false;
      }
      const q = jobFilter.q.trim().toLowerCase();
      if (!q) return true;
      return [j.jobNumber, j.clientName, j.clientPhone, j.title].join(" ").toLowerCase().includes(q);
    });
  }, [jobs, jobFilter, can]);

  const goToJobsFiltered = (statusKey) => { setJobFilter({ status: statusKey, q: "" }); setActiveJobId(null); setView("jobs"); };
  const goToReports = () => { setActiveJobId(null); setView("reports"); };

  const createJob = (data) => {
    const { advanceAmount, advanceReceipt, ...clientData } = data;
    const jobNumber = `HAD-2026-${String(jobCounter.current++).padStart(4, "0")}`;
    const job = emptyJob({ ...clientData, jobNumber });
    job.activity = [{ ts: new Date().toISOString(), text: `Job created by ${role}` }];
    if (advanceAmount) {
      job.payments = [{
        id: nid("p"), amount: Number(advanceAmount) || 0, type: "Advance", method: "Recorded at job creation",
        date: new Date().toISOString().slice(0, 10), notes: "", receipt: advanceReceipt,
      }];
      job.activity.unshift({ ts: new Date().toISOString(), text: `Advance payment of ${fmtETB(Number(advanceAmount) || 0)} recorded at job creation by ${role}` });
    }
    setJobs((prev) => [job, ...prev]);
    openJob(job.id);
  };

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "jobs", label: "Jobs", icon: Briefcase },
    { id: "calculator", label: "Price Database", icon: Calculator },
    { id: "inventory", label: "Inventory", icon: Boxes },
    { id: "reconciliation", label: "Reconciliation", icon: Scale },
    { id: "users", label: "Users", icon: UsersIcon },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ].filter((n) => canSeePage(n.id));

  const logout = () => { setCurrentUserId(null); setView("dashboard"); setActiveJobId(null); };

  if (!currentUser) {
    return (
      <div className="hadar-root" style={{ minHeight: 600 }}>
        <style>{TOKENS}</style>
        <LoginScreen users={users} onLogin={(u) => setCurrentUserId(u.id)} />
      </div>
    );
  }

  return (
    <div className="hadar-root scrollbar-thin" style={{ position: "relative" }}>
      <style>{TOKENS}</style>

      {/* Sidebar (desktop) */}
      <div className="no-print" style={{ width: 216, flexShrink: 0, borderRight: "1px solid var(--border)", padding: "16px 12px", display: window.innerWidth < 720 ? "none" : "flex", flexDirection: "column", gap: 2 }}>
        <Brand />
        <div style={{ height: 14 }} />
        {NAV.map((n) => (
          <div key={n.id} className={`nav-item ${view === n.id ? "active" : ""}`} onClick={() => { setView(n.id); setActiveJobId(null); }}>
            <n.icon size={15} /> {n.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div className="card-2" style={{ padding: 10, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
          Prototype — client-side only.<br />Data resets on reload.
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="no-print" style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,.6)" }} onClick={() => setMobileNavOpen(false)}>
          <div className="card" style={{ width: 220, height: "100%", padding: 14 }} onClick={(e) => e.stopPropagation()}>
            <Brand />
            <div style={{ height: 14 }} />
            {NAV.map((n) => (
              <div key={n.id} className={`nav-item ${view === n.id ? "active" : ""}`} onClick={() => { setView(n.id); setActiveJobId(null); setMobileNavOpen(false); }}>
                <n.icon size={15} /> {n.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <div className="btn btn-ghost" style={{ display: window.innerWidth < 720 ? "inline-flex" : "none" }} onClick={() => setMobileNavOpen(true)}><Menu size={16} /></div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
            {activeJob ? (
              <>
                <span style={{ cursor: "pointer" }} onClick={() => { setView("jobs"); setActiveJobId(null); }}>Jobs</span>
                <ChevronRight size={13} /> <span className="mono" style={{ color: "var(--text)" }}>{activeJob.jobNumber}</span>
              </>
            ) : (
              <span style={{ textTransform: "capitalize", color: "var(--text)", fontWeight: 600 }}>{view}</span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative" }}>
            <div className="btn btn-ghost" onClick={() => setNotifOpen((v) => !v)}>
              <Bell size={16} />
              {notifications.length > 0 && (
                <span style={{ background: "var(--danger)", color: "#fff", fontSize: 10, borderRadius: 100, padding: "0 5px", marginLeft: -4 }}>{notifications.length}</span>
              )}
            </div>
            {notifOpen && (
              <div className="card" style={{ position: "absolute", right: 0, top: 34, width: 260, padding: 8, zIndex: 20 }}>
                {notifications.length === 0 && <div style={{ fontSize: 12, color: "var(--text-dim)", padding: 8 }}>Nothing needs attention.</div>}
                {notifications.map((n) => (
                  <div key={n.id} className="nav-item" onClick={() => { openJob(n.id); setNotifOpen(false); }} style={{ fontSize: 12 }}>
                    <AlertTriangle size={13} color="var(--warn)" /> {n.text}
                  </div>
                ))}
              </div>
            )}
          </div>
          <UserBadge user={currentUser} onLogout={logout} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
          {view === "dashboard" && <Dashboard user={currentUser} can={can} canSeeTab={canSeeTab} role={role} jobs={jobs} onOpenJob={openJob} purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} />}
          {view === "jobs" && (
            <JobsList jobs={filteredJobs} filter={jobFilter} setFilter={setJobFilter} onOpen={openJob} can={can} canSeeTab={canSeeTab}
              onCreate={() => setView("newJob")} onPrint={setPrintDoc} />
          )}
          {view === "newJob" && <NewJobForm onCancel={() => setView("jobs")} onCreate={createJob} can={can} role={role} />}
          {view === "jobDetail" && activeJob && (
            <JobDetail job={activeJob} role={role} can={can} canViewAction={canViewAction} canSeeTab={canSeeTab} priceDatabase={signageMaterials} setInventoryLedger={setInventoryLedger}
              activeTab={activeTab} setActiveTab={setActiveTab}
              patchJob={(fn) => patchJob(activeJob.id, fn)} logJob={logJob}
              onPrint={setPrintDoc} onBack={() => { setView("jobs"); setActiveJobId(null); }} />
          )}
          {view === "calculator" && (
            <SignagePriceDatabase signageMaterials={signageMaterials} setSignageMaterials={setSignageMaterials} canEdit={can("manageSignagePrices")} role={role} />
          )}
          {view === "inventory" && (
            <InventoryPage inventoryLedger={inventoryLedger} setInventoryLedger={setInventoryLedger} signageMaterials={signageMaterials} can={can} role={role} onOpenJob={openJob} jobs={jobs} />
          )}
          {view === "reports" && <Reports jobs={jobs} />}
          {view === "reconciliation" && <ReconciliationView jobs={jobs} can={can} role={role} patchJob={patchJob} logJob={logJob} onOpenJob={openJob} />}
          {view === "users" && <UsersView users={users} setUsers={setUsers} can={can} currentUser={currentUser} />}
          {view === "settings" && <SettingsView withholdingRate={withholdingRate} setWithholdingRate={setWithholdingRate} can={can} />}
        </div>
      </div>

      {printDoc && <PrintOverlay doc={printDoc} job={jobs.find((j) => j.id === printDoc.jobId)} onClose={() => setPrintDoc(null)} />}
    </div>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px" }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#1A1406", fontSize: 13 }}>H</div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: ".01em" }}>Hadar</div>
        <div style={{ fontSize: 9.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Job Management</div>
      </div>
    </div>
  );
}

function UserBadge({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <div style={{ width: 26, height: 26, borderRadius: 100, background: "var(--accent-soft)", color: "var(--accent-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
          {user.name[0]}
        </div>
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{user.name}</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{user.role}</div>
        </div>
        <ChevronDown size={13} color="var(--text-faint)" />
      </div>
      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: 36, width: 170, padding: 6, zIndex: 20 }}>
          <div className="nav-item" onClick={onLogout}><LogOut size={14} /> Log out</div>
        </div>
      )}
    </div>
  );
}

function LoginScreen({ users, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const submit = () => {
    const u = users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u) return setError("No account with that user ID.");
    if (!u.active) return setError("This account has been deactivated. Contact an Admin.");
    if (u.password !== password) return setError("Incorrect password.");
    setError(""); onLogin(u);
  };
  const onKeyDown = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, minHeight: 560 }}>
      <div style={{ width: "100%", maxWidth: 340 }}>
        <Brand />
        <div style={{ height: 22 }} />
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>Every user has their own ID and password. An Admin controls what you can see and do.</div>
          <label className="label">User ID</label>
          <input className="input" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={onKeyDown} placeholder="e.g. netsi" style={{ marginBottom: 10 }} />
          <label className="label">Password</label>
          <div style={{ position: "relative", marginBottom: 6 }}>
            <input className="input" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKeyDown} placeholder="••••••••" style={{ paddingRight: 34 }} />
            <div style={{ position: "absolute", right: 9, top: 8, cursor: "pointer", color: "var(--text-faint)" }} onClick={() => setShowPw((v) => !v)}>
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </div>
          </div>
          {error && <div style={{ fontSize: 11.5, color: "var(--danger)", marginBottom: 8 }}>{error}</div>}
          <button className="btn btn-primary" type="button" onClick={submit} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}><KeyRound size={13} /> Log In</button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR["Draft"];
  return <span className="badge" style={{ background: c.bg, color: c.fg }}>{status}</span>;
}

function DeadlineBadge({ deadline, jobStatus, size = "normal" }) {
  if (!deadline) return null;
  const overdue = new Date(deadline) < new Date() && !["Closed", "Cancelled"].includes(jobStatus);
  const tone = overdue ? { bg: "var(--danger-soft)", fg: "#F0A99F" } : { bg: "var(--warn-soft)", fg: "#F0C878" };
  return (
    <span className="mono" style={{ fontSize: size === "large" ? 12 : 10.5, fontWeight: 700, padding: size === "large" ? "3px 9px" : "1px 6px", borderRadius: 4, background: tone.bg, color: tone.fg, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Clock size={size === "large" ? 12 : 10} /> {overdue ? "Overdue — " : "Due "}{fmtDate(deadline)}
    </span>
  );
}

function Stat({ label, value, sub, tone, onClick }) {
  return (
    <div className="card" style={{ padding: 14, minWidth: 0, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick} onMouseEnter={(e) => { if (onClick) e.currentTarget.style.borderColor = "var(--accent)"; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.borderColor = "var(--border)"; }}>
      <div style={{ fontSize: 10.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {label}{onClick && <ChevronRight size={11} color="var(--text-faint)" />}
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color: tone || "var(--text)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ------------------------------ dashboard ------------------------------- */
function Dashboard({ user, can, canSeeTab, role, jobs, onOpenJob, purchaseOrders, setPurchaseOrders }) {
  const [tab, setTab] = useState(canSeeTab("dash_draft") ? "draft" : "approval");

  const draft = jobs.filter((j) => j.status === "Draft");
  const waitingApproval = jobs.filter((j) => j.status === "Waiting for Approval");
  const approvedBudget = jobs.filter((j) => j.status === "Approved Budget");
  const waitingReconciliation = jobs.filter((j) => j.status === "Waiting for Reconciliation");
  const remainingPayments = useMemo(() => {
    return jobs
      .filter((j) => !["Closed", "Cancelled"].includes(j.status))
      .map((j) => ({ job: j, remaining: getFinancials(j).remaining }))
      .filter((x) => x.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
  }, [jobs]);
  const remainingPaymentsTotal = round2(remainingPayments.reduce((s, x) => s + x.remaining, 0));

  const DASH_TABS = [
    ...(canSeeTab("dash_draft") ? [{ id: "draft", label: "Draft", list: draft, empty: "No draft jobs right now — start a new one from Jobs.", icon: FileBarChart }] : []),
    ...(canSeeTab("dash_approval") ? [{ id: "approval", label: "Waiting for Approval", list: waitingApproval, empty: "No jobs currently waiting for approval.", icon: Clock }] : []),
    ...(canSeeTab("dash_budget") ? [{ id: "budget", label: "Approved Budget", list: approvedBudget, empty: "No jobs currently in implementation with an approved budget.", icon: CheckCircle2 }] : []),
    ...(canSeeTab("dash_reconciliation") ? [{ id: "reconciliation", label: "Waiting for Reconciliation", list: waitingReconciliation, empty: "Nothing waiting on reconciliation right now.", icon: Scale }] : []),
    ...(canSeeTab("dash_remaining") ? [{ id: "remaining", label: "Remaining Payments", list: remainingPayments, empty: "No open project has an outstanding balance right now.", icon: CreditCard, isPayments: true, badgeLabel: fmtETB(remainingPaymentsTotal) }] : []),
    ...(canSeeTab("dash_purchaseOrders") ? [{ id: "purchaseOrders", label: "Purchase Orders", list: purchaseOrders, empty: "", icon: Package, isPurchaseOrders: true }] : []),
  ];
  const active = DASH_TABS.find((t) => t.id === tab) || DASH_TABS[0];

  return (
    <div>
      <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 2 }}>Dashboard</h1>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 16 }}>Welcome back, {user.name} — {user.role}</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {DASH_TABS.map((t) => (
          <div key={t.id} onClick={() => setTab(t.id)}
            className="card" style={{ padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderColor: tab === t.id ? "var(--accent)" : "var(--border)", background: tab === t.id ? "var(--accent-soft)" : "var(--surface)" }}>
            <t.icon size={14} color={tab === t.id ? "var(--accent-text)" : "var(--text-dim)"} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: tab === t.id ? "var(--accent-text)" : "var(--text)" }}>{t.label}</span>
            <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}>{t.badgeLabel ?? t.list.length}</span>
          </div>
        ))}
      </div>

      {active ? (
        active.isPurchaseOrders ? (
          <PurchaseOrdersPanel purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} can={can} role={role} />
        ) : (
          <div className="card" style={{ padding: 14 }}>
            {active.list.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", textAlign: "center", padding: 24 }}>{active.empty}</div>
            ) : active.isPayments ? (
              active.list.map(({ job: j, remaining }) => (
                <div key={j.id} onClick={() => onOpenJob(j.id)} className="hr" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", cursor: "pointer" }}>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--text-dim)", width: 108 }}>{j.jobNumber}</span>
                  <span style={{ flex: 1, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>{j.clientName || "Untitled Client"}<DeadlineBadge deadline={j.deadline} jobStatus={j.status} /></span>
                  <StatusBadge status={j.status} />
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>{fmtETB(remaining)}</span>
                  <ChevronRight size={14} color="var(--text-faint)" />
                </div>
              ))
            ) : (
              active.list.map((j) => (
                <div key={j.id} onClick={() => onOpenJob(j.id)} className="hr" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", cursor: "pointer" }}>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--text-dim)", width: 108 }}>{j.jobNumber}</span>
                  <span style={{ flex: 1, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>{j.clientName || "Untitled Client"}<DeadlineBadge deadline={j.deadline} jobStatus={j.status} /></span>
                  <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{j.title}</span>
                  <StatusBadge status={j.status} />
                  <ChevronRight size={14} color="var(--text-faint)" />
                </div>
              ))
            )}
          </div>
        )
      ) : (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 12.5 }}>
          Nothing available here yet — ask an Admin to grant Dashboard item permissions in Users → Permissions.
        </div>
      )}
    </div>
  );
}

/* --------------------------- purchase orders ------------------------------
   Job-independent purchases. Whoever can submitPurchaseOrder (Supervisor by
   default) fills the form and issues it; it lands Pending until whoever can
   approvePurchaseOrder (Admin by default) approves or rejects it — rejecting
   requires a reason, shown back to whoever issued it.
   ------------------------------------------------------------------------- */
const PO_STATUS_COLOR = {
  Pending: { bg: "var(--warn-soft)", fg: "#F0C878" },
  Approved: { bg: "var(--success-soft)", fg: "#8FD1A8" },
  Rejected: { bg: "var(--danger-soft)", fg: "#F0A99F" },
};
function PurchaseOrdersPanel({ purchaseOrders, setPurchaseOrders, can, role }) {
  const canSubmit = can("submitPurchaseOrder");
  const canApprove = can("approvePurchaseOrder");
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), purchaser: role, item: "", description: "", qty: 1, price: 0, category: "cash" });
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState("");

  const submit = () => {
    if (!f.item.trim()) return;
    const total = round2((Number(f.qty) || 0) * (Number(f.price) || 0));
    setPurchaseOrders((prev) => [poSeed({ ...f, total, history: [{ ts: new Date().toISOString(), text: `Issued by ${role}` }] }), ...prev]);
    setF({ date: new Date().toISOString().slice(0, 10), purchaser: role, item: "", description: "", qty: 1, price: 0, category: "cash" });
  };
  const approve = (id) => setPurchaseOrders((prev) => prev.map((p) => p.id === id ? {
    ...p, status: "Approved", approvedBy: role, approvedAt: new Date().toISOString(),
    history: [...p.history, { ts: new Date().toISOString(), text: `Approved by ${role}` }],
  } : p));
  const reject = (id, note) => {
    setPurchaseOrders((prev) => prev.map((p) => p.id === id ? {
      ...p, status: "Rejected", approvedBy: role, approvedAt: new Date().toISOString(), note,
      history: [...p.history, { ts: new Date().toISOString(), text: `Rejected by ${role} — ${note}` }],
    } : p));
    setRejectingId(null); setRejectNote("");
  };

  return (
    <div>
      {!canSubmit && !canApprove && <LockedNotice role={role} action="view purchase orders" />}
      {canSubmit && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 10 }}>Issue Purchase Order</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, alignItems: "end" }}>
            <div><label className="label">Date</label><input className="input" type="date" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} /></div>
            <div><label className="label">Purchaser</label><input className="input" value={f.purchaser} onChange={(e) => setF((s) => ({ ...s, purchaser: e.target.value }))} /></div>
            <div><label className="label">Item</label><input className="input" placeholder="Item" value={f.item} onChange={(e) => setF((s) => ({ ...s, item: e.target.value }))} /></div>
            <div><label className="label">Description</label><input className="input" placeholder="Optional" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
            <div><label className="label">Category</label>
              <select className="input" value={f.category} onChange={(e) => setF((s) => ({ ...s, category: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="stock">Stock</option>
              </select>
            </div>
            <div><label className="label">Qty</label><input className="input" type="text" inputMode="decimal" value={f.qty} onChange={(e) => setF((s) => ({ ...s, qty: e.target.value }))} /></div>
            <div><label className="label">Price</label><input className="input" type="text" inputMode="decimal" value={f.price} onChange={(e) => setF((s) => ({ ...s, price: e.target.value }))} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Total: {fmtETB((Number(f.qty) || 0) * (Number(f.price) || 0))}</span>
            <button className="btn btn-primary btn-sm" disabled={!f.item.trim()} onClick={submit}><PlusCircle size={12} /> Submit for Approval</button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: "auto" }}>
        <table className="dtable">
          <thead><tr><th>PO #</th><th>Date</th><th>Purchaser</th><th>Item</th><th>Description</th><th>Category</th><th>Qty</th><th>Price</th><th>Total</th><th>Status</th><th className="no-print"></th></tr></thead>
          <tbody>
            {purchaseOrders.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.poNumber}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDate(p.date)}</td>
                <td>{p.purchaser}</td>
                <td>{p.item}</td>
                <td style={{ color: "var(--text-dim)" }}>{p.description || "—"}</td>
                <td><span className="badge" style={{ background: p.category === "stock" ? "var(--info-soft)" : "var(--accent-soft)", color: p.category === "stock" ? "#8FBEE8" : "var(--accent-text)" }}>{p.category === "stock" ? "Stock" : "Cash"}</span></td>
                <td>{p.qty}</td>
                <td className="mono">{fmtETB(p.price)}</td>
                <td className="mono" style={{ fontWeight: 700 }}>{fmtETB(p.total)}</td>
                <td>
                  <span className="badge" style={{ background: PO_STATUS_COLOR[p.status].bg, color: PO_STATUS_COLOR[p.status].fg }}>{p.status}</span>
                  {p.status === "Rejected" && p.note && <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3, maxWidth: 160 }}>{p.note}</div>}
                </td>
                <td className="no-print">
                  {canApprove && p.status === "Pending" && (
                    rejectingId === p.id ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input className="input" style={{ width: 140 }} placeholder="Reason" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                        <button className="btn btn-sm btn-danger" disabled={!rejectNote.trim()} onClick={() => reject(p.id, rejectNote)}>Confirm</button>
                        <button className="btn btn-sm" onClick={() => setRejectingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-sm btn-primary" onClick={() => approve(p.id)}><CheckCircle2 size={11} /> Approve</button>
                        <button className="btn btn-sm btn-danger" onClick={() => setRejectingId(p.id)}><X size={11} /> Reject</button>
                      </div>
                    )
                  )}
                </td>
              </tr>
            ))}
            {purchaseOrders.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: "center", padding: 24, color: "var(--text-faint)" }}>No purchase orders yet.{canSubmit && " Use the form above to issue one."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 6 }}>For purchases outside of any specific project or job order — logged separately from job Expenses.</div>
    </div>
  );
}

/* -------------------------------- jobs ---------------------------------- */
function JobsList({ jobs, filter, setFilter, onOpen, can, canSeeTab, onCreate, onPrint }) {
  const seeFinancials = canSeeTab("tab_payments") || canSeeTab("tab_cost");
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 19, fontWeight: 700, flex: 1 }}>Jobs</h1>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: 9, color: "var(--text-faint)" }} />
          <input className="input" style={{ paddingLeft: 28, width: 220 }} placeholder="Search client, job #, phone"
            value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} />
        </div>
        <select className="input" style={{ width: 190 }} value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
          <option value="All">All</option>
          <option value="Active">Active (open jobs)</option>
          <option value="Outstanding">Has Outstanding Payment</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {can("createJob") && <button className="btn btn-primary" onClick={onCreate}><PlusCircle size={14} /> New Job</button>}
      </div>

      <div className="card" style={{ overflow: "auto" }}>
        <table className="dtable">
          <thead><tr>
            <th>Job ID</th><th>Client</th><th>Status</th><th>Designer</th>
            {seeFinancials && <><th>Final Price</th><th>Advance</th><th>Remaining</th></>}
            <th>Updated</th><th>Record</th><th></th>
          </tr></thead>
          <tbody>
            {jobs.map((j) => {
              const f = getFinancials(j);
              return (
                <tr key={j.id} style={{ cursor: "pointer" }} onClick={() => onOpen(j.id)}>
                  <td className="mono">{j.jobNumber}</td>
                  <td>
                    {j.clientName || <span style={{ color: "var(--text-faint)" }}>Untitled</span>}
                    {j.deadline && <span style={{ marginLeft: 8 }}><DeadlineBadge deadline={j.deadline} jobStatus={j.status} /></span>}
                  </td>
                  <td><StatusBadge status={j.status} /></td>
                  <td>{j.designer || "—"}</td>
                  {seeFinancials && <>
                    <td className="mono">{fmtETB(f.finalPrice)}</td>
                    <td className="mono">{fmtETB(f.advance)}</td>
                    <td className="mono" style={{ color: f.remaining > 0 ? "var(--danger)" : "var(--success)" }}>{fmtETB(f.remaining)}</td>
                  </>}
                  <td style={{ color: "var(--text-dim)" }}>{fmtDate(j.updatedAt)}</td>
                  <td>
                    {j.status === "Closed" && (
                      <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onPrint({ type: "fulljob", jobId: j.id }); }}>
                        <Printer size={11} /> Print
                      </button>
                    )}
                  </td>
                  <td><ChevronRight size={14} color="var(--text-faint)" /></td>
                </tr>
              );
            })}
            {jobs.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 30, color: "var(--text-dim)" }}>
                No jobs match these filters. <span style={{ color: "var(--accent-text)", cursor: "pointer" }} onClick={() => setFilter({ status: "All", q: "" })}>Clear filters</span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewJobForm({ onCancel, onCreate, can, role }) {
  const [f, setF] = useState({ clientName: "", clientContact: "", clientPhone: "", clientAddress: "", title: "", clientNotes: "", advanceAmount: "", advanceReceipt: null });
  const fileRef = useRef(null);
  if (!can("createJob")) {
    return <LockedNotice role={role} action="create a new job" />;
  }
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const handleReceiptUpload = (file) => {
    const reader = new FileReader();
    reader.onload = () => setF((s) => ({ ...s, advanceReceipt: { name: file.name, url: reader.result, kind: classifyArtFile(file) } }));
    reader.readAsDataURL(file);
  };
  const ready = f.clientName.trim() && f.title.trim() && Number(f.advanceAmount) > 0 && f.advanceReceipt;
  return (
    <div style={{ maxWidth: 620 }}>
      <div className="btn btn-ghost" style={{ marginBottom: 10 }} onClick={onCancel}><ArrowLeft size={14} /> Back to jobs</div>
      <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 14 }}>New Job — Client Intake</h1>
      <div className="card" style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1/-1" }}><label className="label">Client / Business Name *</label><input className="input" value={f.clientName} onChange={set("clientName")} placeholder="e.g. Adorsi Coffee" /></div>
        <div><label className="label">Client Contact Name</label><input className="input" value={f.clientContact} onChange={set("clientContact")} /></div>
        <div><label className="label">Phone Number</label><input className="input" value={f.clientPhone} onChange={set("clientPhone")} /></div>
        <div style={{ gridColumn: "1/-1" }}><label className="label">Address / Location</label><input className="input" value={f.clientAddress} onChange={set("clientAddress")} /></div>
        <div style={{ gridColumn: "1/-1" }}><label className="label">Job Title *</label><input className="input" value={f.title} onChange={set("title")} placeholder="e.g. Storefront Signage Package" /></div>
        <div style={{ gridColumn: "1/-1" }}><label className="label">Client Notes</label><textarea className="input" rows={3} value={f.clientNotes} onChange={set("clientNotes")} /></div>
      </div>

      <div className="card" style={{ padding: 18, marginTop: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Advance Payment *</div>
        <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 12 }}>A job can't be created without an advance payment amount and a picture of the payment (receipt, transfer screenshot, etc.).</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label className="label">Amount</label><input className="input" type="text" inputMode="decimal" placeholder="0" value={f.advanceAmount} onChange={set("advanceAmount")} /></div>
          <div>
            <label className="label">Payment Picture</label>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf,image/*,application/pdf" style={{ display: "none" }}
              onChange={(e) => { const file = e.target.files[0]; if (file) handleReceiptUpload(file); }} />
            <button className="btn btn-sm" style={{ width: "100%" }} onClick={() => fileRef.current.click()}>
              <Upload size={12} /> {f.advanceReceipt ? "Replace Picture" : "Upload Picture"}
            </button>
          </div>
        </div>
        {f.advanceReceipt && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <ArtPreview art={f.advanceReceipt} size={44} />
            <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{f.advanceReceipt.name}</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
        <button className="btn btn-primary" disabled={!ready} onClick={() => onCreate(f)}>Create Job (Draft)</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
        {!ready && <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>Client name, job title, advance amount, and a payment picture are all required.</span>}
      </div>
    </div>
  );
}

function LockedNotice({ role, action }) {
  return (
    <div className="card" style={{ padding: 26, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--text-dim)" }}>
      <Lock size={20} />
      <div style={{ fontSize: 13 }}>Your current role — <b style={{ color: "var(--text)" }}>{role}</b> — can't {action}.</div>
      <div style={{ fontSize: 11.5 }}>Switch roles from the top bar to test other permission levels.</div>
    </div>
  );
}

/* ------------------------------ job detail ------------------------------- */
function JobDetail({ job, role, can, canViewAction, canSeeTab, priceDatabase, setInventoryLedger, activeTab, setActiveTab, patchJob, logJob, onPrint, onBack }) {
  const fin = getFinancials(job);
  const locked = job.monitoring.closed || job.status === "Cancelled";
  // Design / Cut List / Cost Estimate / Budget lock the moment a job reaches
  // Approved Budget or later — an Admin with editApprovedJob can toggle
  // job.adminUnlocked to reopen them for editing (Admin only, still).
  const pastApproval = ["Approved Budget", "Waiting for Reconciliation"].includes(job.status);
  const contentLocked = locked || (pastApproval && !(job.adminUnlocked && can("editApprovedJob")));
  const stage = STAGE_FOR_STATUS[job.status];

  const seeFinancials = canSeeTab("tab_budget") || canSeeTab("tab_payments");
  const tabs = [
    ...(canSeeTab("tab_overview") ? [{ id: "overview", label: "Overview" }] : []),
    ...(canSeeTab("tab_design") ? [{ id: "design", label: "Design" }] : []),
    ...(canSeeTab("tab_cutlist") ? [{ id: "cutlist", label: "Cut List" }] : []),
    ...(canSeeTab("tab_cost") ? [{ id: "cost", label: "Cost Estimate" }] : []),
    ...(canSeeTab("tab_budget") ? [{ id: "budget", label: "Budget" }] : []),
    ...(canSeeTab("tab_expenses") ? [{ id: "expenses", label: "Expenses" }] : []),
    ...(canSeeTab("tab_payments") ? [{ id: "payments", label: "Payments & Profit" }] : []),
    ...(canSeeTab("tab_activity") ? [{ id: "activity", label: "Activity" }] : []),
  ];

  const setStatus = (status, text) => patchJob((j) => logJob({ ...j, status }, text));

  return (
    <div>
      <div className="btn btn-ghost no-print" style={{ marginBottom: 10 }} onClick={onBack}><ArrowLeft size={14} /> Back to jobs</div>

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono" style={{ color: "var(--text-dim)", fontSize: 12 }}>{job.jobNumber}</span>
              <StatusBadge status={job.status} />
              {locked && <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}><Lock size={10} /> Closed & Locked</span>}
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
              {job.clientName || "Untitled Client"}
              <DeadlineBadge deadline={job.deadline} jobStatus={job.status} size="large" />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{job.title}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
            <StatusActions job={job} role={role} can={can} canViewAction={canViewAction} setStatus={setStatus} patchJob={patchJob} logJob={logJob} setActiveTab={setActiveTab} setInventoryLedger={setInventoryLedger} />
            {job.status === "Closed" && (
              <button className="btn btn-sm no-print" onClick={() => onPrint({ type: "fulljob", jobId: job.id })}><Printer size={12} /> Print Full Job Record</button>
            )}
          </div>
        </div>

        {job.status !== "Cancelled" && (
          <div style={{ display: "flex", alignItems: "flex-start", marginTop: 18, gap: 0 }}>
            {PROGRESS_STAGES.map((s, i) => (
              <React.Fragment key={s}>
                <div className="step">
                  <div className={`step-dot ${i < stage ? "done" : i === stage ? "now" : ""}`} />
                  <div style={{ fontSize: 10, color: i <= stage ? "var(--text)" : "var(--text-faint)", fontWeight: i === stage ? 700 : 500 }}>{s}</div>
                </div>
                {i < PROGRESS_STAGES.length - 1 && <div className={`step-line ${i < stage ? "done" : ""}`} />}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 18, borderBottom: "1px solid var(--border)", marginBottom: 16, overflowX: "auto" }} className="no-print">
        {tabs.map((t) => <div key={t.id} className={`tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</div>)}
      </div>

      {activeTab === "overview" && <OverviewTab job={job} fin={fin} seeFinancials={seeFinancials} />}
      {activeTab === "design" && <DesignTab job={job} role={role} can={can} patchJob={patchJob} logJob={logJob} locked={contentLocked} />}
      {activeTab === "cutlist" && <CutListTab job={job} role={role} can={can} patchJob={patchJob} logJob={logJob} locked={contentLocked} />}
      {activeTab === "cost" && <CostEstimateTab job={job} role={role} can={can} canViewAction={canViewAction} priceDatabase={priceDatabase} patchJob={patchJob} logJob={logJob} fin={fin} onPrint={onPrint} locked={contentLocked} />}
      {activeTab === "budget" && <BudgetTab job={job} role={role} can={can} patchJob={patchJob} logJob={logJob} fin={fin} onPrint={onPrint} locked={contentLocked} setInventoryLedger={setInventoryLedger} />}
      {activeTab === "expenses" && <ExpensesTab job={job} role={role} can={can} patchJob={patchJob} logJob={logJob} fin={fin} locked={locked} setInventoryLedger={setInventoryLedger} />}
      {activeTab === "payments" && <PaymentsTab job={job} role={role} can={can} patchJob={patchJob} logJob={logJob} fin={fin} onPrint={onPrint} />}
      {activeTab === "activity" && <ActivityTab job={job} />}
    </div>
  );
}

// "Waiting for Approval" reverses to Draft (Request Revision / rejection).
// "Approved Budget" and "Waiting for Reconciliation" don't have a simple
// linear reverse — the Admin's unlock toggle handles going back into an
// approved job's content instead of un-approving the whole phase.
const REVERSE_STEPS = {
  "Waiting for Approval": { to: "Draft", action: "requestRevision", label: "Request Revision" },
};

function StatusActions({ job, role, can, canViewAction, setStatus, patchJob, logJob, setActiveTab, setInventoryLedger }) {
  const s = job.status;
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [confirmingReopen, setConfirmingReopen] = useState(false);
  // If the user can't perform this action but has been explicitly granted
  // "Allow View" on it, show a muted read-only indicator instead of just
  // hiding the button outright — they can see the step is pending without
  // being able to trigger it.
  const btn = (label, action, editKey, extra) => {
    if (can(editKey)) return <button key={label} className={`btn btn-sm ${extra?.primary ? "btn-primary" : ""}`} onClick={action}>{label}</button>;
    if (canViewAction(editKey)) return <span key={label} className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}><Eye size={10} style={{ verticalAlign: -1 }} /> {label} (view only)</span>;
    return null;
  };

  const [confirmingRevision, setConfirmingRevision] = useState(false);
  const [confirmingApprove, setConfirmingApprove] = useState(false);
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const [revisionDraft, setRevisionDraft] = useState("");
  const reverseStep = REVERSE_STEPS[s];
  const doReverse = (note) => {
    patchJob((j) => logJob({ ...j, status: reverseStep.to, revisionNote: note, revisionNoteBy: role }, `Status reverted to "${reverseStep.to}" by ${role} — ${note}`));
    setConfirmingRevision(false);
    setRevisionDraft("");
  };

  const doCancel = () => {
    patchJob((j) => logJob({ ...j, status: "Cancelled", previousStatus: s }, `Job cancelled by ${role}`));
    setConfirmingCancel(false);
  };
  const doRestore = () => {
    patchJob((j) => logJob({ ...j, status: j.previousStatus || "Draft", previousStatus: null }, `Cancellation undone by ${role} — restored to "${job.previousStatus || "Draft"}"`));
    setConfirmingRestore(false);
  };
  const doReopen = () => {
    patchJob((j) => logJob({ ...j, status: "Waiting for Reconciliation", monitoring: { ...j.monitoring, closed: false, closedAt: null, closedBy: "" } }, `Job reopened by ${role}`));
    setConfirmingReopen(false);
  };
  const toggleUnlock = () => patchJob((j) => logJob({ ...j, adminUnlocked: !j.adminUnlocked }, `${job.adminUnlocked ? "Locked" : "Unlocked"} approved job content by ${role}`));
  const budgetReady = job.budget.items.length > 0;
  const doApproveBudget = (deadline) => {
    patchJob((j) => logJob({
      ...j,
      status: "Approved Budget",
      deadline,
      budget: { ...j.budget, status: "Approved", approvedBy: role, approvedAt: new Date().toISOString() },
    }, `Budget approved by ${role} — job moved to Approved Budget, deadline set to ${fmtDate(deadline)}`));
    // Same auto stock-out behavior as BudgetTab's own Approve button — this
    // header shortcut is a second entry point to the exact same action, so
    // it needs to do the exact same thing.
    const stockLines = job.budget.items.filter((i) => i.category === "stock" && Number(i.qty) > 0);
    if (stockLines.length > 0 && setInventoryLedger) {
      setInventoryLedger((prev) => [
        ...stockLines.map((i) => inventoryEntry({
          direction: "out", materialId: i.materialId || null, itemName: i.label, qty: Number(i.qty), unit: i.unit || "",
          source: `Budget approved — ${job.jobNumber}`, note: `Auto-deducted on budget approval by ${role}`, createdBy: role, jobId: job.id,
        })),
        ...prev,
      ]);
    }
    setConfirmingApprove(false);
    setDeadlineDraft("");
  };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {s === "Draft" && btn("Submit for Approval", () => patchJob((j) => logJob({ ...j, status: "Waiting for Approval", revisionNote: "", revisionNoteBy: "" }, `Job submitted for approval by ${role}`)), "submitForApproval", { primary: true })}

      {reverseStep && can(reverseStep.action) && (
        confirmingRevision ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input className="input" style={{ width: 220 }} placeholder="What needs to change?" value={revisionDraft} onChange={(e) => setRevisionDraft(e.target.value)} />
            <button className="btn btn-sm btn-danger" disabled={!revisionDraft.trim()} onClick={() => doReverse(revisionDraft.trim())}>Send Back</button>
            <button className="btn btn-sm" onClick={() => { setConfirmingRevision(false); setRevisionDraft(""); }}>Never Mind</button>
          </span>
        ) : (
          <button className="btn btn-sm" onClick={() => setConfirmingRevision(true)}>{reverseStep.label}</button>
        )
      )}
      {reverseStep && !can(reverseStep.action) && canViewAction(reverseStep.action) && (
        <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}><Eye size={10} style={{ verticalAlign: -1 }} /> {reverseStep.label} (view only)</span>
      )}

      {s === "Approved Budget" && can("submitForReconciliation") && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <button className="btn btn-primary btn-sm" disabled={job.expenses.length === 0} onClick={() => setStatus("Waiting for Reconciliation", `Submitted for reconciliation by ${role}`)}>Submit for Reconciliation</button>
          {job.expenses.length === 0 && <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>Log at least one expense first</span>}
        </span>
      )}
      {s === "Approved Budget" && !can("submitForReconciliation") && canViewAction("submitForReconciliation") && (
        <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}><Eye size={10} style={{ verticalAlign: -1 }} /> Submit for Reconciliation (view only)</span>
      )}

      {["Approved Budget", "Waiting for Reconciliation"].includes(s) && can("editApprovedJob") && (
        <button className={`btn btn-sm ${job.adminUnlocked ? "btn-danger" : ""}`} onClick={toggleUnlock}>
          {job.adminUnlocked ? <><Lock size={12} /> Lock Again</> : <><KeyRound size={12} /> Unlock for Editing</>}
        </button>
      )}
      {["Approved Budget", "Waiting for Reconciliation"].includes(s) && !can("editApprovedJob") && canViewAction("editApprovedJob") && job.adminUnlocked && (
        <span className="badge" style={{ background: "var(--warn-soft)", color: "#F0C878" }}><Eye size={10} style={{ verticalAlign: -1 }} /> Unlocked for editing by Admin</span>
      )}

      {s === "Closed" && can("reopenJob") && (
        confirmingReopen ? (
          <>
            <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Reopen this job?</span>
            <button className="btn btn-sm btn-danger" onClick={doReopen}>Confirm Reopen</button>
            <button className="btn btn-sm" onClick={() => setConfirmingReopen(false)}>Never Mind</button>
          </>
        ) : (
          <button className="btn btn-sm" onClick={() => setConfirmingReopen(true)}><Undo2 size={12} /> Reopen Job</button>
        )
      )}
      {s === "Closed" && !can("reopenJob") && canViewAction("reopenJob") && (
        <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}><Eye size={10} style={{ verticalAlign: -1 }} /> Reopen Job (view only)</span>
      )}

      {s === "Cancelled" && can("cancelJob") && (
        confirmingRestore ? (
          <>
            <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Restore to "{job.previousStatus || "Draft"}"?</span>
            <button className="btn btn-sm btn-primary" onClick={doRestore}>Confirm Restore</button>
            <button className="btn btn-sm" onClick={() => setConfirmingRestore(false)}>Never Mind</button>
          </>
        ) : (
          <button className="btn btn-sm" onClick={() => setConfirmingRestore(true)}><Undo2 size={12} /> Restore Job</button>
        )
      )}
      {s === "Cancelled" && !can("cancelJob") && canViewAction("cancelJob") && (
        <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}><Eye size={10} style={{ verticalAlign: -1 }} /> Restore Job (view only)</span>
      )}

      {/* Approve Budget sits right next to Cancel Job, as requested */}
      {s === "Waiting for Approval" && can("approveBudget") && (
        confirmingApprove ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Deadline:</span>
            <input className="input" type="date" style={{ width: 150 }} value={deadlineDraft} onChange={(e) => setDeadlineDraft(e.target.value)} />
            <button className="btn btn-primary btn-sm" disabled={!deadlineDraft} onClick={() => doApproveBudget(deadlineDraft)}><CheckCircle2 size={12} /> Confirm Approval</button>
            <button className="btn btn-sm" onClick={() => { setConfirmingApprove(false); setDeadlineDraft(""); }}>Never Mind</button>
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <button className="btn btn-primary btn-sm" disabled={!budgetReady} onClick={() => setConfirmingApprove(true)}>
              <CheckCircle2 size={12} /> Approve Budget &amp; Move to Implementation
            </button>
            {!budgetReady && <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>Fill in the Budget tab first</span>}
          </span>
        )
      )}
      {s === "Waiting for Approval" && !can("approveBudget") && canViewAction("approveBudget") && (
        <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}><Eye size={10} style={{ verticalAlign: -1 }} /> Approve Budget (view only)</span>
      )}

      {!["Closed", "Cancelled"].includes(s) && can("cancelJob") && (
        confirmingCancel ? (
          <>
            <button className="btn btn-sm btn-danger" onClick={doCancel}>Confirm Cancel</button>
            <button className="btn btn-sm" onClick={() => setConfirmingCancel(false)}>Never Mind</button>
          </>
        ) : (
          <button className="btn btn-sm" onClick={() => setConfirmingCancel(true)}>Cancel Job</button>
        )
      )}
      {!["Closed", "Cancelled"].includes(s) && !can("cancelJob") && canViewAction("cancelJob") && (
        <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}><Eye size={10} style={{ verticalAlign: -1 }} /> Cancel Job (view only)</span>
      )}
    </div>
  );
}

function OverviewTab({ job, fin, seeFinancials }) {
  const advancePayment = job.payments.find((p) => p.type === "Advance" && p.receipt);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: seeFinancials ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Client</div>
          <Field k="Business" v={job.clientName} /><Field k="Contact" v={job.clientContact} />
          <Field k="Phone" v={job.clientPhone} /><Field k="Address" v={job.clientAddress} />
          {job.clientNotes && <Field k="Notes" v={job.clientNotes} />}
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Team & Timing</div>
          <Field k="Designer" v={job.designer || "Unassigned"} /><Field k="Supervisor" v={job.supervisor || "Unassigned"} />
          <Field k="Created" v={fmtDate(job.createdAt)} /><Field k="Last Updated" v={fmtDate(job.updatedAt)} />
          <Field k="Sign Description Items" v={`${job.components.length}`} />
        </div>
        {seeFinancials ? (
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Financial Snapshot</div>
            <Field k="Final Price" v={fmtETB(fin.finalPrice)} mono /><Field k="Advance Received" v={fmtETB(fin.advance)} mono />
            <Field k="Remaining" v={fmtETB(fin.remaining)} mono /><Field k="Est. Profit" v={fmtETB(fin.profitAmount)} mono />
            <Field k="Profit %" v={`${fin.profitPercent}%`} mono />
          </div>
        ) : null}
      </div>

      {advancePayment && (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 10 }}>Advance Payment</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <ArtPreview art={advancePayment.receipt} size={72} />
            <div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{fmtETB(advancePayment.amount)}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{fmtDate(advancePayment.date)} · {advancePayment.receipt.name}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Field({ k, v, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border-soft)", fontSize: 12.5 }}>
      <span style={{ color: "var(--text-dim)" }}>{k}</span>
      <span className={mono ? "mono" : ""} style={{ textAlign: "right", whiteSpace: "pre-wrap" }}>{v || "—"}</span>
    </div>
  );
}

/* -------------------------------- design tab ------------------------------ */
function DesignTab({ job, role, can, patchJob, logJob, locked }) {
  const editable = can("editDesign") && !locked;
  const set = (k) => (e) => patchJob((j) => ({ ...j, [k]: e.target.value }));
  const addComponent = () => patchJob((j) => ({
    ...j, components: [...j.components, { id: nid("c"), name: "", width: 0, height: 0, qty: 1, ledColor: "", art: null }],
  }));
  const updateComp = (id, patch) => patchJob((j) => ({ ...j, components: j.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const removeComp = (id) => patchJob((j) => ({ ...j, components: j.components.filter((c) => c.id !== id) }));

  return (
    <div>
      {locked && job.monitoring.closed && <ClosedBanner />}
      {!editable && !locked && <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>Design is locked for the current status/role. {can("requestRevision") ? "Use \u201cRequest Revision\u201d above to reopen editing." : ""}</div>}
      {job.status === "Draft" && job.revisionNote && (
        <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--danger-soft)", border: "1px solid var(--danger)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={15} color="#F0A99F" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#F0A99F" }}>Revision requested by {job.revisionNoteBy}</div>
              <div style={{ fontSize: 12.5, color: "var(--text)", marginTop: 2, whiteSpace: "pre-wrap" }}>{job.revisionNote}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Design Fields</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label className="label">Designer</label><input className="input" disabled={!editable} value={job.designer} onChange={set("designer")} /></div>
          <div style={{ gridColumn: "1/-1" }}>
            <label className="label">Production Notes (supports Amharic)</label>
            <textarea className="input" rows={3} disabled={!editable} value={job.productionNotes} onChange={set("productionNotes")} placeholder="Workshop instructions..." />
          </div>
          {job.budget.status === "Approved" && (
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Job package approved (via Budget) by <b style={{ color: "var(--text)" }}>{job.budget.approvedBy}</b> on {fmtDateTime(job.budget.approvedAt)}</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Sign Description</div>
        {editable && <button className="btn btn-primary btn-sm" onClick={addComponent}><PlusCircle size={13} /> Add Item</button>}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {job.components.map((c) => (
          <ComponentRow key={c.id} c={c} editable={editable} onChange={(p) => updateComp(c.id, p)} onRemove={() => removeComp(c.id)} />
        ))}
        {job.components.length === 0 && <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 12.5 }}>No sign description items yet. {editable && "Add the first one to start the design spec."}</div>}
      </div>
    </div>
  );
}

function classifyArtFile(file) {
  const name = (file.name || "").toLowerCase();
  const type = file.type || "";
  if (type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/.test(name)) return "image";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".ai") || type === "application/postscript" || type === "application/illustrator") return "ai";
  return "other";
}

function ArtPreview({ art, size = 40 }) {
  const [showBig, setShowBig] = useState(false);
  if (!art) return null;
  const boxStyle = { width: size, height: size, borderRadius: 4, border: "1px solid var(--border)", overflow: "hidden", position: "relative", flexShrink: 0, cursor: "pointer" };
  const openBig = (e) => { e.preventDefault(); setShowBig(true); };
  if (art.kind === "image") {
    return (
      <>
        <div style={boxStyle} onClick={openBig} title="Click to view full size"><img src={art.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
        {showBig && <ArtLightbox art={art} onClose={() => setShowBig(false)} />}
      </>
    );
  }
  if (art.kind === "pdf" || art.kind === "ai") {
    const tag = art.kind === "pdf" ? { label: "PDF", bg: "var(--danger-soft)", fg: "#F0A99F" } : { label: "AI", bg: "var(--warn-soft)", fg: "#F0C878" };
    return (
      <>
        <a href={art.url} download={art.name} title="Click to view full size" onClick={openBig} style={{ ...boxStyle, display: "block", textDecoration: "none" }}>
          <embed src={art.url} type="application/pdf" style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
          <span style={{ position: "absolute", bottom: 1, right: 1, fontSize: 7, fontWeight: 800, padding: "1px 3px", borderRadius: 3, background: tag.bg, color: tag.fg }}>{tag.label}</span>
        </a>
        {showBig && <ArtLightbox art={art} onClose={() => setShowBig(false)} />}
      </>
    );
  }
  return (
    <a href={art.url} download={art.name} title={`Open or save ${art.name}`}
      style={{ ...boxStyle, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-3)", color: "var(--text-dim)", fontSize: 9, fontWeight: 800, textDecoration: "none" }}>
      FILE
    </a>
  );
}

function ArtLightbox({ art, onClose }) {
  return (
    <div className="print-overlay no-print" onClick={onClose}>
      <div className="print-sheet" style={{ background: "var(--surface)", padding: 20, maxWidth: 900, height: "85vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{art.name}</div>
          <button className="btn btn-sm" onClick={onClose}><X size={14} /> Close</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, borderRadius: 8, overflow: "hidden", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {art.kind === "image" ? (
            <img src={art.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          ) : art.kind === "pdf" || art.kind === "ai" ? (
            <embed src={art.url} type="application/pdf" style={{ width: "100%", height: "100%" }} />
          ) : (
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>No preview available for this file type.</div>
          )}
        </div>
        <a className="btn btn-sm" style={{ marginTop: 12, alignSelf: "flex-start", textDecoration: "none" }} href={art.url} download={art.name}>Download / Open Original</a>
      </div>
    </div>
  );
}

function ComponentRow({ c, editable, onChange, onRemove }) {
  const fileRef = useRef(null);
  const [showBig, setShowBig] = useState(false);
  const maxDim = 110;
  const scale = Math.min(maxDim / Math.max(c.width, 0.1), maxDim / Math.max(c.height, 0.1), 60);
  const pw = Math.max(6, c.width * scale), ph = Math.max(6, c.height * scale);
  return (
    <div className="card" style={{ padding: 12, display: "grid", gridTemplateColumns: "128px 1fr", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div className="mat-preview" style={{ width: 118, height: 118, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", cursor: c.art ? "pointer" : "default" }}
          onClick={() => c.art && setShowBig(true)} title={c.art ? "Click to view full size" : ""}>
          {c.art && c.art.kind === "image" ? (
            <img src={c.art.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          ) : c.art && (c.art.kind === "pdf" || c.art.kind === "ai") ? (
            <>
              <embed src={c.art.url} type="application/pdf" style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
              <span style={{ position: "absolute", bottom: 2, right: 2, fontSize: 8, fontWeight: 800, padding: "1px 4px", borderRadius: 3, background: c.art.kind === "pdf" ? "var(--danger-soft)" : "var(--warn-soft)", color: c.art.kind === "pdf" ? "#F0A99F" : "#F0C878" }}>
                {c.art.kind.toUpperCase()}
              </span>
            </>
          ) : (
            <div style={{ width: pw, height: ph, borderRadius: 3, background: "var(--accent-soft)", border: "1.5px solid var(--accent)" }} />
          )}
        </div>
        {c.art && <div style={{ fontSize: 8.5, color: "var(--accent-text)" }}>Click to enlarge</div>}
        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{c.width || 0}×{c.height || 0} m</div>
        {editable && (
          <>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf,.ai,image/*,application/pdf,application/postscript,application/illustrator" style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => onChange({ art: { name: f.name, url: reader.result, kind: classifyArtFile(f) } });
                reader.readAsDataURL(f);
              }} />
            <button className="btn btn-sm" onClick={() => fileRef.current.click()}><Upload size={11} /> {c.art ? "Replace Art" : "Upload Art"}</button>
          </>
        )}
        {c.art && (
          <div style={{ fontSize: 9.5, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110, textAlign: "center" }}>{c.art.name}</div>
        )}
        <div style={{ fontSize: 9, color: "var(--text-faint)" }}>JPEG, PDF, or AI</div>
        {c.art && c.art.kind === "ai" && <div style={{ fontSize: 8.5, color: "var(--text-faint)", textAlign: "center" }}>Blank preview? Open the file — some .ai exports skip the embedded PDF.</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
          <input className="input" disabled={!editable} placeholder="Item name" value={c.name} onChange={(e) => onChange({ name: e.target.value })} />
          {editable && <button className="btn btn-sm btn-danger" onClick={onRemove}><Trash2 size={12} /></button>}
        </div>
        <div><label className="label">Width (m)</label><input className="input" type="text" inputMode="decimal" disabled={!editable} value={c.width} onChange={(e) => onChange({ width: e.target.value })} /></div>
        <div><label className="label">Height (m)</label><input className="input" type="text" inputMode="decimal" disabled={!editable} value={c.height} onChange={(e) => onChange({ height: e.target.value })} /></div>
        <div><label className="label">Qty</label><input className="input" type="text" inputMode="numeric" disabled={!editable} value={c.qty} onChange={(e) => onChange({ qty: e.target.value })} /></div>
        <div style={{ gridColumn: "1/-1" }}><label className="label">LED Colour</label><input className="input" disabled={!editable} placeholder="e.g. Warm White, RGB, custom mix..." value={c.ledColor} onChange={(e) => onChange({ ledColor: e.target.value })} /></div>
      </div>
      {showBig && c.art && <ArtLightbox art={c.art} onClose={() => setShowBig(false)} />}
    </div>
  );
}

function ClosedBanner() {
  return (
    <div className="card" style={{ padding: 10, marginBottom: 12, display: "flex", gap: 8, alignItems: "center", background: "var(--success-soft)", border: "1px solid var(--success)" }}>
      <CheckCircle2 size={15} color="var(--success)" />
      <span style={{ fontSize: 12.5 }}>This job is closed. Financial records are locked for audit integrity.</span>
    </div>
  );
}

/* ------------------------------- cut list -------------------------------- */
function CutListTab({ job, role, can, patchJob, logJob, locked }) {
  const editable = can("editCutList") && !locked;
  const fileRef = useRef(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const addFiles = (fileList) => {
    [...fileList].forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        patchJob((j) => logJob({
          ...j,
          cutFiles: [...(j.cutFiles || []), { id: nid("cf"), name: f.name, url: reader.result, kind: classifyArtFile(f), uploadedBy: role, uploadedAt: new Date().toISOString() }],
        }, `Cut file uploaded — ${f.name} (by ${role})`));
      };
      reader.readAsDataURL(f);
    });
  };
  const removeFile = (id) => patchJob((j) => logJob({ ...j, cutFiles: (j.cutFiles || []).filter((f) => f.id !== id) }, `Cut file removed by ${role}`));

  const files = job.cutFiles || [];

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Material Cut List</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
          Upload the cut file straight from the workshop's nesting or CNC export — PDF, AI, or JPEG. This replaces the paper cutting guide handed to the workshop.
        </div>
        {editable && (
          <>
            <input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.ai,image/*,application/pdf,application/postscript,application/illustrator"
              style={{ display: "none" }} onChange={(e) => { if (e.target.files.length) addFiles(e.target.files); e.target.value = ""; }} />
            <button className="btn btn-primary btn-sm" onClick={() => fileRef.current.click()}><Upload size={13} /> Upload Cut File</button>
            <span style={{ fontSize: 10.5, color: "var(--text-faint)", marginLeft: 8 }}>JPEG, PDF, or AI · multiple files allowed</span>
          </>
        )}
      </div>

      {files.length === 0 ? (
        <div className="card" style={{ padding: 26, textAlign: "center", color: "var(--text-dim)", fontSize: 12.5 }}>
          No cut file uploaded yet. {editable && "Use \u201cUpload Cut File\u201d above once the workshop layout is ready."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 12 }}>
          {files.map((f) => (
            <div key={f.id} className="card" style={{ padding: 12 }}>
              <div className="mat-preview" style={{ width: "100%", height: 150, position: "relative", overflow: "hidden", marginBottom: 8 }}>
                {f.kind === "image" ? (
                  <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (f.kind === "pdf" || f.kind === "ai") ? (
                  <>
                    <embed src={f.url} type="application/pdf" style={{ width: "100%", height: "100%" }} />
                    <span style={{ position: "absolute", bottom: 3, right: 3, fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 3, background: f.kind === "pdf" ? "var(--danger-soft)" : "var(--warn-soft)", color: f.kind === "pdf" ? "#F0A99F" : "#F0C878" }}>
                      {f.kind.toUpperCase()}
                    </span>
                  </>
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 11 }}>No preview</div>
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginBottom: 8 }}>{f.uploadedBy} · {fmtDateTime(f.uploadedAt)}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <a className="btn btn-sm" href={f.url} download={f.name} style={{ textDecoration: "none" }}>Open</a>
                {editable && (
                  confirmDeleteId === f.id ? (
                    <>
                      <button className="btn btn-sm btn-danger" onClick={() => { removeFile(f.id); setConfirmDeleteId(null); }}>Confirm</button>
                      <button className="btn btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn btn-sm btn-danger" onClick={() => setConfirmDeleteId(f.id)}><Trash2 size={11} /></button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- cost estimate ------------------------------ */
function CostEstimateTab({ job, role, can, canViewAction, priceDatabase, patchJob, logJob, fin, onPrint, locked }) {
  const editable = can("manageCostEstimate") && !locked;
  const canAddItem = can("addCostEstimateItem") && !locked;
  const canSeeSalePrice = canViewAction("manageSalePriceProfit");
  const canEditSalePrice = can("manageSalePriceProfit") && !locked;
  const canEditNotes = can("manageCostEstimateNotes") && !locked;
  const items = job.costEstimate.items;

  // Setting a material's qty upserts/removes its line in job.costEstimate.items,
  // matched by materialId. This is the single source of truth for every row
  // shown in the catalog sheet below.
  const setQty = (mat, qtyRaw) => {
    patchJob((j) => {
      const list = j.costEstimate.items;
      const existingIdx = list.findIndex((i) => i.materialId === mat.id);
      // Only clear the row when the field is genuinely emptied — not when the
      // number happens to evaluate to <=0 mid-type (e.g. typing "0" before
      // "0.1" or "0.25"), which previously wiped the input on every keystroke
      // for any quantity under 1.
      if (qtyRaw === "") {
        if (existingIdx === -1) return j; // nothing to remove, avoid a no-op update
        return { ...j, costEstimate: { ...j.costEstimate, items: list.filter((_, idx) => idx !== existingIdx) } };
      }
      const qtyNum = Number(qtyRaw) || 0;
      const total = round2(qtyNum * mat.rate);
      if (existingIdx === -1) {
        const newItem = { id: nid("ce"), materialId: mat.id, name: mat.name, category: mat.category, unit: mat.unit, qty: qtyRaw, unitPrice: mat.rate, total, source: "Manual", comment: "" };
        return { ...j, costEstimate: { ...j.costEstimate, items: [...list, newItem] } };
      }
      const updated = [...list];
      updated[existingIdx] = { ...updated[existingIdx], qty: qtyRaw, total };
      return { ...j, costEstimate: { ...j.costEstimate, items: updated } };
    });
  };

  const updateItem = (id, patch) => patchJob((j) => ({ ...j, costEstimate: { ...j.costEstimate, items: j.costEstimate.items.map((i) => i.id === id ? { ...i, ...patch, total: round2((patch.qty ?? i.qty) * (patch.unitPrice ?? i.unitPrice)) } : i) } }));
  const removeItem = (id) => patchJob((j) => ({ ...j, costEstimate: { ...j.costEstimate, items: j.costEstimate.items.filter((i) => i.id !== id) } }));
  const updateNotes = (val) => patchJob((j) => ({ ...j, costEstimate: { ...j.costEstimate, notes: val } }));
  const totals = calc.costEstimateTotals(items);
  const commissionAmount = job.costEstimate.commissionActive ? round2(totals.grand * 0.07) : 0;
  const profitAmount = round2((Number(job.costEstimate.soldPrice) || 0) - totals.grand - commissionAmount);

  const activeMaterials = priceDatabase.filter((m) => m.active);
  // Ad-hoc items (added directly via "Add Item") live inside their
  // category's table alongside the catalog rows, rather than a separate section.
  const isOrphan = (i) => !i.materialId || !activeMaterials.some((m) => m.id === i.materialId);
  const addAdHocItem = (category, data) => {
    const qty = data.qty === "" ? 1 : data.qty;
    const unitPrice = Number(data.rate) || 0;
    patchJob((j) => logJob({
      ...j, costEstimate: { ...j.costEstimate, items: [...j.costEstimate.items, { id: nid("ce"), name: data.name, category, unit: data.unit, qty, unitPrice, total: round2((Number(qty) || 0) * unitPrice), source: "Manual", comment: "" }] },
    }, `${data.name} added to ${category === "cash" ? "Cash" : "Stock"} Items by ${role}`));
  };

  return (
    <div>
      {!editable && <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>You don't have quantity-filling access to the cost estimate.</div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }} className="no-print">
        <button className="btn btn-sm" onClick={() => onPrint({ type: "cost", jobId: job.id })}><Printer size={12} /> Print / Export PDF</button>
      </div>
      {editable && <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginBottom: 10 }}>Every material in the catalog is listed below — enter a quantity next to whichever ones this job needs.{canAddItem ? ' Or use "Add Item" for something not in the catalog.' : ""}</div>}

      <CatalogFillTable title="Cash Items" category="cash" materialsInCat={activeMaterials.filter((m) => m.category === "cash")} items={items}
        extraItems={items.filter((i) => i.category === "cash" && isOrphan(i))}
        onQtyChange={setQty} onUpdateExtra={updateItem} onRemoveExtra={removeItem} onAddItem={addAdHocItem} editable={editable} canAddItem={canAddItem} />
      <div style={{ height: 14 }} />
      <CatalogFillTable title="Stock Items" category="stock" materialsInCat={activeMaterials.filter((m) => m.category === "stock")} items={items}
        extraItems={items.filter((i) => i.category === "stock" && isOrphan(i))}
        onQtyChange={setQty} onUpdateExtra={updateItem} onRemoveExtra={removeItem} onAddItem={addAdHocItem} editable={editable} canAddItem={canAddItem} />

      <div className="card" style={{ padding: 14, marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 28 }}>
        <Field k="Cash Items Total" v={fmtETB(totals.cash)} mono />
        <Field k="Stock Items Total" v={fmtETB(totals.stock)} mono />
        <div style={{ fontSize: 15, fontWeight: 800 }} className="mono">Sub Total: {fmtETB(totals.grand)}</div>
      </div>

      {canSeeSalePrice && (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Sale Price & Profit</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="label">Sold Price</label>
              {canEditSalePrice ? (
                <input className="input" type="text" inputMode="decimal" value={job.costEstimate.soldPrice}
                  onChange={(e) => patchJob((j) => ({ ...j, costEstimate: { ...j.costEstimate, soldPrice: e.target.value } }))} placeholder="Enter the price quoted to the client" />
              ) : (
                <div className="input mono" style={{ background: "var(--surface)" }}>{fmtETB(job.costEstimate.soldPrice)}</div>
              )}
            </div>
            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Commission (7%)
                <input type="checkbox" disabled={!canEditSalePrice} checked={job.costEstimate.commissionActive}
                  onChange={(e) => patchJob((j) => ({ ...j, costEstimate: { ...j.costEstimate, commissionActive: e.target.checked } }))} />
                <span style={{ fontSize: 10, color: job.costEstimate.commissionActive ? "var(--success)" : "var(--text-faint)", textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>
                  {job.costEstimate.commissionActive ? "Active" : "Inactive"}
                </span>
              </label>
              <div className="input mono" style={{ background: "var(--surface)" }}>{fmtETB(commissionAmount)}</div>
            </div>
          </div>
          <div className="hr" style={{ margin: "14px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <Field k="Profit" v={fmtETB(profitAmount)} mono />
            <div style={{ fontSize: 16, fontWeight: 800 }} className="mono">Grand Total: {fmtETB(Number(job.costEstimate.soldPrice) || 0)}</div>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 8 }}>
            Sub Total = Cash + Stock totals above · Commission = Sub Total × 7% (only when active) · Profit = Sold Price − Sub Total{job.costEstimate.commissionActive ? " − Commission" : ""} · Grand Total = Sold Price
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 14, marginTop: 12 }}>
        <div className="label">Notes / Comments</div>
        {canEditNotes ? (
          <textarea className="input" rows={3} placeholder="General notes on this estimate — pricing assumptions, supplier context, anything worth flagging."
            value={job.costEstimate.notes || ""} onChange={(e) => updateNotes(e.target.value)} />
        ) : (
          <div style={{ fontSize: 12.5, color: job.costEstimate.notes ? "var(--text)" : "var(--text-faint)", whiteSpace: "pre-wrap" }}>{job.costEstimate.notes || "No notes added."}</div>
        )}
      </div>

      {job.costEstimate.preparedBy && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>Prepared by {job.costEstimate.preparedBy} · Generated {fmtDateTime(job.costEstimate.generatedAt)}</div>}
    </div>
  );
}
function CatalogFillTable({ title, category, materialsInCat, items, extraItems, onQtyChange, onUpdateExtra, onRemoveExtra, onAddItem, editable, canAddItem }) {
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ name: "", unit: "", rate: "", qty: "" });
  const submit = () => {
    if (!nf.name.trim()) return;
    onAddItem(category, nf);
    setNf({ name: "", unit: "", rate: "", qty: "" });
    setAdding(false);
  };
  return (
    <div className="card" style={{ overflow: "auto" }}>
      <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{title}</span>
        {canAddItem && !adding && <button className="btn btn-sm no-print" onClick={() => setAdding(true)}><PlusCircle size={12} /> Add Item</button>}
      </div>
      <table className="dtable">
        <thead><tr><th>Material</th><th>Unit</th><th>Unit Price</th><th style={{ minWidth: 90 }}>Qty</th><th>Total</th><th className="no-print"></th></tr></thead>
        <tbody>
          {materialsInCat.map((m) => {
            const existing = items.find((i) => i.materialId === m.id);
            const qty = existing ? existing.qty : "";
            const total = existing ? existing.total : 0;
            return (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.unit || "—"}</td>
                <td className="mono">{fmtETB(m.rate)}</td>
                <td>{editable ? <input className="input" style={{ width: 80 }} type="text" inputMode="decimal" placeholder="0" value={qty} onChange={(e) => onQtyChange(m, e.target.value)} /> : (qty || "—")}</td>
                <td className="mono" style={{ fontWeight: total > 0 ? 700 : 400, color: total > 0 ? "var(--text)" : "var(--text-faint)" }}>{fmtETB(total)}</td>
                <td className="no-print"></td>
              </tr>
            );
          })}
          {extraItems.map((i) => (
            <tr key={i.id}>
              <td>{editable ? <input className="input" value={i.name} onChange={(e) => onUpdateExtra(i.id, { name: e.target.value })} /> : i.name}</td>
              <td>{editable ? <input className="input" style={{ width: 60 }} value={i.unit} onChange={(e) => onUpdateExtra(i.id, { unit: e.target.value })} /> : (i.unit || "—")}</td>
              <td className="mono">{editable ? <input className="input" style={{ width: 90 }} type="text" inputMode="decimal" value={i.unitPrice} onChange={(e) => onUpdateExtra(i.id, { unitPrice: e.target.value })} /> : fmtETB(i.unitPrice)}</td>
              <td>{editable ? <input className="input" style={{ width: 80 }} type="text" inputMode="decimal" value={i.qty} onChange={(e) => onUpdateExtra(i.id, { qty: e.target.value })} /> : i.qty}</td>
              <td className="mono" style={{ fontWeight: 700 }}>{fmtETB(i.total)}</td>
              <td className="no-print">{editable && <button className="btn btn-sm btn-danger" onClick={() => onRemoveExtra(i.id)}><Trash2 size={11} /></button>}</td>
            </tr>
          ))}
          {materialsInCat.length === 0 && extraItems.length === 0 && <tr><td colSpan={6} style={{ color: "var(--text-faint)", textAlign: "center", padding: 16 }}>No {title.toLowerCase()} in the catalog.</td></tr>}
          {adding && (
            <tr className="no-print">
              <td><input className="input" autoFocus placeholder="Item name" value={nf.name} onChange={(e) => setNf((s) => ({ ...s, name: e.target.value }))} /></td>
              <td><input className="input" style={{ width: 60 }} placeholder="unit" value={nf.unit} onChange={(e) => setNf((s) => ({ ...s, unit: e.target.value }))} /></td>
              <td><input className="input" style={{ width: 90 }} type="text" inputMode="decimal" placeholder="price" value={nf.rate} onChange={(e) => setNf((s) => ({ ...s, rate: e.target.value }))} /></td>
              <td><input className="input" style={{ width: 80 }} type="text" inputMode="decimal" placeholder="1" value={nf.qty} onChange={(e) => setNf((s) => ({ ...s, qty: e.target.value }))} /></td>
              <td className="mono">{fmtETB((Number(nf.qty) || 1) * (Number(nf.rate) || 0))}</td>
              <td className="no-print" style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-sm btn-primary" disabled={!nf.name.trim()} onClick={submit}><PlusCircle size={11} /></button>
                <button className="btn btn-sm" onClick={() => { setAdding(false); setNf({ name: "", unit: "", rate: "", qty: "" }); }}><X size={11} /></button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function CostTable({ title, items, editable, onUpdate, onRemove }) {
  return (
    <div className="card" style={{ overflow: "auto" }}>
      <div style={{ padding: "10px 14px", fontWeight: 700, fontSize: 12.5, borderBottom: "1px solid var(--border)" }}>{title}</div>
      <table className="dtable">
        <thead><tr><th>Item</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Source</th><th>Comment</th><th className="no-print"></th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td><td>{i.unit}</td>
              <td>{editable ? <input className="input" style={{ width: 70 }} type="text" inputMode="decimal" value={i.qty} onChange={(e) => onUpdate(i.id, { qty: e.target.value })} /> : i.qty}</td>
              <td className="mono">{editable ? <input className="input" style={{ width: 90 }} type="text" inputMode="decimal" value={i.unitPrice} onChange={(e) => onUpdate(i.id, { unitPrice: e.target.value })} /> : fmtETB(i.unitPrice)}</td>
              <td className="mono">{fmtETB(i.total)}</td>
              <td><span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}>{i.source}</span></td>
              <td>{editable ? <input className="input" style={{ width: 120 }} placeholder="Optional" value={i.comment || ""} onChange={(e) => onUpdate(i.id, { comment: e.target.value })} /> : (i.comment || "—")}</td>
              <td className="no-print">{editable && <button className="btn btn-sm btn-danger" onClick={() => onRemove(i.id)}><Trash2 size={11} /></button>}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={8} style={{ color: "var(--text-faint)", textAlign: "center", padding: 16 }}>No {title.toLowerCase()} yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------- budget --------------------------------- */
function BudgetTab({ job, role, can, patchJob, logJob, fin, onPrint, locked, setInventoryLedger }) {
  const editable = can("manageBudget") && job.budget.status !== "Approved" && !locked && job.status !== "Draft";
  const canApprove = can("approveBudget") && !locked;
  const [confirmingUnapprove, setConfirmingUnapprove] = useState(false);
  const [confirmingApprove, setConfirmingApprove] = useState(false);
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const items = job.budget.items;
  const add = () => patchJob((j) => ({ ...j, budget: { ...j.budget, items: [...j.budget.items, { id: nid("b"), label: "", amount: 0, comment: "", category: "cash", qty: "", unit: "" }] } }));
  const update = (id, patch) => patchJob((j) => ({ ...j, budget: { ...j.budget, items: j.budget.items.map((i) => i.id === id ? { ...i, ...patch } : i) } }));
  const remove = (id) => patchJob((j) => ({ ...j, budget: { ...j.budget, items: j.budget.items.filter((i) => i.id !== id) } }));
  // Pulls one Budget row per Cost Estimate line: Description = material name,
  // Amount = that line's total, Category = cash/stock, and — critically —
  // materialId/qty/unit carried straight over too, so an approved Stock line
  // here can actually be subtracted from Inventory by real quantity, not
  // just an ETB amount. Re-running this refreshes only the rows it
  // previously generated (tagged source: "Cost Estimate") — any rows added
  // by hand (Labor, Contingency, etc.) are left untouched.
  const pullFromCostEstimate = () => {
    const generated = job.costEstimate.items.map((i) => ({ id: nid("b"), label: i.name, amount: i.total, comment: i.comment || "", source: "Cost Estimate", category: i.category, materialId: i.materialId, qty: i.qty, unit: i.unit }));
    const manual = job.budget.items.filter((i) => i.source !== "Cost Estimate");
    patchJob((j) => logJob({ ...j, budget: { ...j.budget, items: [...generated, ...manual] } }, `Budget filled from Cost Estimate by ${role}`));
  };
  // Approving the budget IS the job's overall approval — there's no separate
  // design-approval step anymore. This both marks the budget Approved and
  // advances the job's phase in one action.
  const approve = (deadline) => {
    patchJob((j) => logJob({
      ...j,
      status: j.status === "Waiting for Approval" ? "Approved Budget" : j.status,
      deadline,
      budget: { ...j.budget, status: "Approved", approvedBy: role, approvedAt: new Date().toISOString() },
    }, `Budget approved by ${role}${j.status === "Waiting for Approval" ? " — job moved to Approved Budget" : ""}, deadline set to ${fmtDate(deadline)}`));
    // Automatically subtract every Stock-category budget line (with a real
    // quantity) from Inventory the moment the budget is approved.
    const stockLines = job.budget.items.filter((i) => i.category === "stock" && Number(i.qty) > 0);
    if (stockLines.length > 0 && setInventoryLedger) {
      setInventoryLedger((prev) => [
        ...stockLines.map((i) => inventoryEntry({
          direction: "out", materialId: i.materialId || null, itemName: i.label, qty: Number(i.qty), unit: i.unit || "",
          source: `Budget approved — ${job.jobNumber}`, note: `Auto-deducted on budget approval by ${role}`, createdBy: role, jobId: job.id,
        })),
        ...prev,
      ]);
    }
    setConfirmingApprove(false);
    setDeadlineDraft("");
  };
  const unapprove = () => {
    patchJob((j) => logJob({
      ...j,
      status: j.status === "Approved Budget" ? "Waiting for Approval" : j.status,
      budget: { ...j.budget, status: "Draft", approvedBy: "", approvedAt: null },
    }, `Budget approval undone by ${role} — reopened for editing`));
    // Reverse any auto-generated stock-out entries from the approval this is
    // undoing — added back as offsetting Stock In entries rather than
    // deleted, so the ledger keeps a full, honest audit trail.
    if (setInventoryLedger) {
      setInventoryLedger((prev) => {
        const toReverse = prev.filter((e) => e.jobId === job.id && e.direction === "out" && e.source === `Budget approved — ${job.jobNumber}`);
        if (toReverse.length === 0) return prev;
        const reversals = toReverse.map((e) => inventoryEntry({
          direction: "in", materialId: e.materialId, itemName: e.itemName, qty: e.qty, unit: e.unit,
          source: `Budget approval undone — ${job.jobNumber}`, note: `Reversal of auto-deduction by ${role}`, createdBy: role, jobId: job.id,
        }));
        return [...reversals, ...prev];
      });
    }
    setConfirmingUnapprove(false);
  };

  const statusTone = fin.budgetStatus === "Over Budget" ? "var(--danger)" : fin.budgetStatus === "Under Budget" ? "var(--success)" : "var(--text)";

  if (job.status === "Draft") {
    return <div className="card" style={{ padding: 26, textAlign: "center", color: "var(--text-dim)", fontSize: 12.5 }}>Nothing to review yet — submit the job for approval first, then the budget can be filled in here.</div>;
  }

  return (
    <div>
      {editable && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }} className="no-print">
          <button className="btn btn-sm" onClick={pullFromCostEstimate} disabled={job.costEstimate.items.length === 0}><RefreshCw size={12} /> Pull From Cost Estimate</button>
          {job.costEstimate.items.length === 0 && <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>No Cost Estimate lines to pull yet</span>}
        </div>
      )}
      <div className="card" style={{ overflow: "auto", marginBottom: 12 }}>
        <table className="dtable">
          <thead><tr><th>#</th><th>Description</th><th>Category</th><th>Comment</th><th>Amount (ETB) / Qty</th><th className="no-print"></th></tr></thead>
          <tbody>
            {items.map((i, idx) => {
              const isStock = (i.category || "cash") === "stock";
              return (
                <tr key={i.id}>
                  <td className="mono">{idx + 1}</td>
                  <td>{editable ? <input className="input" value={i.label} onChange={(e) => update(i.id, { label: e.target.value })} /> : i.label}</td>
                  <td>
                    {editable ? (
                      <select className="input" style={{ width: 90 }} value={i.category || "cash"} onChange={(e) => update(i.id, { category: e.target.value })}>
                        <option value="cash">Cash</option>
                        <option value="stock">Stock</option>
                      </select>
                    ) : (
                      <span className="badge" style={{ background: isStock ? "var(--info-soft)" : "var(--accent-soft)", color: isStock ? "#8FBEE8" : "var(--accent-text)" }}>
                        {isStock ? "Stock" : "Cash"}
                      </span>
                    )}
                  </td>
                  <td>{editable ? <input className="input" value={i.comment || ""} placeholder="Optional note" onChange={(e) => update(i.id, { comment: e.target.value })} /> : (i.comment || "—")}</td>
                  <td className="mono">
                    {isStock ? (
                      editable ? (
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <input className="input" style={{ width: 70 }} type="text" inputMode="decimal" placeholder="Qty" value={i.qty ?? ""} onChange={(e) => update(i.id, { qty: e.target.value })} />
                          <input className="input" style={{ width: 60 }} placeholder="unit" value={i.unit || ""} onChange={(e) => update(i.id, { unit: e.target.value })} />
                        </div>
                      ) : (
                        <span>{i.qty || 0} {i.unit || ""}</span>
                      )
                    ) : (
                      editable ? <input className="input" type="text" inputMode="decimal" value={i.amount} onChange={(e) => update(i.id, { amount: e.target.value })} /> : fmtETB(i.amount)
                    )}
                  </td>
                  <td className="no-print">{editable && <button className="btn btn-sm btn-danger" onClick={() => remove(i.id)}><Trash2 size={11} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {editable && <div style={{ padding: 10 }}><button className="btn btn-sm" onClick={add}><PlusCircle size={12} /> Add Row</button></div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 6 }}>
        <Stat label="Total Allocated (Cash)" value={fmtETB(fin.budgetTotal)} />
      </div>
      <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginBottom: 12 }}>Stock items are inventory already on hand — excluded from the approved cash allocation.</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {job.budget.status === "Approved" ? (
          <>
            <div style={{ fontSize: 12, color: "var(--success)" }}><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> Approved by {job.budget.approvedBy} on {fmtDateTime(job.budget.approvedAt)}</div>
            {canApprove && (
              confirmingUnapprove ? (
                <>
                  <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Reopen this budget for editing?</span>
                  <button className="btn btn-sm btn-danger" onClick={unapprove}>Confirm Undo</button>
                  <button className="btn btn-sm" onClick={() => setConfirmingUnapprove(false)}>Never Mind</button>
                </>
              ) : (
                <button className="btn btn-sm" onClick={() => setConfirmingUnapprove(true)}><Undo2 size={12} /> Undo Approval</button>
              )
            )}
          </>
        ) : (
          canApprove && items.length > 0 && (
            confirmingApprove ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Deadline:</span>
                <input className="input" type="date" style={{ width: 150 }} value={deadlineDraft} onChange={(e) => setDeadlineDraft(e.target.value)} />
                <button className="btn btn-primary btn-sm" disabled={!deadlineDraft} onClick={() => approve(deadlineDraft)}>Confirm Approval</button>
                <button className="btn btn-sm" onClick={() => { setConfirmingApprove(false); setDeadlineDraft(""); }}>Never Mind</button>
              </span>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setConfirmingApprove(true)}>Approve Budget</button>
            )
          )
        )}
        <button className="btn btn-sm no-print" onClick={() => onPrint({ type: "budget", jobId: job.id })}><Printer size={12} /> Print</button>
      </div>
    </div>
  );
}

/* --------------------------------- expenses --------------------------------- */
function computeExpenseBudgetFlags(expenses, budgetItems) {
  const allocByLabel = {};
  budgetItems.forEach((b) => { allocByLabel[b.label] = Number(b.amount) || 0; });
  const byRef = {};
  expenses.forEach((e) => {
    const key = e.budgetRef && allocByLabel[e.budgetRef] !== undefined ? e.budgetRef : null;
    if (!key) return;
    (byRef[key] = byRef[key] || []).push(e);
  });
  const flags = {};
  Object.keys(byRef).forEach((ref) => {
    const list = [...byRef[ref]].sort((a, b) => new Date(a.date) - new Date(b.date) || a.id.localeCompare(b.id));
    let running = 0;
    const allocation = allocByLabel[ref];
    list.forEach((e) => { running += e.totalPrice; flags[e.id] = running > allocation ? "Over Budget" : "Within Budget"; });
  });
  expenses.forEach((e) => { if (!flags[e.id]) flags[e.id] = "No Budget Line"; });
  return flags;
}
const BUDGET_FLAG_STYLE = {
  "Over Budget": { bg: "var(--danger-soft)", fg: "#F0A99F" },
  "Within Budget": { bg: "var(--success-soft)", fg: "#8FD1A8" },
  "No Budget Line": { bg: "var(--surface-3)", fg: "var(--text-dim)" },
};

function ExpensesTab({ job, role, can, patchJob, logJob, fin, locked, setInventoryLedger }) {
  const editable = can("manageExpenses") && !locked;
  const canReconcile = can("reconcileBudget");
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), purchaser: role, item: "", qty: 1, unitPrice: 0, budgetRef: "", category: "cash", unit: "" });
  const [f2, setF2] = useState({ date: new Date().toISOString().slice(0, 10), item: "", description: "", amount: 0, budgetRef: "" });
  const [f2Receipt, setF2Receipt] = useState(null);
  const f2FileRef = useRef(null);
  const [flagging, setFlagging] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const receiptRefs = useRef({});

  const add = () => {
    const totalPrice = round2(f.qty * f.unitPrice);
    patchJob((j) => logJob({
      ...j, expenses: [...j.expenses, { id: nid("e"), entryType: "purchase", source: "Manual", category: f.category, purchaser: f.purchaser || role, date: f.date, item: f.item, description: "", qty: f.qty, unit: f.unit, unitPrice: f.unitPrice, budgetRef: f.budgetRef, totalPrice, withholding: calc.withholding(totalPrice), receipt: null, flagged: false }],
    }, `Purchase logged — ${f.item || "item"} (${fmtETB(totalPrice)})`));
    // A manually-logged Stock item is real inventory movement even though it
    // was never budgeted — register it as a Stock Out right away so on-hand
    // balances stay accurate. It still counts fully toward Over Budget in
    // the stats above, same as any other unbudgeted (source !== "Budget")
    // purchase — being registered in Inventory doesn't change that.
    if (f.category === "stock" && setInventoryLedger && Number(f.qty) > 0) {
      setInventoryLedger((prev) => [
        inventoryEntry({
          direction: "out", materialId: null, itemName: f.item, qty: Number(f.qty) || 0, unit: f.unit || "",
          source: `Manual purchase — ${job.jobNumber}`, note: `Logged as a manual (unbudgeted) purchase by ${role}`, createdBy: role, jobId: job.id,
        }),
        ...prev,
      ]);
    }
    setF({ date: new Date().toISOString().slice(0, 10), purchaser: role, item: "", qty: 1, unitPrice: 0, budgetRef: "", category: "cash", unit: "" });
  };
  // Pulls one Purchase row per Budget line (cash and stock alike): Item =
  // description, Qty/Price split by category, budgetRef = the line's label
  // (so the Actual Spent variance below can match it back up). Re-running
  // this refreshes only the rows it previously generated (tagged source:
  // "Budget") — manual entries and Receipts are left untouched.
  const pullFromBudget = () => {
    const generated = job.budget.items.map((i) => {
      const isStock = (i.category || "cash") === "stock";
      const qty = isStock ? (Number(i.qty) || 1) : 1;
      const total = round2(Number(i.amount) || 0);
      const unitPrice = isStock ? round2(total / qty) : total;
      return {
        id: nid("e"), entryType: "purchase", source: "Budget", category: i.category || "cash", purchaser: role, date: new Date().toISOString().slice(0, 10),
        item: i.label, description: i.comment || "", qty, unit: isStock ? (i.unit || "") : "", unitPrice, budgetRef: i.label,
        totalPrice: total, withholding: calc.withholding(total), receipt: null, flagged: false,
      };
    });
    const rest = job.expenses.filter((e) => !(e.entryType === "purchase" && e.source === "Budget"));
    patchJob((j) => logJob({ ...j, expenses: [...generated, ...rest] }, `Purchases filled from Budget (cash & stock) by ${role}`));
  };
  const addReceipt = () => {
    const totalPrice = round2(Number(f2.amount) || 0);
    patchJob((j) => logJob({
      ...j, expenses: [...j.expenses, { id: nid("e"), entryType: "receipt", source: "Manual", purchaser: role, date: f2.date, item: f2.item, description: f2.description, qty: 1, unitPrice: totalPrice, budgetRef: f2.budgetRef, totalPrice, withholding: calc.withholding(totalPrice), receipt: f2Receipt, flagged: false }],
    }, `Receipt logged — ${f2.item || "item"} (${fmtETB(totalPrice)})`));
    setF2({ date: new Date().toISOString().slice(0, 10), item: "", description: "", amount: 0, budgetRef: "" });
    setF2Receipt(null);
  };
  const remove = (id) => patchJob((j) => ({ ...j, expenses: j.expenses.filter((e) => e.id !== id) }));
  // For Stock-category rows, "Actual Spent" means quantity used, not ETB —
  // so any gap between that and the qty already committed to Inventory (the
  // budgeted qty for Budget-sourced rows, or the row's own qty for Manual
  // ones) needs to be reconciled there too. Re-editing this value replaces
  // the previous adjustment rather than stacking another one.
  const setActualSpent = (id, value) => {
    patchJob((j) => ({ ...j, expenses: j.expenses.map((e) => e.id === id ? { ...e, actualSpent: value } : e) }));
    const row = job.expenses.find((e) => e.id === id);
    if (!row || row.category !== "stock" || !setInventoryLedger) return;
    const committedQty = Number(row.qty) || 0;
    const actualQty = value === "" ? committedQty : Number(value) || 0;
    const delta = round2(actualQty - committedQty);
    setInventoryLedger((prev) => {
      const withoutOldAdjustment = prev.filter((e) => e.adjustmentForExpenseId !== id);
      if (delta === 0) return withoutOldAdjustment;
      return [
        inventoryEntry({
          direction: delta > 0 ? "out" : "in", materialId: row.materialId || null, itemName: row.item, qty: Math.abs(delta), unit: row.unit || "",
          source: `Actual spent adjustment — ${job.jobNumber}`, note: `Actual usage (${actualQty}) vs. committed qty (${committedQty})`, createdBy: role, jobId: job.id, adjustmentForExpenseId: id,
        }),
        ...withoutOldAdjustment,
      ];
    });
  };
  const toggleFlag = (id) => patchJob((j) => logJob({ ...j, expenses: j.expenses.map((e) => e.id === id ? { ...e, flagged: !e.flagged } : e) }, `Expense ${job.expenses.find((e) => e.id === id)?.flagged ? "unflagged" : "flagged"} by ${role}`));
  const attachReceipt = (id, file) => {
    const reader = new FileReader();
    reader.onload = () => patchJob((j) => logJob({
      ...j, expenses: j.expenses.map((e) => e.id === id ? { ...e, receipt: { name: file.name, url: reader.result, kind: classifyArtFile(file) } } : e),
    }, `Receipt attached by ${role}`));
    reader.readAsDataURL(file);
  };
  const removeReceipt = (id) => patchJob((j) => ({ ...j, expenses: j.expenses.map((e) => e.id === id ? { ...e, receipt: null } : e) }));
  const setReconciliation = (status, note) => patchJob((j) => logJob({
    ...j, reconciliation: { status, note: note || "", reconciledBy: role, reconciledAt: new Date().toISOString() },
  }, `Reconciliation marked "${status}" by ${role}${note ? ` — ${note}` : ""}`));

  const purchases = job.expenses.filter((e) => (e.entryType || "purchase") === "purchase");
  const receipts = job.expenses.filter((e) => e.entryType === "receipt");
  const collectedReceiptsCount = job.expenses.filter((e) => e.receipt).length;
  // Over/Under Budget in ETB, evaluated per Purchase row:
  //  - Rows pulled from a Budget line compare Actual Spent against that
  //    line's budgeted amount — over the budgeted figure counts toward Over
  //    Budget, under it counts toward Under Budget.
  //  - Manually-added rows were never budgeted for at all, so their full
  //    amount (Actual Spent if filled in, otherwise the entered price)
  //    always counts entirely as Over Budget.
  const purchaseVariance = useMemo(() => {
    let over = 0, under = 0;
    purchases.forEach((e) => {
      const hasActual = e.actualSpent !== undefined && e.actualSpent !== "";
      const isStock = e.category === "stock";
      if (e.source !== "Budget") {
        // Never budgeted for at all — full amount counts entirely as Over Budget.
        over += hasActual && !isStock ? Number(e.actualSpent) || 0 : e.totalPrice;
        return;
      }
      if (!hasActual) return;
      const v = isStock
        ? round2(((Number(e.actualSpent) || 0) - e.qty) * e.unitPrice)
        : round2((Number(e.actualSpent) || 0) - e.totalPrice);
      if (v > 0) over += v;
      else if (v < 0) under += Math.abs(v);
    });
    return { over: round2(over), under: round2(under) };
  }, [purchases]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 12 }}>
        <Stat label="Total Purchases" value={fmtETB(round2(purchases.reduce((s, e) => s + (Number(e.totalPrice) || 0), 0)))} />
        <Stat label="Total Withholding" value={fmtETB(fin.totalWithholding)} />
        <Stat label="Collected Receipts" value={collectedReceiptsCount} tone={collectedReceiptsCount < job.expenses.length ? "var(--warn)" : "var(--success)"} />
        <Stat label="Over Budget" value={fmtETB(purchaseVariance.over)} tone={purchaseVariance.over > 0 ? "var(--danger)" : "var(--text)"} />
        <Stat label="Under Budget" value={fmtETB(purchaseVariance.under)} tone={purchaseVariance.under > 0 ? "var(--success)" : "var(--text)"} />
      </div>

      {/* ---- Sheet 1: Purchases (date · purchaser · item · qty · price) ---- */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Purchases</div>
        {editable && <button className="btn btn-sm no-print" onClick={pullFromBudget} disabled={job.budget.items.length === 0}><RefreshCw size={12} /> Pull From Budget</button>}
      </div>
      <div className="card" style={{ overflow: "auto", maxHeight: 420, marginBottom: 6 }}>
        <table className="dtable">
          <thead><tr>
            <th style={{ minWidth: 90 }}>Date</th><th style={{ minWidth: 90 }}>Purchaser</th>
            <th style={{ minWidth: 170 }}>Item</th><th style={{ minWidth: 90 }}>Category</th><th style={{ minWidth: 55 }}>Qty</th>
            <th style={{ minWidth: 90 }}>Price</th><th style={{ minWidth: 90 }}>Total</th>
            <th style={{ minWidth: 100 }}>Actual Spent</th>
            <th style={{ minWidth: 130 }}>Variance</th>
            <th className="no-print"></th>
          </tr></thead>
          <tbody>
            {purchases.map((e) => {
              const hasActual = e.actualSpent !== undefined && e.actualSpent !== "";
              const isStock = e.category === "stock";
              const isManual = e.source !== "Budget";
              // Manual (unbudgeted) rows always count their full amount as
              // Over Budget, regardless of category or whether Actual Spent
              // is filled in — there was never a budget line to be under.
              // Budget-sourced Cash rows compare Actual Spent (ETB) against
              // the budgeted total. Budget-sourced Stock rows compare Actual
              // Spent (qty) against the budgeted qty, converted to ETB via
              // this row's unit price for a consistent Over/Under badge.
              let varianceEtb = null;
              if (isManual) {
                varianceEtb = hasActual ? Number(e.actualSpent) || 0 : e.totalPrice;
              } else if (hasActual) {
                varianceEtb = isStock
                  ? round2(((Number(e.actualSpent) || 0) - e.qty) * e.unitPrice)
                  : round2((Number(e.actualSpent) || 0) - e.totalPrice);
              }
              return (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
                  <td>{e.purchaser}</td>
                  <td style={{ maxWidth: 220, whiteSpace: "normal", wordBreak: "break-word" }}>{e.item}</td>
                  <td><span className="badge" style={{ background: isStock ? "var(--info-soft)" : "var(--accent-soft)", color: isStock ? "#8FBEE8" : "var(--accent-text)" }}>{isStock ? "Stock" : "Cash"}</span></td>
                  <td>{e.qty}{isStock && e.unit ? ` ${e.unit}` : ""}</td>
                  <td className="mono">{fmtETB(e.unitPrice)}</td>
                  <td className="mono">{fmtETB(e.totalPrice)}</td>
                  <td className="mono">
                    {editable ? (
                      <input className="input" style={{ width: 90 }} type="text" inputMode="decimal" placeholder={isStock ? "Qty not filled" : "Not filled"} value={e.actualSpent ?? ""} onChange={(ev) => setActualSpent(e.id, ev.target.value)} />
                    ) : (
                      hasActual ? (isStock ? `${e.actualSpent} ${e.unit || ""}` : fmtETB(e.actualSpent)) : <span style={{ color: "var(--text-faint)" }}>Not filled</span>
                    )}
                  </td>
                  <td className="mono">
                    {varianceEtb !== null ? (
                      varianceEtb > 0 ? (
                        <span className="badge" style={{ background: "var(--danger-soft)", color: "#F0A99F" }}>Over Budget by {fmtETB(varianceEtb)}</span>
                      ) : varianceEtb < 0 ? (
                        <span className="badge" style={{ background: "var(--success-soft)", color: "#8FD1A8" }}>Under Budget by {fmtETB(Math.abs(varianceEtb))}</span>
                      ) : (
                        <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}>On Budget</span>
                      )
                    ) : (
                      <span style={{ color: "var(--text-faint)" }}>—</span>
                    )}
                  </td>
                  <td className="no-print">{editable && <button className="btn btn-sm btn-danger" onClick={() => remove(e.id)}><Trash2 size={11} /></button>}</td>
                </tr>
              );
            })}
            {editable && (
              <tr className="no-print">
                <td><input className="input" type="date" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} /></td>
                <td><input className="input" style={{ minWidth: 80 }} value={f.purchaser} onChange={(e) => setF((s) => ({ ...s, purchaser: e.target.value }))} /></td>
                <td><input className="input" style={{ minWidth: 150 }} placeholder="Item" value={f.item} onChange={(e) => setF((s) => ({ ...s, item: e.target.value }))} /></td>
                <td>
                  <select className="input" style={{ width: 90 }} value={f.category} onChange={(e) => setF((s) => ({ ...s, category: e.target.value }))}>
                    <option value="cash">Cash</option>
                    <option value="stock">Stock</option>
                  </select>
                  {f.category === "stock" && (
                    <input className="input" style={{ width: 90, marginTop: 4 }} placeholder="unit" value={f.unit} onChange={(e) => setF((s) => ({ ...s, unit: e.target.value }))} />
                  )}
                </td>
                <td><input className="input" style={{ width: 55 }} type="text" inputMode="decimal" value={f.qty} onChange={(e) => setF((s) => ({ ...s, qty: e.target.value }))} /></td>
                <td><input className="input" style={{ width: 75 }} type="text" inputMode="decimal" value={f.unitPrice} onChange={(e) => setF((s) => ({ ...s, unitPrice: e.target.value }))} /></td>
                <td className="mono">{fmtETB(f.qty * f.unitPrice)}</td>
                <td></td>
                <td></td>
                <td><button className="btn btn-sm btn-primary" disabled={!f.item} onClick={add}><PlusCircle size={12} /></button></td>
              </tr>
            )}
            {purchases.length === 0 && !editable && (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 20, color: "var(--text-faint)" }}>No purchases logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---- Sheet 2: Receipts (date · item purchased · description · receipt amount · upload) ---- */}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, marginTop: 18 }}>Receipts</div>
      <div className="card" style={{ overflow: "auto", maxHeight: 420 }}>
        <table className="dtable">
          <thead><tr>
            <th style={{ minWidth: 90 }}>Date</th><th style={{ minWidth: 160 }}>Item Purchased</th>
            <th style={{ minWidth: 170 }}>Description</th><th style={{ minWidth: 100 }}>Receipt Amount</th>
            <th style={{ minWidth: 90 }}>Withholding</th>
            <th style={{ minWidth: 140 }}>Receipt</th><th className="no-print"></th>
          </tr></thead>
          <tbody>
            {receipts.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
                <td style={{ maxWidth: 200, whiteSpace: "normal", wordBreak: "break-word" }}>{e.item}</td>
                <td style={{ maxWidth: 220, whiteSpace: "normal", wordBreak: "break-word", color: "var(--text-dim)" }}>{e.description || "—"}</td>
                <td className="mono">{fmtETB(e.totalPrice)}</td>
                <td className="mono">{fmtETB(e.withholding)}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {e.receipt ? (
                      <>
                        <ArtPreview art={e.receipt} size={28} />
                        {editable && <button className="btn btn-sm btn-danger" onClick={() => removeReceipt(e.id)}><Trash2 size={10} /></button>}
                      </>
                    ) : (
                      <>
                        <span className="badge" style={{ background: "var(--danger-soft)", color: "#F0A99F" }}>No Receipt</span>
                        {editable && (
                          <>
                            <input ref={(el) => (receiptRefs.current[e.id] = el)} type="file" accept=".jpg,.jpeg,.png,.pdf,.ai,image/*,application/pdf"
                              style={{ display: "none" }} onChange={(ev) => { const file = ev.target.files[0]; if (file) attachReceipt(e.id, file); ev.target.value = ""; }} />
                            <button className="btn btn-sm" onClick={() => receiptRefs.current[e.id]?.click()}><Upload size={10} /></button>
                            <button className="btn btn-sm" style={e.flagged ? { background: "var(--warn-soft)", borderColor: "var(--warn)", color: "#F0C878" } : {}} onClick={() => toggleFlag(e.id)}>
                              <Flag size={10} /> {e.flagged ? "Flagged" : "Flag"}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td className="no-print">{editable && <button className="btn btn-sm btn-danger" onClick={() => remove(e.id)}><Trash2 size={11} /></button>}</td>
              </tr>
            ))}
            {editable && (
              <tr className="no-print">
                <td><input className="input" type="date" value={f2.date} onChange={(e) => setF2((s) => ({ ...s, date: e.target.value }))} /></td>
                <td><input className="input" style={{ minWidth: 140 }} placeholder="Item purchased" value={f2.item} onChange={(e) => setF2((s) => ({ ...s, item: e.target.value }))} /></td>
                <td><input className="input" style={{ minWidth: 150 }} placeholder="Description" value={f2.description} onChange={(e) => setF2((s) => ({ ...s, description: e.target.value }))} /></td>
                <td><input className="input" style={{ width: 90 }} type="text" inputMode="decimal" value={f2.amount} onChange={(e) => setF2((s) => ({ ...s, amount: e.target.value }))} /></td>
                <td className="mono">{fmtETB(calc.withholding(Number(f2.amount) || 0))}</td>
                <td>
                  <input ref={f2FileRef} type="file" accept=".jpg,.jpeg,.png,.pdf,.ai,image/*,application/pdf" style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setF2Receipt({ name: file.name, url: reader.result, kind: classifyArtFile(file) });
                      reader.readAsDataURL(file);
                    }} />
                  <button className="btn btn-sm" onClick={() => f2FileRef.current.click()}><Upload size={10} /> {f2Receipt ? "Attached" : "Upload"}</button>
                </td>
                <td><button className="btn btn-sm btn-primary" disabled={!f2.item || !f2.amount} onClick={addReceipt}><PlusCircle size={12} /></button></td>
              </tr>
            )}
            {receipts.length === 0 && !editable && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 20, color: "var(--text-faint)" }}>No receipts logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 6 }}>No limit on rows — add as many as needed in either sheet.</div>

      {canReconcile && (
        <div className="card" style={{ padding: 16, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Reconciliation</div>
            {(() => { const t = RECON_STATUS_COLOR[job.reconciliation?.status || "Pending"]; return <span className="badge" style={{ background: t.bg, color: t.fg }}>{job.reconciliation?.status || "Pending"}</span>; })()}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 10 }}>Admin-only: confirm these logged expenses match the approved budget before the job can be closed.</div>
          {job.reconciliation?.status !== "Pending" && job.reconciliation?.note && (
            <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 10 }}>Note from {job.reconciliation.reconciledBy} ({fmtDateTime(job.reconciliation.reconciledAt)}): {job.reconciliation.note}</div>
          )}
          {flagging ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="What's the discrepancy?" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
              <button className="btn btn-sm btn-danger" onClick={() => { setReconciliation("Flagged", noteDraft); setFlagging(false); setNoteDraft(""); }}>Save Flag</button>
              <button className="btn btn-sm" onClick={() => setFlagging(false)}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setReconciliation("Reconciled", "")}><CheckCircle2 size={12} /> Mark as Reconciled</button>
              <button className="btn btn-sm" onClick={() => setFlagging(true)}><Flag size={12} /> Flag for Review</button>
              {job.reconciliation?.status !== "Pending" && (
                <button className="btn btn-sm" onClick={() => setReconciliation("Pending", "")}><Undo2 size={12} /> Revert to Pending</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- payments & profit ------------------------------ */
function PaymentsTab({ job, role, can, patchJob, logJob, fin, onPrint }) {
  const editable = can("managePayments") && !job.monitoring.closed;
  const [pf, setPf] = useState({ amount: 0, type: "Final", method: "Bank Transfer (CBE)", date: new Date().toISOString().slice(0, 10), notes: "" });
  const addPayment = () => patchJob((j) => logJob({ ...j, payments: [...j.payments, { id: nid("p"), ...pf, receipt: null }] }, `${pf.type} payment recorded — ${fmtETB(pf.amount)}`));

  return (
    <div>
      {job.monitoring.closed && <ClosedBanner />}
      <div className="card" style={{ padding: 16, maxWidth: 640 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Payment Records</div>
        <table className="dtable">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Method</th></tr></thead>
          <tbody>
            {job.payments.map((p) => <tr key={p.id}><td>{fmtDate(p.date)}</td><td>{p.type}</td><td className="mono">{fmtETB(p.amount)}</td><td>{p.method}</td></tr>)}
            {job.payments.length === 0 && <tr><td colSpan={4} style={{ color: "var(--text-faint)", textAlign: "center", padding: 10 }}>No payments recorded.</td></tr>}
          </tbody>
        </table>
        {editable && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <select className="input" value={pf.type} onChange={(e) => setPf((s) => ({ ...s, type: e.target.value }))}><option>Final</option><option>Other</option></select>
            <input className="input" type="text" inputMode="decimal" placeholder="Amount" value={pf.amount} onChange={(e) => setPf((s) => ({ ...s, amount: e.target.value }))} />
            <input className="input" type="date" value={pf.date} onChange={(e) => setPf((s) => ({ ...s, date: e.target.value }))} />
            <input className="input" placeholder="Method" value={pf.method} onChange={(e) => setPf((s) => ({ ...s, method: e.target.value }))} />
            <button className="btn btn-primary btn-sm" style={{ gridColumn: "1/-1" }} disabled={!pf.amount} onClick={addPayment}><PlusCircle size={12} /> Record Payment</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityTab({ job }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      {job.activity.map((a, i) => (
        <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: i < job.activity.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)", width: 140, flexShrink: 0 }}>{fmtDateTime(a.ts)}</div>
          <div style={{ fontSize: 12.5 }}>{a.text}</div>
        </div>
      ))}
      {job.activity.length === 0 && <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>No activity yet.</div>}
    </div>
  );
}

/* ----------------------------- price database ------------------------------- */
function SignagePriceDatabase({ signageMaterials, setSignageMaterials, canEdit, role }) {
  const [f, setF] = useState({ name: "", category: "cash", unit: "", rate: "", defaultQty: "" });
  const [q, setQ] = useState("");
  const [historyId, setHistoryId] = useState(null);

  const update = (id, patch) => setSignageMaterials((prev) => prev.map((m) => {
    if (m.id !== id) return m;
    let priceHistory = m.priceHistory || [];
    if (patch.rate !== undefined && Number(patch.rate) !== Number(m.rate)) {
      priceHistory = [...priceHistory, { oldPrice: m.rate, newPrice: Number(patch.rate) || 0, effectiveDate: new Date().toISOString(), changedBy: role }];
    }
    return { ...m, ...patch, priceHistory };
  }));
  const add = () => {
    if (!f.name) return;
    setSignageMaterials((prev) => [...prev, matSeed({ name: f.name, category: f.category, unit: f.unit, rate: f.rate === "" ? null : Number(f.rate), defaultQty: f.defaultQty === "" ? null : Number(f.defaultQty), active: f.rate !== "" })]);
    setF({ name: "", category: "cash", unit: "", rate: "", defaultQty: "" });
  };
  const filtered = signageMaterials.filter((m) => !q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Price Database</h1>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 12 }}>
        This is the shared price list used by the Cost Estimation section on every job. Items with no confirmed price are inactive and won't appear as fillable rows on a job's Cost Estimate until priced here.
      </div>
      {!canEdit && <LockedNotice role={role} action="edit the price database" />}
      <div style={{ marginBottom: 10 }}>
        <div style={{ position: "relative", maxWidth: 260 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: 9, color: "var(--text-faint)" }} />
          <input className="input" style={{ paddingLeft: 28 }} placeholder="Search materials" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="card" style={{ overflow: "auto" }}>
        <table className="dtable">
          <thead><tr><th>Name</th><th>Category</th><th>Unit</th><th>Unit Price</th><th>Default Qty</th><th>Active</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {filtered.map((m) => (
              <React.Fragment key={m.id}>
                <tr>
                  <td>{canEdit ? <input className="input" style={{ minWidth: 170 }} value={m.name} onChange={(e) => update(m.id, { name: e.target.value })} /> : m.name}</td>
                  <td>
                    {canEdit ? (
                      <select className="input" value={m.category} onChange={(e) => update(m.id, { category: e.target.value })}><option value="cash">cash</option><option value="stock">stock</option></select>
                    ) : <span className="badge" style={{ background: m.category === "cash" ? "var(--accent-soft)" : "var(--info-soft)", color: m.category === "cash" ? "var(--accent-text)" : "#8FBEE8" }}>{m.category}</span>}
                  </td>
                  <td>{canEdit ? <input className="input" style={{ width: 70 }} value={m.unit} onChange={(e) => update(m.id, { unit: e.target.value })} /> : (m.unit || "—")}</td>
                  <td className="mono">{canEdit ? <input className="input" style={{ width: 100 }} type="text" inputMode="decimal" value={m.rate ?? ""} onChange={(e) => update(m.id, { rate: e.target.value })} /> : (m.rate != null ? fmtETB(m.rate) : "—")}</td>
                  <td>{canEdit ? <input className="input" style={{ width: 70 }} type="text" inputMode="decimal" value={m.defaultQty ?? ""} onChange={(e) => update(m.id, { defaultQty: e.target.value })} /> : (m.defaultQty ?? "—")}</td>
                  <td>{canEdit ? <input type="checkbox" checked={m.active} onChange={(e) => update(m.id, { active: e.target.checked })} /> : (m.active ? "Yes" : "No")}</td>
                  <td style={{ maxWidth: 200, fontSize: 11, color: "var(--text-faint)", whiteSpace: "normal" }}>{m.notes}</td>
                  <td>{m.priceHistory && m.priceHistory.length > 0 && <button className="btn btn-sm" onClick={() => setHistoryId(historyId === m.id ? null : m.id)}><Clock size={11} /></button>}</td>
                </tr>
                {historyId === m.id && m.priceHistory?.length > 0 && (
                  <tr><td colSpan={8} style={{ background: "var(--surface-2)", fontSize: 11 }}>
                    <div style={{ padding: 8 }}>
                      <b>Price history:</b>
                      {m.priceHistory.map((h, i) => (
                        <div key={i} style={{ color: "var(--text-dim)" }}>{fmtETB(h.oldPrice)} → {fmtETB(h.newPrice)} on {fmtDate(h.effectiveDate)} by {h.changedBy}</div>
                      ))}
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {canEdit && (
          <div style={{ display: "flex", gap: 6, padding: 10, flexWrap: "wrap" }}>
            <input className="input" style={{ width: 160 }} placeholder="Material name" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />
            <select className="input" style={{ width: 100 }} value={f.category} onChange={(e) => setF((s) => ({ ...s, category: e.target.value }))}><option value="cash">cash</option><option value="stock">stock</option></select>
            <input className="input" style={{ width: 80 }} placeholder="unit" value={f.unit} onChange={(e) => setF((s) => ({ ...s, unit: e.target.value }))} />
            <input className="input" style={{ width: 90 }} type="text" inputMode="decimal" placeholder="rate" value={f.rate} onChange={(e) => setF((s) => ({ ...s, rate: e.target.value }))} />
            <input className="input" style={{ width: 90 }} type="text" inputMode="decimal" placeholder="default qty" value={f.defaultQty} onChange={(e) => setF((s) => ({ ...s, defaultQty: e.target.value }))} />
            <button className="btn btn-primary btn-sm" onClick={add}><PlusCircle size={12} /> Add Material</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- inventory ---------------------------------
   A running ledger of stock-item movements: Stock In (received) and Stock
   Out (consumed/adjusted). Stock Out entries tagged with a jobId+source were
   generated automatically when that job's budget was approved — everything
   else is manual. Balance per item = sum(in) − sum(out).
   ------------------------------------------------------------------------- */
function InventoryPage({ inventoryLedger, setInventoryLedger, signageMaterials, can, role, onOpenJob, jobs }) {
  const [tab, setTab] = useState("in");
  const canEdit = can("manageInventory");
  const stockMaterials = signageMaterials.filter((m) => m.category === "stock" && m.active);
  const resolveProject = (jobId) => {
    if (!jobId) return null;
    const j = jobs.find((job) => job.id === jobId);
    return j ? { id: j.id, label: `${j.jobNumber} — ${j.clientName || "Untitled Client"}` } : null;
  };

  const balances = useMemo(() => {
    const map = {};
    const keyOf = (e) => e.materialId || `name:${e.itemName}`;
    inventoryLedger.forEach((e) => {
      const k = keyOf(e);
      if (!map[k]) map[k] = { itemName: e.itemName, unit: e.unit, materialId: e.materialId, balance: 0 };
      map[k].balance += e.direction === "in" ? Number(e.qty) : -Number(e.qty);
    });
    return Object.values(map).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [inventoryLedger]);

  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), materialId: "", itemName: "", qty: 1, note: "" });
  const submit = (direction) => {
    const mat = stockMaterials.find((m) => m.id === f.materialId);
    const itemName = mat ? mat.name : f.itemName;
    if (!itemName.trim()) return;
    setInventoryLedger((prev) => [
      inventoryEntry({ direction, date: f.date, materialId: mat ? mat.id : null, itemName, qty: Number(f.qty) || 0, unit: mat ? mat.unit : "", source: "Manual", note: f.note, createdBy: role }),
      ...prev,
    ]);
    setF({ date: new Date().toISOString().slice(0, 10), materialId: "", itemName: "", qty: 1, note: "" });
  };

  const rows = tab === "transactions"
    ? [...inventoryLedger].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : inventoryLedger.filter((e) => e.direction === tab);

  return (
    <div>
      <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Inventory</h1>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 16 }}>Stock item movements — Stock Out entries are created automatically the moment a job's Budget with Stock items on it gets approved, on top of whatever's logged manually here.</div>

      <div className="card" style={{ overflow: "auto", marginBottom: 14 }}>
        <div style={{ padding: "10px 14px", fontWeight: 700, fontSize: 12.5, borderBottom: "1px solid var(--border)" }}>Current Balances</div>
        <table className="dtable">
          <thead><tr><th>Item</th><th>Unit</th><th>Balance</th></tr></thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.materialId || b.itemName}>
                <td>{b.itemName}</td><td>{b.unit || "—"}</td>
                <td className="mono" style={{ fontWeight: 700, color: b.balance < 0 ? "var(--danger)" : "var(--text)" }}>{b.balance}</td>
              </tr>
            ))}
            {balances.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", padding: 16, color: "var(--text-faint)" }}>No stock movements logged yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 18, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        <div className={`tab ${tab === "in" ? "active" : ""}`} onClick={() => setTab("in")}><ArrowDownCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Stock In</div>
        <div className={`tab ${tab === "out" ? "active" : ""}`} onClick={() => setTab("out")}><ArrowUpCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Stock Out</div>
        <div className={`tab ${tab === "transactions" ? "active" : ""}`} onClick={() => setTab("transactions")}><Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Inventory Transactions</div>
      </div>

      {canEdit && tab !== "transactions" && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 10 }}>Record {tab === "in" ? "Stock In" : "Stock Out"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr) auto", gap: 8, alignItems: "end" }}>
            <div><label className="label">Date</label><input className="input" type="date" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} /></div>
            <div style={{ gridColumn: "span 2" }}>
              <label className="label">Item</label>
              <select className="input" value={f.materialId} onChange={(e) => setF((s) => ({ ...s, materialId: e.target.value, itemName: "" }))}>
                <option value="">Type a name instead...</option>
                {stockMaterials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
              </select>
              {!f.materialId && <input className="input" style={{ marginTop: 6 }} placeholder="Item name" value={f.itemName} onChange={(e) => setF((s) => ({ ...s, itemName: e.target.value }))} />}
            </div>
            <div><label className="label">Qty</label><input className="input" type="text" inputMode="decimal" value={f.qty} onChange={(e) => setF((s) => ({ ...s, qty: e.target.value }))} /></div>
            <div><label className="label">Note</label><input className="input" placeholder="Optional" value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} /></div>
            <button className="btn btn-primary btn-sm" onClick={() => submit(tab)}><PlusCircle size={12} /> Record</button>
          </div>
        </div>
      )}

      {tab === "transactions" ? (
        <div className="card" style={{ overflow: "auto" }}>
          <table className="dtable">
            <thead><tr><th>Date</th><th>Direction</th><th>Item</th><th>Qty</th><th>Unit</th><th>Project</th><th>Source</th><th>Note</th><th>By</th></tr></thead>
            <tbody>
              {rows.map((e) => {
                const project = resolveProject(e.jobId);
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
                    <td>
                      <span className="badge" style={{ background: e.direction === "in" ? "var(--success-soft)" : "var(--danger-soft)", color: e.direction === "in" ? "#8FD1A8" : "#F0A99F" }}>
                        {e.direction === "in" ? "Stock In" : "Stock Out"}
                      </span>
                    </td>
                    <td>{e.itemName}</td>
                    <td className="mono">{e.qty}</td>
                    <td>{e.unit || "—"}</td>
                    <td>
                      {project ? (
                        <span style={{ color: "var(--accent-text)", cursor: "pointer" }} onClick={() => onOpenJob(project.id)}>{project.label}</span>
                      ) : (
                        <span style={{ color: "var(--text-faint)" }}>—</span>
                      )}
                    </td>
                    <td style={{ color: "var(--text-dim)" }}>{e.source}</td>
                    <td style={{ color: "var(--text-dim)" }}>{e.note || "—"}</td>
                    <td>{e.createdBy}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--text-faint)" }}>No inventory transactions logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ overflow: "auto" }}>
          <table className="dtable">
            <thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Unit</th><th>Source</th><th>Note</th><th>By</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
                  <td>{e.itemName}</td>
                  <td className="mono">{e.qty}</td>
                  <td>{e.unit || "—"}</td>
                  <td>
                    {e.jobId ? (
                      <span style={{ color: "var(--accent-text)", cursor: "pointer" }} onClick={() => onOpenJob(e.jobId)}>{e.source}</span>
                    ) : (
                      <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}>{e.source}</span>
                    )}
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>{e.note || "—"}</td>
                  <td>{e.createdBy}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 20, color: "var(--text-faint)" }}>No {tab === "in" ? "stock in" : "stock out"} entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Reports({ jobs }) {
  const byStatus = STATUSES.map((s) => ({ status: s, count: jobs.filter((j) => j.status === s).length }));
  let totalSales = 0, totalExpenses = 0, totalAdvance = 0, outstanding = 0, totalCommission = 0, totalProfit = 0;
  const matUsage = {};
  jobs.forEach((j) => {
    const f = getFinancials(j);
    if (j.status !== "Cancelled") { totalSales += f.finalPrice; totalCommission += f.commissionAmount; totalProfit += f.profitAmount; if (j.status !== "Closed") outstanding += Math.max(0, f.remaining); }
    totalExpenses += f.totalExpenses; totalAdvance += f.advance;
    j.expenses.forEach((e) => { matUsage[e.material || e.item] = (matUsage[e.material || e.item] || 0) + e.totalPrice; });
  });
  const topMaterials = Object.entries(matUsage).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const exportCsv = () => {
    const rows = [["Job Number", "Client", "Status", "Final Price", "Advance", "Remaining", "Expenses", "Profit"]];
    jobs.forEach((j) => { const f = getFinancials(j); rows.push([j.jobNumber, j.clientName, j.status, f.finalPrice, f.advance, f.remaining, f.totalExpenses, f.profitAmount]); });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    const a = document.createElement("a"); a.href = url; a.download = "hadar-jobs-report.csv"; a.click();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 19, fontWeight: 700 }}>Reports</h1>
        <button className="btn btn-sm" onClick={exportCsv}><Printer size={12} /> Export CSV</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Job Report</div>
          {byStatus.filter((s) => s.count > 0).map((s) => (
            <div key={s.status} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5, borderBottom: "1px solid var(--border-soft)" }}>
              <span>{s.status}</span><span className="mono">{s.count}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Financial Report</div>
          <Field k="Total Sales (Final Price)" v={fmtETB(totalSales)} mono />
          <Field k="Total Expenses" v={fmtETB(totalExpenses)} mono />
          <Field k="Total Advance Payments" v={fmtETB(totalAdvance)} mono />
          <Field k="Outstanding Payments" v={fmtETB(outstanding)} mono />
          <Field k="Total Commission" v={fmtETB(totalCommission)} mono />
          <Field k="Total Profit" v={fmtETB(totalProfit)} mono />
        </div>
        <div className="card" style={{ padding: 16, gridColumn: "1/-1" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Material Report — Top Spend</div>
          {topMaterials.length === 0 && <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>No expense data yet.</div>}
          {topMaterials.map(([name, total]) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5, borderBottom: "1px solid var(--border-soft)" }}>
              <span>{name}</span><span className="mono">{fmtETB(total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- reconciliation --------------------------- */
// Compares each job's approved Budget line items against what was actually
// logged in Expenses (the "supervisor report" — Supervisors are the ones
// who record purchases in the field via the Expenses tab). Surfaces
// variance per line, flags spend that doesn't map to any budget line, and
// lets an authorized user mark the job Reconciled or Flagged with a note.
function buildReconciliation(job) {
  const budgetItems = job.budget.items;
  const byRef = {};
  job.expenses.forEach((e) => {
    const key = e.budgetRef && budgetItems.some((b) => b.label === e.budgetRef) ? e.budgetRef : "__unclassified__";
    byRef[key] = (byRef[key] || 0) + e.totalPrice;
  });
  const lines = budgetItems.map((b) => {
    const actual = round2(byRef[b.label] || 0);
    return { label: b.label, allocated: Number(b.amount) || 0, actual, variance: round2((Number(b.amount) || 0) - actual) };
  });
  const unclassified = round2(byRef["__unclassified__"] || 0);
  const totalAllocated = calc.budgetTotal(budgetItems);
  const totalActual = calc.totalExpenses(job.expenses);
  return { lines, unclassified, totalAllocated, totalActual, totalVariance: round2(totalAllocated - totalActual) };
}

function ReconciliationView({ jobs, can, role, patchJob, logJob, onOpenJob }) {
  const canReconcile = can("reconcileBudget");
  const [selectedId, setSelectedId] = useState(null);
  const withBudget = jobs.filter((j) => j.budget.items.length > 0);
  const counts = { Pending: 0, Reconciled: 0, Flagged: 0 };
  withBudget.forEach((j) => { counts[j.reconciliation?.status || "Pending"] = (counts[j.reconciliation?.status || "Pending"] || 0) + 1; });

  const setReconciliation = (jobId, status, note) => patchJob(jobId, (j) => logJob({
    ...j, reconciliation: { status, note: note || "", reconciledBy: role, reconciledAt: new Date().toISOString() },
  }, `Reconciliation marked "${status}" by ${role}${note ? ` — ${note}` : ""}`));
  const setChecklist = (jobId, field, checked) => patchJob(jobId, (j) => ({ ...j, checklist: { ...j.checklist, [field]: checked } }));
  const closeJob = (jobId) => patchJob(jobId, (j) => logJob({ ...j, status: "Closed", monitoring: { ...j.monitoring, closed: true, closedAt: new Date().toISOString(), closedBy: role } }, `Job closed by ${role}`));
  const reopenJob = (jobId) => patchJob(jobId, (j) => logJob({ ...j, status: "Waiting for Reconciliation", monitoring: { ...j.monitoring, closed: false, closedAt: null, closedBy: "" } }, `Job reopened by ${role}`));

  if (selectedId) {
    const job = jobs.find((j) => j.id === selectedId);
    if (!job) { setSelectedId(null); return null; }
    return (
      <ReconciliationDetail job={job} can={can} canReconcile={canReconcile}
        onSet={(status, note) => setReconciliation(job.id, status, note)}
        onSetChecklist={(field, checked) => setChecklist(job.id, field, checked)}
        onCloseJob={() => closeJob(job.id)} onReopenJob={() => reopenJob(job.id)}
        onOpenJob={onOpenJob} onBack={() => setSelectedId(null)} />
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Reconciliation</h1>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 14 }}>
        Pick a job to review its full reconciliation documents — budget vs. actual variance, payment records, receipts and withholdings, and final profit — before closing it out.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
        <Stat label="Pending Review" value={counts.Pending || 0} tone="var(--warn)" />
        <Stat label="Reconciled" value={counts.Reconciled || 0} tone="var(--success)" />
        <Stat label="Flagged" value={counts.Flagged || 0} tone="var(--danger)" />
        <Stat label="Jobs with a Budget" value={withBudget.length} />
      </div>

      {withBudget.length === 0 ? (
        <div className="card" style={{ padding: 26, textAlign: "center", color: "var(--text-dim)", fontSize: 12.5 }}>
          No jobs have a submitted budget yet — reconciliation opens up once a Budget Breakdown exists on a job.
        </div>
      ) : (
        <div className="card" style={{ overflow: "auto" }}>
          <table className="dtable">
            <thead><tr><th>Job #</th><th>Client</th><th>Status</th><th>Allocated</th><th>Actual</th><th>Variance</th><th>Reconciliation</th><th></th></tr></thead>
            <tbody>
              {withBudget.map((j) => {
                const r = buildReconciliation(j);
                const status = j.reconciliation?.status || "Pending";
                const tone = RECON_STATUS_COLOR[status];
                return (
                  <tr key={j.id} style={{ cursor: "pointer" }} onClick={() => setSelectedId(j.id)}>
                    <td className="mono">{j.jobNumber}</td>
                    <td>{j.clientName || <span style={{ color: "var(--text-faint)" }}>Untitled</span>}</td>
                    <td><StatusBadge status={j.status} /></td>
                    <td className="mono">{fmtETB(r.totalAllocated)}</td>
                    <td className="mono">{fmtETB(r.totalActual)}</td>
                    <td className="mono" style={{ color: r.totalVariance < 0 ? "var(--danger)" : "var(--success)" }}>{fmtETB(r.totalVariance)}</td>
                    <td><span className="badge" style={{ background: tone.bg, color: tone.fg }}>{status}</span></td>
                    <td><ChevronRight size={14} color="var(--text-faint)" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const RECON_STATUS_COLOR = {
  Pending: { bg: "var(--warn-soft)", fg: "#F0C878" },
  Reconciled: { bg: "var(--success-soft)", fg: "#8FD1A8" },
  Flagged: { bg: "var(--danger-soft)", fg: "#F0A99F" },
};

/* -------- reconciliation documents (per job) --------
   1. Budget vs. Expense variance
   2. Final checklist
   3. Payment records
   4. All receipts & withholdings
   5. Final profit after expenses
   ------------------------------------------------------ */
function ReconciliationDetail({ job, can, canReconcile, onSet, onSetChecklist, onCloseJob, onReopenJob, onOpenJob, onBack }) {
  const [noteDraft, setNoteDraft] = useState("");
  const [flagging, setFlagging] = useState(false);
  const r = buildReconciliation(job);
  const fin = getFinancials(job);
  const status = job.reconciliation?.status || "Pending";
  const tone = RECON_STATUS_COLOR[status];
  const supervisorNames = [...new Set(job.expenses.map((e) => e.purchaser).filter(Boolean))];
  const isReconciled = status === "Reconciled";
  const allChecked = job.checklist.withholdingCollected && job.checklist.receiptAttached && isReconciled;
  const canClose = can("closeJob");
  const canReopen = can("reopenJob");
  const receiptedExpenses = job.expenses.filter((e) => e.receipt);
  const commissionAmount = job.costEstimate.commissionActive ? round2(job.costEstimate.items.reduce((s, i) => s + (Number(i.total) || 0), 0) * 0.07) : 0;
  const finalProfit = round2((Number(job.costEstimate.soldPrice) || 0) - fin.totalExpenses - commissionAmount);

  return (
    <div>
      <div className="btn btn-ghost" style={{ marginBottom: 10 }} onClick={onBack}><ArrowLeft size={14} /> Back to all jobs</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)", cursor: "pointer" }} onClick={() => onOpenJob(job.id)}>{job.jobNumber}</span>
            <StatusBadge status={job.status} />
            <span className="badge" style={{ background: tone.bg, color: tone.fg }}>{status}</span>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4 }}>{job.clientName}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
            Supervisor report from: {supervisorNames.length ? supervisorNames.join(", ") : "no expenses logged yet"}
            {job.budget.status !== "Approved" && <span style={{ color: "var(--warn)" }}> · Budget not yet approved</span>}
          </div>
        </div>
      </div>

      {/* 1. Budget vs. Expense variance */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Budget vs. Expense Variance</div>
          <div style={{ display: "flex", gap: 20 }}>
            <Field k="Allocated" v={fmtETB(r.totalAllocated)} mono />
            <Field k="Actual (Expenses)" v={fmtETB(r.totalActual)} mono />
            <Field k="Variance" v={fmtETB(r.totalVariance)} mono />
          </div>
        </div>
        <table className="dtable">
          <thead><tr><th>Budget Line</th><th>Allocated</th><th>Actual Spent</th><th>Variance</th></tr></thead>
          <tbody>
            {r.lines.map((l) => (
              <tr key={l.label}>
                <td>{l.label}</td>
                <td className="mono">{fmtETB(l.allocated)}</td>
                <td className="mono">{fmtETB(l.actual)}</td>
                <td className="mono" style={{ color: l.variance < 0 ? "var(--danger)" : "var(--success)" }}>
                  {l.variance < 0 ? "Over by " : "Under by "}{fmtETB(Math.abs(l.variance))}
                </td>
              </tr>
            ))}
            {r.unclassified > 0 && (
              <tr>
                <td style={{ color: "var(--warn)" }}><AlertTriangle size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Unclassified expenses</td>
                <td className="mono">—</td>
                <td className="mono">{fmtETB(r.unclassified)}</td>
                <td style={{ fontSize: 11, color: "var(--warn)" }}>Doesn't match any budget line</td>
              </tr>
            )}
          </tbody>
        </table>
        {job.reconciliation?.status !== "Pending" && job.reconciliation?.note && (
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 10 }}>
            Note from {job.reconciliation.reconciledBy} ({fmtDateTime(job.reconciliation.reconciledAt)}): {job.reconciliation.note}
          </div>
        )}
        {canReconcile && (
          <div className="hr" style={{ marginTop: 12, paddingTop: 12 }}>
            {flagging ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="What's the discrepancy?" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
                <button className="btn btn-sm btn-danger" onClick={() => { onSet("Flagged", noteDraft); setFlagging(false); setNoteDraft(""); }}>Save Flag</button>
                <button className="btn btn-sm" onClick={() => setFlagging(false)}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={() => onSet("Reconciled", "")}><CheckCircle2 size={12} /> Mark Reconciled</button>
                <button className="btn btn-sm" onClick={() => setFlagging(true)}><Flag size={12} /> Flag for Review</button>
                {status !== "Pending" && (
                  <button className="btn btn-sm" onClick={() => onSet("Pending", "")}><Undo2 size={12} /> Revert to Pending</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Payment records */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Payment Records</div>
        <table className="dtable">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Method</th><th>Receipt</th></tr></thead>
          <tbody>
            {job.payments.map((p) => (
              <tr key={p.id}>
                <td>{fmtDate(p.date)}</td><td>{p.type}</td><td className="mono">{fmtETB(p.amount)}</td><td>{p.method}</td>
                <td>{p.receipt ? <ArtPreview art={p.receipt} size={28} /> : <span style={{ color: "var(--text-faint)" }}>—</span>}</td>
              </tr>
            ))}
            {job.payments.length === 0 && <tr><td colSpan={5} style={{ color: "var(--text-faint)", textAlign: "center", padding: 10 }}>No payments recorded.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* 4. All receipts & withholdings */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Receipts & Withholdings</div>
          <Field k="Total Withholding" v={fmtETB(fin.totalWithholding)} mono />
        </div>
        <table className="dtable">
          <thead><tr><th>Date</th><th>Item</th><th>Amount</th><th>Withholding</th><th>Receipt</th></tr></thead>
          <tbody>
            {receiptedExpenses.map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.date)}</td><td>{e.item}</td><td className="mono">{fmtETB(e.totalPrice)}</td><td className="mono">{fmtETB(e.withholding)}</td>
                <td><ArtPreview art={e.receipt} size={28} /></td>
              </tr>
            ))}
            {receiptedExpenses.length === 0 && <tr><td colSpan={5} style={{ color: "var(--text-faint)", textAlign: "center", padding: 10 }}>No receipts attached to any expense yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* 5. Final profit after expenses */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Final Profit After Expenses</div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <Field k="Sold Price" v={fmtETB(job.costEstimate.soldPrice)} mono />
          <Field k="Actual Total Expenses" v={fmtETB(fin.totalExpenses)} mono />
          <Field k="Commission" v={fmtETB(commissionAmount)} mono />
          <div style={{ fontSize: 16, fontWeight: 800 }} className="mono">Final Profit: {fmtETB(finalProfit)}</div>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 8 }}>Final Profit = Sold Price − Actual Total Expenses{job.costEstimate.commissionActive ? " − Commission" : ""}</div>
      </div>

      {/* 2. Final checklist + job close */}
      {(canClose || canReopen) && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Final Checklist</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
              <input type="checkbox" disabled={!canClose || job.monitoring.closed} checked={job.checklist.withholdingCollected} onChange={(e) => onSetChecklist("withholdingCollected", e.target.checked)} /> All withholdings collected
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
              <input type="checkbox" disabled={!canClose || job.monitoring.closed} checked={job.checklist.receiptAttached} onChange={(e) => onSetChecklist("receiptAttached", e.target.checked)} /> Bank payment receipt attached
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: isReconciled ? "var(--success)" : "var(--text-dim)" }}>
              {isReconciled ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} color="var(--warn)" />} Reconciliation {isReconciled ? "complete" : "not yet marked Reconciled"}
            </div>
          </div>
          {isReconciled ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!job.monitoring.closed && canClose && <button className="btn btn-primary" disabled={!allChecked} onClick={onCloseJob}><CheckCircle2 size={14} /> Close Job</button>}
              {job.monitoring.closed && canReopen && <button className="btn btn-danger" onClick={onReopenJob}><Undo2 size={13} /> Reopen Job</button>}
              {!allChecked && !job.monitoring.closed && <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>Both checklist items are also required to close.</span>}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>The Close Job button appears here once this job's reconciliation is marked Reconciled above.</div>
          )}
        </div>
      )}
    </div>
  );
}

function UsersView({ users, setUsers, can, currentUser }) {
  const editable = can("manageUsers");
  const [editingId, setEditingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [rowError, setRowError] = useState({});
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState({ username: "", password: "", name: "", role: "Designer" });
  const [nfError, setNfError] = useState("");

  if (!editable) {
    return (
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Users</h1>
        <LockedNotice role={`${currentUser.name} (${currentUser.role})`} action="manage users or permissions" />
      </div>
    );
  }

  const clearRowError = (id) => setRowError((prev) => { const n = { ...prev }; delete n[id]; return n; });
  const toggleActive = (id) => setUsers((prev) => prev.map((u) => u.id === id ? { ...u, active: !u.active } : u));
  const setPerm = (id, group, key, val) => setUsers((prev) => prev.map((u) => u.id === id ? { ...u, [group]: { ...u[group], [key]: val } } : u));
  const applyRoleDefaults = (id, role) => setUsers((prev) => prev.map((u) => {
    if (u.id !== id) return u;
    const { actions, actionViews, pages, tabs } = buildPermSet(role);
    return { ...u, role, actions, actionViews, pages, tabs };
  }));

  const updateField = (id, field, value) => {
    clearRowError(id);
    if (field === "username") {
      const taken = users.some((u) => u.id !== id && u.username.toLowerCase() === value.trim().toLowerCase());
      if (taken) { setRowError((p) => ({ ...p, [id]: "That user ID is already taken." })); return; }
    }
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, [field]: value } : u));
  };

  const startReset = (id) => { setResettingId(id); setNewPw(""); };
  const saveReset = (id) => {
    if (!newPw) return;
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, password: newPw } : u));
    setResettingId(null); setNewPw("");
  };

  const createUser = () => {
    setNfError("");
    if (!nf.username || !nf.password || !nf.name) { setNfError("User ID, password, and full name are all required."); return; }
    if (users.some((u) => u.username.toLowerCase() === nf.username.trim().toLowerCase())) { setNfError("That user ID is already taken."); return; }
    setUsers((prev) => [...prev, userSeed({ ...nf })]);
    setNf({ username: "", password: "", name: "", role: "Designer" }); setShowNew(false);
  };

  const requestDelete = (id) => {
    if (id === currentUser.id) { setRowError((p) => ({ ...p, [id]: "You can't delete the account you're logged in as." })); return; }
    setConfirmDeleteId(id);
  };
  const confirmDelete = (id) => { setUsers((prev) => prev.filter((u) => u.id !== id)); setConfirmDeleteId(null); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 19, fontWeight: 700 }}>Users</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowNew((v) => !v); setNfError(""); }}><UserPlus size={13} /> New User</button>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 14 }}>
        Every user signs in with their own ID and password. Click a user's name or ID to rename it, use Reset Password to set a new one, or open Permissions to control exactly which pages and actions they can access.
      </div>

      {showNew && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <div><label className="label">User ID</label><input className="input" value={nf.username} onChange={(e) => setNf((s) => ({ ...s, username: e.target.value }))} /></div>
            <div><label className="label">Password</label><input className="input" value={nf.password} onChange={(e) => setNf((s) => ({ ...s, password: e.target.value }))} /></div>
            <div><label className="label">Full Name</label><input className="input" value={nf.name} onChange={(e) => setNf((s) => ({ ...s, name: e.target.value }))} /></div>
            <div><label className="label">Starting Role</label><select className="input" value={nf.role} onChange={(e) => setNf((s) => ({ ...s, role: e.target.value }))}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
            <button className="btn btn-primary btn-sm" onClick={createUser}>Create</button>
          </div>
          {nfError && <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 8 }}>{nfError}</div>}
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {users.map((u) => (
          <div key={u.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ width: 30, height: 30, borderRadius: 100, background: "var(--accent-soft)", color: "var(--accent-text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{u.name[0]}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 240 }}>
                <input className="input" style={{ fontSize: 13, fontWeight: 700, padding: "4px 8px" }} value={u.name}
                  onChange={(e) => updateField(u.id, "name", e.target.value)} placeholder="Full name" />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>ID:</span>
                  <input className="input mono" style={{ fontSize: 11, padding: "3px 7px", width: 140 }} value={u.username}
                    onChange={(e) => updateField(u.id, "username", e.target.value)} />
                  {u.id === currentUser.id && <span style={{ fontSize: 10, color: "var(--text-faint)" }}>(you)</span>}
                </div>
              </div>
              <select className="input" style={{ width: 150 }} value={u.role} onChange={(e) => applyRoleDefaults(u.id, e.target.value)}>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <span className="badge" style={{ background: u.active ? "var(--success-soft)" : "var(--danger-soft)", color: u.active ? "var(--success)" : "var(--danger)" }}>{u.active ? "Active" : "Deactivated"}</span>
              <button className="btn btn-sm" onClick={() => toggleActive(u.id)}>{u.active ? "Deactivate" : "Activate"}</button>
              <button className="btn btn-sm" onClick={() => (resettingId === u.id ? setResettingId(null) : startReset(u.id))}><KeyRound size={11} /> Reset Password</button>
              <button className="btn btn-sm" onClick={() => setEditingId(editingId === u.id ? null : u.id)}><ShieldCheck size={11} /> {editingId === u.id ? "Hide" : "Permissions"}</button>
              {confirmDeleteId === u.id ? (
                <>
                  <button className="btn btn-sm btn-danger" onClick={() => confirmDelete(u.id)}>Confirm Delete</button>
                  <button className="btn btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                </>
              ) : (
                <button className="btn btn-sm btn-danger" onClick={() => requestDelete(u.id)}><Trash2 size={11} /></button>
              )}
            </div>

            {rowError[u.id] && <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 8 }}>{rowError[u.id]}</div>}

            {resettingId === u.id && (
              <div className="hr" style={{ marginTop: 10, paddingTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <input className="input" style={{ width: 200 }} placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                <button className="btn btn-primary btn-sm" disabled={!newPw} onClick={() => saveReset(u.id)}>Save New Password</button>
                <button className="btn btn-sm" onClick={() => setResettingId(null)}>Cancel</button>
              </div>
            )}

            {editingId === u.id && (
              <div className="hr" style={{ marginTop: 12, paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent-text)", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>Allow View</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--text-faint)", margin: "8px 0 4px" }}>Pages</div>
                  {PAGE_KEYS.map((p) => (
                    <label key={p.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "4px 0" }}>
                      <input type="checkbox" checked={!!u.pages[p.key]} onChange={(e) => setPerm(u.id, "pages", p.key, e.target.checked)} /> {p.label}
                    </label>
                  ))}
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--text-faint)", margin: "12px 0 4px" }}>Job Detail Tabs</div>
                  {TAB_KEYS.map((t) => (
                    <label key={t.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "4px 0" }}>
                      <input type="checkbox" checked={!!u.tabs[t.key]} onChange={(e) => setPerm(u.id, "tabs", t.key, e.target.checked)} /> {t.label}
                    </label>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent-text)", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>Allow Edit</div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 8 }}>Each action has its own View flag too — grant View alone to let someone see that an action/status exists without letting them perform it.</div>
                  <div style={{ display: "grid", gridTemplateColumns: "34px 34px 1fr", gap: 4, fontSize: 10, color: "var(--text-faint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", padding: "2px 0 4px" }}>
                    <span>View</span><span>Edit</span><span></span>
                  </div>
                  {ACTION_KEYS.map((a) => (
                    <div key={a.key} style={{ display: "grid", gridTemplateColumns: "34px 34px 1fr", gap: 4, alignItems: "center", fontSize: 12, padding: "4px 0" }}>
                      <input type="checkbox" checked={!!u.actionViews[a.key]} onChange={(e) => setPerm(u.id, "actionViews", a.key, e.target.checked)} />
                      <input type="checkbox" checked={!!u.actions[a.key]} onChange={(e) => { const val = e.target.checked; setPerm(u.id, "actions", a.key, val); if (val) setPerm(u.id, "actionViews", a.key, true); }} />
                      <span>{a.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView({ withholdingRate, setWithholdingRate, can }) {
  const editable = can("manageUsers");
  return (
    <div>
      <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 14 }}>Settings</h1>
      <div className="card" style={{ padding: 16, maxWidth: 360 }}>
        <label className="label">Withholding Percentage</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="input" type="text" inputMode="decimal" disabled={!editable} value={withholdingRate} onChange={(e) => setWithholdingRate(e.target.value)} style={{ width: 90 }} />
          <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>% applied to new expense entries</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ print overlay ------------------------------- */
function PrintOverlay({ doc, job, onClose }) {
  if (!job) return null;
  const fin = getFinancials(job);
  return (
    <div className="print-overlay">
      <div className="print-sheet">
        <PrintBody doc={doc} job={job} fin={fin} />
        <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button>
          <button className="btn" onClick={onClose}><X size={14} /> Close</button>
        </div>
      </div>
    </div>
  );
}
const printCell = { padding: "6px 8px", borderBottom: "1px solid #ddd", fontSize: 12, textAlign: "left" };
function PrintBody({ doc, job, fin }) {
  const Header = ({ title }) => (
    <div style={{ marginBottom: 16, borderBottom: "2px solid #111", paddingBottom: 10 }}>
      <div style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "#666" }}>Hadar Advertising</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>{job.jobNumber} · {job.clientName} · {fmtDate(new Date().toISOString())}</div>
    </div>
  );
  if (doc.type === "cost") {
    const totals = calc.costEstimateTotals(job.costEstimate.items);
    return (
      <div>
        <Header title="Cost Estimate" />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Item", "Category", "Unit", "Qty", "Unit Price", "Total", "Comment"].map((h) => <th key={h} style={{ ...printCell, fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>{job.costEstimate.items.map((i) => (
            <tr key={i.id}><td style={printCell}>{i.name}</td><td style={printCell}>{i.category}</td><td style={printCell}>{i.unit}</td>
              <td style={printCell}>{i.qty}</td><td style={printCell}>{fmtETB(i.unitPrice)}</td><td style={printCell}>{fmtETB(i.total)}</td><td style={printCell}>{i.comment || ""}</td></tr>
          ))}</tbody>
        </table>
        <div style={{ marginTop: 14, textAlign: "right", fontSize: 13 }}>
          <div>Cash Items Total: <b>{fmtETB(totals.cash)}</b></div>
          <div>Stock Items Total: <b>{fmtETB(totals.stock)}</b></div>
          <div style={{ fontSize: 16, marginTop: 6 }}>Grand Total: <b>{fmtETB(totals.grand)}</b></div>
        </div>
        {job.costEstimate.notes && <div style={{ marginTop: 16, fontSize: 11.5 }}><b>Notes:</b> {job.costEstimate.notes}</div>}
        <div style={{ marginTop: 20, fontSize: 11, color: "#666" }}>Prepared by {job.costEstimate.preparedBy || "—"} · {fmtDate(job.costEstimate.generatedAt)}</div>
      </div>
    );
  }
  if (doc.type === "budget") {
    return (
      <div>
        <Header title="Budget Breakdown" />
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["#", "Description", "Comment", "Amount"].map((h) => <th key={h} style={{ ...printCell, fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>{job.budget.items.map((i, idx) => (
            <tr key={i.id}><td style={printCell}>{idx + 1}</td><td style={printCell}>{i.label}</td><td style={printCell}>{i.comment || ""}</td><td style={printCell}>{fmtETB(i.amount)}</td></tr>
          ))}</tbody>
        </table>
        <div style={{ marginTop: 14, textAlign: "right", fontSize: 15 }}>Total Allocated: <b>{fmtETB(fin.budgetTotal)}</b></div>
        <div style={{ marginTop: 10, fontSize: 11, color: "#666" }}>Approved by {job.budget.approvedBy || "Pending"} {job.budget.approvedAt ? `· ${fmtDate(job.budget.approvedAt)}` : ""}</div>
      </div>
    );
  }
  if (doc.type === "payment") {
    return (
      <div>
        <Header title="Payment & Profit Summary" />
        <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
          {[["Final Price", fin.finalPrice], ["Advance Received", fin.advance], ["Remaining Payment", fin.remaining],
            ["Total Actual Expenses", fin.totalExpenses], ["Commission", fin.commissionAmount],
            ["Profit", fin.profitAmount], ["Profit %", `${fin.profitPercent}%`]].map(([k, v]) => (
            <tr key={k}><td style={{ ...printCell, fontWeight: 600 }}>{k}</td><td style={printCell}>{typeof v === "number" ? fmtETB(v) : v}</td></tr>
          ))}
        </tbody></table>
      </div>
    );
  }
  if (doc.type === "fulljob") {
    const ceTotals = calc.costEstimateTotals(job.costEstimate.items);
    const sectionTitle = (t) => <div style={{ fontSize: 13, fontWeight: 800, marginTop: 20, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid #ccc" }}>{t}</div>;
    return (
      <div>
        <Header title="Full Job Record" />

        {sectionTitle("Overview")}
        <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
          {[["Client", job.clientName], ["Contact", job.clientContact], ["Phone", job.clientPhone], ["Address", job.clientAddress],
            ["Title", job.title], ["Designer", job.designer], ["Status", job.status],
            ["Created", fmtDate(job.createdAt)], ["Closed", fmtDateTime(job.monitoring.closedAt)], ["Closed By", job.monitoring.closedBy]].map(([k, v]) => (
            <tr key={k}><td style={{ ...printCell, fontWeight: 600, width: 160 }}>{k}</td><td style={printCell}>{v || "—"}</td></tr>
          ))}
        </tbody></table>

        {sectionTitle("Sign Description")}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Item", "W (m)", "H (m)", "Qty", "LED Colour"].map((h) => <th key={h} style={{ ...printCell, fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>{job.components.map((c) => (
            <tr key={c.id}><td style={printCell}>{c.name}</td><td style={printCell}>{c.width}</td><td style={printCell}>{c.height}</td><td style={printCell}>{c.qty}</td><td style={printCell}>{c.ledColor}</td></tr>
          ))}</tbody>
        </table>

        {sectionTitle("Cost Estimate")}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Item", "Category", "Unit", "Qty", "Unit Price", "Total"].map((h) => <th key={h} style={{ ...printCell, fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>{job.costEstimate.items.map((i) => (
            <tr key={i.id}><td style={printCell}>{i.name}</td><td style={printCell}>{i.category}</td><td style={printCell}>{i.unit}</td><td style={printCell}>{i.qty}</td><td style={printCell}>{fmtETB(i.unitPrice)}</td><td style={printCell}>{fmtETB(i.total)}</td></tr>
          ))}</tbody>
        </table>
        <div style={{ textAlign: "right", fontSize: 12, marginTop: 6 }}>Grand Total: <b>{fmtETB(ceTotals.grand)}</b></div>

        {sectionTitle("Budget Breakdown")}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["#", "Description", "Comment", "Amount"].map((h) => <th key={h} style={{ ...printCell, fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>{job.budget.items.map((i, idx) => (
            <tr key={i.id}><td style={printCell}>{idx + 1}</td><td style={printCell}>{i.label}</td><td style={printCell}>{i.comment || ""}</td><td style={printCell}>{fmtETB(i.amount)}</td></tr>
          ))}</tbody>
        </table>
        <div style={{ fontSize: 11, marginTop: 6 }}>Approved by {job.budget.approvedBy || "—"} · {fmtDate(job.budget.approvedAt)}</div>

        {sectionTitle("Expenses")}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Date", "Purchaser", "Item", "Qty", "Unit Price", "Total", "Withholding", "Budget Ref"].map((h) => <th key={h} style={{ ...printCell, fontWeight: 700 }}>{h}</th>)}</tr></thead>
          <tbody>{job.expenses.map((e) => (
            <tr key={e.id}><td style={printCell}>{fmtDate(e.date)}</td><td style={printCell}>{e.purchaser}</td><td style={printCell}>{e.item}</td><td style={printCell}>{e.qty}</td><td style={printCell}>{fmtETB(e.unitPrice)}</td><td style={printCell}>{fmtETB(e.totalPrice)}</td><td style={printCell}>{fmtETB(e.withholding)}</td><td style={printCell}>{e.budgetRef || ""}</td></tr>
          ))}</tbody>
        </table>

        {sectionTitle("Payments & Profit")}
        <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
          {[["Final Price", fin.finalPrice], ["Advance Received", fin.advance], ["Remaining Payment", fin.remaining],
            ["Total Actual Expenses", fin.totalExpenses], ["Commission", fin.commissionAmount],
            ["Profit", fin.profitAmount], ["Profit %", `${fin.profitPercent}%`]].map(([k, v]) => (
            <tr key={k}><td style={{ ...printCell, fontWeight: 600, width: 160 }}>{k}</td><td style={printCell}>{typeof v === "number" ? fmtETB(v) : v}</td></tr>
          ))}
        </tbody></table>

        {sectionTitle("Reconciliation & Closing")}
        <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
          <tr><td style={{ ...printCell, fontWeight: 600, width: 160 }}>Reconciliation</td><td style={printCell}>{job.reconciliation?.status || "Pending"}{job.reconciliation?.note ? ` — ${job.reconciliation.note}` : ""}</td></tr>
          <tr><td style={{ ...printCell, fontWeight: 600 }}>Withholdings Collected</td><td style={printCell}>{job.checklist.withholdingCollected ? "Yes" : "No"}</td></tr>
          <tr><td style={{ ...printCell, fontWeight: 600 }}>Receipt Attached</td><td style={printCell}>{job.checklist.receiptAttached ? "Yes" : "No"}</td></tr>
        </tbody></table>
      </div>
    );
  }
  return null;
}
