# Hadar Advertising — Job Management App
## Handoff Brief: Prototype → Production Build

**Purpose of this document:** Everything below was built and validated as a client-side React prototype (`hadar-job-management-prototype.jsx`) through extensive iteration with the business owner. The prototype is the **source of truth for behavior** — every workflow, permission, formula, and screen layout described here was tested and confirmed working in that file. This document exists so a production build (real backend, real database, real auth) can be built from a clear spec instead of reverse-engineering the prototype's React state management.

**How to use this document:** Read this brief first for the full picture. Then open `hadar-job-management-prototype.jsx` directly to see exact field names, exact formulas, and exact UI copy — the prototype is annotated with comments explaining non-obvious decisions. Where this document and the prototype ever disagree, **the prototype is correct** — this document may have summarized or simplified something.

---

## 1. What This App Is

A job/project management system for **Hadar Advertising**, a signage manufacturing business in Addis Ababa (Hayahulet, Bata Complex Building, 2nd Floor). It tracks a signage job from client intake through design, cost estimation, budget approval, expense tracking, inventory, reconciliation, and closing — plus supporting tools (a shared material price database, standalone purchase orders, and inventory tracking) that aren't tied to any single job.

The business runs two related companies (Hadar Advertising — signage manufacturing — and Canvas Interior Design and Finishing); this app is scoped to Hadar's signage job workflow specifically.

---

## 2. Recommended Tech Stack

The prototype explicitly avoided introducing a real backend so the workflow could be validated cheaply. For production:

- **Frontend:** Next.js (React), reusing the prototype's component structure and Tailwind-less inline-style design system almost directly — the UI has already been through many rounds of real user feedback and should not be redesigned from scratch.
- **Backend:** Next.js API routes or a separate Node/Express service.
- **Database:** PostgreSQL (via Prisma or a similar ORM). The prototype's `useState` shape maps closely to relational tables — see Section 4.
- **Auth:** Real session-based or JWT auth with hashed passwords (bcrypt/argon2). The prototype's login is a hardcoded username/password list in plaintext — **do not carry this forward**, it exists only for prototype demo convenience.
- **File storage:** S3-compatible object storage for every uploaded picture/document (receipts, advance payment proof, sign art, etc.). The prototype stores these as base64 data URIs directly in React state — fine for a demo, unusable in production (doesn't persist, doesn't scale, bloats every state update).
- **Permissions:** Enforced server-side on every API route, using the same permission model described in Section 5 — not just hidden in the UI like the prototype does.

---

## 3. Core Concepts

- **Job** — the central object. One signage project for one client, moving through a fixed lifecycle (Section 6).
- **Price Database** — a single shared catalog of materials (name, category [Cash/Stock], unit, unit price, default quantity, active flag, price history). Powers the Cost Estimate fill-in sheet on every job. Editable by permission, with full price-change history tracked.
- **Purchase Orders** — standalone, job-independent purchases (office supplies, anything not billed to a project). Separate approval workflow, separate from any job's Budget/Expenses.
- **Inventory** — a running ledger of Stock In / Stock Out movements for Stock-category materials, with automatic integration into job Budget approval and Expense reconciliation (Section 9).
- **Users & Roles** — five roles (Designer, Supervisor, Manager, Owner/Finance, Admin), each with sensible default permissions, but **every individual permission is independently toggleable per user** by an Admin. Do not hardcode role-based logic anywhere except as the *default* permission set assigned when a user is created.

---

## 4. Data Model

### 4.1 Job

```
Job {
  id
  jobNumber            e.g. "HAD-2026-0001" (auto-generated, sequential)
  status               enum: Draft | Waiting for Approval | Approved Budget |
                             Waiting for Reconciliation | Closed | Cancelled
  previousStatus        (used to restore after Cancelled)
  deadline              date, set at budget approval time (see 4.9)

  // Client intake
  clientName, clientContact, clientPhone, clientAddress, clientNotes
  title                 job title, e.g. "Storefront Signage Package"

  // Design
  designer, supervisor
  productionNotes        (supports Amharic text)
  components[]           Sign Description line items:
                          { id, name, width (m, decimal), height (m, decimal),
                            qty, ledColor (free text), art: {name, url, kind} }

  // Cut List — file-upload only, no structured data
  cutFiles[]              { name, url, kind, uploadedBy, uploadedAt }

  // Cost Estimate
  costEstimate: {
    items[]                { id, materialId?, name, category (cash|stock),
                              unit, qty, unitPrice, total, source
                              (Manual — ad-hoc, or matched from Price Database),
                              comment }
    notes
    soldPrice              manually entered — the price quoted to the client
    commissionActive       boolean toggle
  }

  // Budget (Admin-filled, approval gate for the whole job)
  budget: {
    items[]                { id, label, amount (ETB, cash rows) OR
                              qty+unit (stock rows), category (cash|stock),
                              comment, source (Manual | "Cost Estimate" —
                              pulled), materialId?, qty?, unit? }
    status                  Draft | Approved
    approvedBy, approvedAt
  }

  // Expenses — two parallel sheets under one job
  expenses[]                 {
    id, entryType (purchase|receipt), source (Manual|Budget — pulled),
    category (cash|stock — Purchases only), purchaser, date, item,
    description, qty, unit (stock only), unitPrice, totalPrice,
    budgetRef (label of matched budget line),
    withholding (auto: 3% of totalPrice, only if totalPrice > 20,000 ETB),
    actualSpent            ETB for Cash rows / QTY for Stock rows — see 9.3
    receipt: {name,url,kind}, flagged (bool)
  }

  // Payments — actual money received, nothing else
  payments[]                  { id, amount, type (Advance|Final|Other —
                                 "Advance" only ever auto-created once, at
                                 job creation — never user-selectable again),
                                 method, date, notes, receipt }

  // Reconciliation
  reconciliation: { status (Pending|Reconciled|Flagged), note,
                     reconciledBy, reconciledAt }
  checklist: { withholdingCollected: bool, receiptAttached: bool }

  // Monitoring / closing
  monitoring: { closed: bool, closedAt, closedBy }

  activity[]                 { ts, text } — append-only audit trail
  createdAt, updatedAt
}
```

### 4.2 Price Database (Material)

```
Material {
  id, name, category (cash|stock), unit, rate (ETB, nullable if unpriced),
  defaultQty (nullable), active (bool),
  notes,
  priceHistory[]            { oldPrice, newPrice, effectiveDate, changedBy }
}
```

Seeded from the real Hadar Sign Shop price list (Mica, Transparent Mica 8mm, LED Module, LED Strip, Foam variants, Aluminum panels, Power Supply, etc.) — see prototype source for the full seed list and which items are marked inactive (no confirmed price yet, e.g. many stock/consumable items: Socket, Screws, Paint, UV Print, MDF, etc. — these were explicitly left unpriced rather than guessed, per the business owner's instruction).

### 4.3 Purchase Order

```
PurchaseOrder {
  id, poNumber (e.g. "PO-2026-0001"), status (Pending|Approved|Rejected),
  date, purchaser, item, description, category (cash|stock), qty, price, total,
  approvedBy, approvedAt, note (rejection reason — required on reject),
  history[]                  { ts, text }
  createdAt
}
```

### 4.4 Inventory Ledger Entry

```
InventoryEntry {
  id, date, direction (in|out), materialId (nullable), itemName, qty, unit,
  source                     string, e.g. "Budget approved — HAD-2026-0002",
                              "Manual purchase — HAD-2026-0002",
                              "Actual spent adjustment — HAD-2026-0002", "Manual"
  note, createdBy, jobId (nullable — null for non-job-related entries),
  adjustmentForExpenseId (nullable — links a qty-reconciliation entry back
                            to the specific expense row that triggered it,
                            so re-editing that row's Actual Spent replaces
                            the adjustment instead of stacking a new one)
  createdAt
}
```

**Current on-hand balance per material is *derived*, not stored**: `balance = sum(in entries' qty) − sum(out entries' qty)`, grouped by `materialId` (or by `itemName` when no `materialId`). Do not add a mutable "current stock" column — recompute it, or maintain it via a database view/materialized aggregate to avoid drift.

### 4.5 User & Permissions

```
User {
  id, username, passwordHash, name, role (Designer|Supervisor|Manager|
                                            Owner/Finance|Admin),
  active (bool),
  actions: { [actionKey]: bool }        — "Allow Edit" per action
  actionViews: { [actionKey]: bool }    — "Allow View" per action (paired)
  pages: { [pageKey]: bool }            — nav page visibility
  tabs: { [tabKey]: bool }              — single-checkbox view-only toggles
                                           (Job Detail tabs AND Dashboard
                                           items — see Section 5.3)
}
```

New users get `actions`/`actionViews`/`pages`/`tabs` initialized from role defaults (Section 5.4), then are fully independently editable per-user from that point on. **Nothing about permissions should ever be hardcoded by role at read time** — always check the user's actual stored permission object.

---

## 5. Permission System — Full Specification

This is the most structurally important part of the app to get right, because the business owner iterated on it extensively and expects fine-grained control.

### 5.1 Three permission dimensions

1. **Pages** (`PAGE_KEYS`) — top-level nav visibility. One checkbox each.
2. **Actions** (`ACTION_KEYS`) — paired **Allow View** / **Allow Edit** checkboxes. "Edit" auto-grants "View" in the UI (checking Edit should visually/functionally also check View). Actions gate specific buttons, forms, and interactive pieces — not whole pages or tabs.
3. **Tabs** (`TAB_KEYS`) — single **Allow View** checkbox, no edit pairing. Gates visibility of an entire tab/section (both inside a Job's detail view, and on the Dashboard).

### 5.2 Full `PAGE_KEYS` list

```
dashboard, jobs, calculator (labeled "Price Database" in nav),
inventory, reconciliation, users, settings
```

(There is intentionally no "reports" page — it was built, then explicitly removed by the business owner. Do not re-add it unless asked.)

### 5.3 Full `TAB_KEYS` list

Job Detail tabs:
```
tab_overview, tab_design, tab_cutlist, tab_cost, tab_budget,
tab_expenses, tab_payments, tab_activity
```

Dashboard items (each is its own independent toggle, decoupled from any other permission that might otherwise imply access):
```
dash_draft, dash_approval, dash_budget, dash_reconciliation,
dash_remaining, dash_purchaseOrders
```

### 5.4 Full `ACTION_KEYS` list (View/Edit pairs)

```
createJob                    Create new jobs
manageDraftJobs               See and edit draft jobs (deliberately decoupled
                               from createJob — someone can create jobs
                               without seeing others' drafts, or vice versa)
editDesign                    Edit design spec & components
editCutList                   Edit cut list (file uploads)
manageCostEstimate            Fill Cost Estimate quantities (Cash/Stock sheet)
addCostEstimateItem            Add ad-hoc items to Cost Estimate
manageSalePriceProfit          View & edit the Sale Price & Profit card
                               (View=false HIDES the whole card, not just
                               disables editing — this was an explicit ask)
manageCostEstimateNotes        Edit Cost Estimate notes
submitForApproval              Submit a Draft job for approval
approveBudget                  Approve a submitted budget (also implies
                               requestRevision — see below)
manageBudget                   Edit budget line items
editApprovedJob                Unlock an approved job's content for editing
submitForReconciliation        Submit an approved-budget job for reconciliation
                               (BLOCKED — button disabled — until at least
                               one expense has been logged; see 9.1)
manageExpenses                 Log purchases/receipts in Expenses
managePayments                  Record payments
reconcileBudget                 Mark a job Reconciled / Flagged / Pending
closeJob                       Close a job (only after Reconciled)
reopenJob                       Reopen a closed job
cancelJob                       Cancel a job (any non-terminal status)
manageSignagePrices              Edit the Price Database
manageInventory                  Record manual Stock In/Out
submitPurchaseOrder              Issue a Purchase Order
approvePurchaseOrder             Approve/reject a Purchase Order (rejecting
                                 requires a typed reason, shown to whoever
                                 issued it)
manageUsers                      Manage users & permissions
```

Note: `requestRevision` (sending a submitted job back to Draft) is an **implied** permission — it reuses whatever `approveBudget` is set to, since the person reviewing a submission is the one positioned to reject it. Don't create a separate stored permission for it.

### 5.5 Default permission sets by role

These are **only the initial values assigned when a user is created** — never branch logic on `role` directly anywhere else in the app.

| Role | Notable defaults |
|---|---|
| **Designer** | editDesign, editCutList; tabs: overview/design/cutlist/activity; dashboard: approval/budget/reconciliation |
| **Supervisor** | editCutList, manageExpenses, submitForReconciliation, submitPurchaseOrder; tabs: overview/design/cutlist/expenses/activity; dashboard: approval/budget/reconciliation/purchaseOrders |
| **Manager** | createJob, manageDraftJobs, submitForApproval; tabs: overview/design/cutlist/cost/activity; dashboard: draft/approval/budget/reconciliation |
| **Owner/Finance** | createJob, manageDraftJobs, submitForApproval, manageCostEstimate, addCostEstimateItem, manageSalePriceProfit, manageCostEstimateNotes, manageInventory; pages: dashboard/jobs/calculator/inventory/reconciliation; dashboard: draft/approval/budget/reconciliation/remaining |
| **Admin** | Everything. Every action, every page, every tab. This is the only role that should get a blanket "all true" default — every other role's default set should be assembled explicitly. |

**Payments & Profit tab (`tab_payments`) is Admin-only by default, at every job phase, for every other role** — this was an explicit, repeated design decision.

---

## 6. Job Lifecycle

```
Draft → Waiting for Approval → Approved Budget → Waiting for Reconciliation → Closed
                                                                    ↕
                                                                 (Cancelled — from any
                                                                  non-terminal status,
                                                                  restorable back to
                                                                  previousStatus)
```

- **Draft**: visible only to users with `manageDraftJobs`. Design, Cut List, Cost Estimate are editable here.
- **Draft → Waiting for Approval**: via "Submit for Approval" (permission: `submitForApproval`). Clears any prior `revisionNote`.
- **Waiting for Approval**: Admin (or whoever has `approveBudget`) either:
  - **Requests Revision** — must type a reason (required, non-empty) before the job goes back to Draft. The reason is stored (`job.revisionNote`, `job.revisionNoteBy`) and shown as a prominent banner on the Design tab so whoever picks it back up knows exactly what to fix.
  - **Approves the Budget** — see Section 6.1, this is a two-step flow requiring a deadline.
- **Approved Budget**: Design/Cut List/Cost Estimate/Budget lock for everyone. Admin has an "Unlock for Editing" toggle (`editApprovedJob`) to reopen them if needed. Expenses become active.
  - Moving to **Waiting for Reconciliation** (via "Submit for Reconciliation") is **blocked** — button disabled — until at least one expense has been logged. Show a hint explaining why.
- **Waiting for Reconciliation**: Admin reviews Budget-vs-Actual variance, Payment Records, Receipts & Withholdings, and Final Profit (all on the **Reconciliation page**, not scattered — see Section 8.6), then marks the job Reconciled (or Flags it with a required reason).
- Once Reconciled: the **Final Checklist** (withholding collected + receipt attached, both manual checkboxes) plus the Reconciled status together unlock **Close Job**. Before Reconciled, the Close Job button doesn't render at all — just an explanatory note that it'll appear once reconciliation is done.
- **Closed**: fully locked, printable full job record available. Can be reopened (`reopenJob`) back to Waiting for Reconciliation.
- **Cancelled**: available from any non-terminal status (`cancelJob`, two-step confirm). Restorable back to `previousStatus`.

### 6.1 Budget Approval — the two-step deadline flow

There are **two entry points** to the exact same "approve budget" action — a header shortcut button ("Approve Budget & Move to Implementation") and a button inside the Budget tab itself ("Approve Budget"). **Both must behave identically** and both require the following two-step flow:

1. Click Approve Budget → an inline date picker appears (not a modal, not a separate page — inline, matching the "Request Revision" comment-box pattern) asking for a **deadline**.
2. The "Confirm Approval" button is disabled until a date is chosen.
3. On confirm: `job.status` → `Approved Budget`, `job.budget.status` → `Approved`, `job.deadline` is set, **and** every Stock-category budget line with a real quantity is automatically deducted from Inventory (Section 9.1).

The deadline then displays as a color-coded badge (amber if upcoming, red if past-due and the job isn't Closed/Cancelled) next to the client name **everywhere the job appears**: Jobs list, Dashboard rows, Job Detail header.

If a budget approval is later **undone** ("Undo Approval," only available after an Admin unlock), the automatic Inventory deductions from that approval must be **reversed by adding offsetting Stock In entries** — never by deleting the original Stock Out entries. The ledger should always read as a complete, honest audit trail; nothing gets silently erased.

---

## 7. Business Rules & Formulas

Get every one of these exactly right — the business owner tested each formula explicitly.

### 7.1 Withholding tax
```
withholding(amount) = amount > 20,000 ETB  ?  round2(amount × 3%)  :  0
```
Applies uniformly everywhere an expense/purchase/receipt total is computed. A single flat 3% with no threshold was an earlier bug — the threshold is a hard requirement.

### 7.2 Cost Estimate — Sub Total / Commission / Profit / Grand Total
```
Sub Total     = sum(Cash Items totals) + sum(Stock Items totals)
Commission    = commissionActive  ?  round2(Sub Total × 7%)  :  0
Profit        = round2(Sold Price − Sub Total − Commission)
                (Commission only subtracted when the toggle is active)
Grand Total   = Sold Price
```
"Grand Total" deliberately means the final client-facing sale figure here, not the material cost sum (that's "Sub Total" — this rename was an explicit request to disambiguate the two concepts).

The **Sale Price & Profit card is gated by its own permission** (`manageSalePriceProfit`) — when the View half of that permission is off, the entire card must not render, not just show as read-only.

### 7.3 Budget — Cash vs. Stock display and totals
- **Total Allocated (Cash)** = sum of `amount` across budget items where `category !== "stock"`. **Stock items are entirely excluded from this total** — they represent inventory already on hand, not new cash spend needing approval.
- In the Budget line-item table, **Stock rows show/edit Quantity + Unit** in place of the ETB amount column; **Cash rows show/edit the ETB amount** as normal.
- "Pull From Cost Estimate" generates one Budget row per Cost Estimate line (both Cash and Stock), carrying over `category`, `materialId`, `qty`, and `unit` — this is what makes the Inventory auto-deduction (7.5) possible. Re-running the pull only refreshes rows it previously generated (tagged `source: "Cost Estimate"`); manually-added rows (Labor, Contingency, etc.) are untouched.

### 7.4 Purchases sheet — Actual Spent & Variance (this is the trickiest rule in the app)

Every Purchase row has a manually-typed **Actual Spent** field, blank by default (never auto-filled from the budgeted/planned amount). Its meaning depends on the row's category:

- **Cash rows**: Actual Spent is an **ETB amount**. Variance = `actualSpent − totalPrice`.
- **Stock rows**: Actual Spent is a **quantity** (matching the row's unit). Variance is computed *in ETB for display purposes only*: `variance_ETB = (actualQty − budgetedQty) × unitPrice`.

Then, per row, based on **source**:

- **`source === "Budget"`** (pulled from a real budget line): if Actual Spent is filled in, show "Over Budget by ETB X" / "Under Budget by ETB X" / "On Budget" using the formulas above. If not filled in, show nothing (a dash) — don't guess.
- **`source === "Manual"`** (never pulled from any budget line — genuinely unbudgeted): **the row's full amount counts entirely as Over Budget**, always, regardless of category and regardless of whether Actual Spent has been filled in (use Actual Spent if present, otherwise fall back to the originally-entered `totalPrice`). There was never a budget line to be "under," so "Under Budget" never applies to a manual row. **This rule does not change even when a manual row is Stock-category and gets auto-registered in Inventory** — being tracked in Inventory doesn't exempt an unbudgeted purchase from counting as an overage.

The **"Over Budget" / "Under Budget" stat cards** at the top of the Expenses tab sum these per-row variances across every Purchase row (never Receipts — see 7.6) using exactly this logic.

### 7.5 Stock Actual Spent → automatic Inventory reconciliation

When Actual Spent is set/changed on a **Stock-category** Purchase row (regardless of `source`):

```
committedQty = row.qty     (the qty already used for that row's original
                             Inventory deduction — either the budgeted qty,
                             for Budget-pulled rows deducted at approval time,
                             or the row's own entered qty, for Manual rows
                             deducted immediately at creation time)
actualQty    = Number(actualSpent) || committedQty (if left blank, no delta)
delta        = actualQty − committedQty
```

- If `delta === 0`: remove any previous adjustment entry for this row (see below) and stop.
- If `delta !== 0`: create **one** Inventory ledger entry — `direction: delta > 0 ? "out" : "in"`, `qty: abs(delta)` — tagged with `adjustmentForExpenseId = row.id`.
- **Before creating the new adjustment, remove any previous adjustment entry with the same `adjustmentForExpenseId`.** Re-editing Actual Spent should *replace* the correction, never stack multiple corrections from repeated edits.

This means a Stock row's full Inventory lifecycle is: (1) initial deduction at Budget approval or at manual-purchase creation, using the planned/entered quantity, then (2) a single corrective adjustment once Actual Spent is recorded, capturing the gap between planned and real usage.

### 7.6 Expenses stat cards — scope precisely

- **Total Purchases** = sum of `totalPrice` across **Purchases only**. Must **never** include Receipts — this was a real bug that had to be fixed (it was accidentally summing all of `job.expenses`, both sheets, at one point).
- **Total Withholding** = sum of `withholding` across all of `job.expenses` (both Purchases and Receipts — withholding legitimately applies to both).
- **Collected Receipts** = count of `job.expenses` entries (either sheet) that have a `receipt` file attached.
- **Over Budget / Under Budget** = per Section 7.4, Purchases only.

### 7.7 Remaining Payment (used on Dashboard, Jobs list, and Reconciliation)

```
remaining = max(0, round2(job.costEstimate.soldPrice − advancePaid − finalPaid))
```

Where `advancePaid` = sum of Payments with `type === "Advance"` (in practice, exactly one such payment per job — see 7.8), and `finalPaid` = sum of Payments with `type === "Final"`.

**The `max(0, ...)` clamp is essential.** If Advance + Final happens to add up to exactly the Sold Price (or overshoots it), the result must land cleanly at `0` — never a negative number, never a stray floating-point remainder like `-0.0000001`. A job that's fully paid off should disappear from any "outstanding balance" list entirely.

### 7.8 Advance payment — captured once, at job creation, never again

- The **Create Job form requires an Advance Payment amount and a picture of the payment** (receipt, transfer screenshot, etc.) before the "Create Job" button becomes clickable. Both the amount and the picture are mandatory.
- This creates exactly one `Payment` record of `type: "Advance"` at job creation, with the uploaded picture attached as its `receipt`.
- **"Advance" is removed as a selectable option in the Payment Records form thereafter** — only "Final" and "Other" remain selectable. This prevents a second Advance entry ever being logged for the same job (which would double-count against Remaining Payment). If a genuine second advance/partial payment is ever needed, it should be logged as "Other."
- The advance payment's picture displays in the Job's **Overview** tab (its own small card: thumbnail, amount, date, filename) in addition to appearing in Payment Records and on the Reconciliation page's Payment Records section.

### 7.9 Purchase Order approval

Same shape as Job budget rejection: **rejecting a Purchase Order requires a typed reason** before the rejection can be confirmed, and that reason is stored and shown alongside the Rejected status badge.

---

## 8. Page-by-Page Functional Spec

### 8.1 Dashboard

Tab-card row at top (each tab independently gated per Section 5.3's `dash_*` tab keys), each showing a count badge — **except Remaining Payments, which shows the aggregate ETB total across all open jobs with an outstanding balance, not a count.** Clicking any tab-card shows that tab's content below.

- **Draft** — jobs in Draft status.
- **Waiting for Approval** — jobs awaiting budget approval.
- **Approved Budget** — jobs in implementation.
- **Waiting for Reconciliation** — jobs awaiting reconciliation.
- **Remaining Payments** — every non-Closed/non-Cancelled job with `remaining > 0` (Section 7.7), sorted highest-first, each row clickable straight into that job.
- **Purchase Orders** — the full Purchase Order issue/approve panel (Section 8.7), embedded directly as this tab's content, not a separate page.

Each job row in every list-style tab shows the deadline badge (Section 6.1) next to the client name, when set.

### 8.2 Jobs (list)

Standard filterable/searchable list. Columns: Job ID, Client (+ deadline badge), Status, Designer, [Final Price / Advance / Remaining — only for users who can see financial tabs], Updated, **Record** (a "Print" button that appears only on Closed jobs, opening the full historical job record without needing to open the job first), chevron.

"New Job" opens the Create Job form (Section 7.8 for the mandatory advance payment requirement).

### 8.3 Job Detail — tabs

- **Overview** — client info, team/timing, financial snapshot (permission-gated), and the Advance Payment card (Section 7.8) when applicable.
- **Design** — Sign Description components (name, width/height in **meters with decimal support**, qty, LED colour as **free text**, art upload with click-to-enlarge). Job-level Production Notes (Amharic-friendly) and Designer field. Shows the Revision Note banner when the job was sent back from Waiting for Approval.
- **Cut List** — pure file upload (JPEG/PDF/AI), no structured cut-list data model. Multiple files, each with inline preview.
- **Cost Estimate** — the full-catalog fill-in sheet (every active Price Database material listed as a row with an editable Qty box; typing a qty upserts a line item), split into Cash Items / Stock Items tables, each with its own "Add Item" button for ad-hoc entries. Below that: the Sale Price & Profit card (Section 7.2, permission-gated) and a Notes section.
- **Budget** — line-item table (Description, Category dropdown, Comment, Amount-or-Qty+Unit depending on category). "Pull From Cost Estimate" button. Approve/Undo Approval with the deadline flow (Section 6.1). Total Allocated (Cash) stat only — no Stock Value box (explicitly removed).
- **Expenses** — two always-visible sheets (**not** a toggle — this was an explicit design decision to keep both visible simultaneously): **Purchases** (with the Category dropdown, Actual Spent, and Variance columns per Section 7.4) and **Receipts** (with Withholding shown, no Budget Ref/Status columns). Stat cards per Section 7.6. "Pull From Budget" pulls both Cash and Stock lines.
- **Payments & Profit** — Payment Records only (table + record-payment form). Everything else that used to live here (pricing fields, the Final Checklist, Close Job) has been deliberately moved elsewhere — do not restore them here.
- **Activity** — append-only audit log.

### 8.4 Price Database (nav: "Price Database")

Single page — search, per-row inline editing (name, category, unit, rate, default qty, active), price-change history (expandable per row), "add new material" row at the bottom. This is the **one shared catalog** that powers every job's Cost Estimate fill-in sheet — editing a price here updates every job's Cost Estimate display live (they read from the same table, not a snapshot).

### 8.5 Inventory (nav)

- **Current Balances** table at top (derived, per Section 4.4).
- **Stock In** tab — filtered ledger + manual recording form (pick a Stock material from Price Database or type a name, qty, date, note).
- **Stock Out** tab — same, filtered to outbound.
- **Inventory Transactions** tab — **all** entries (both directions), sorted most-recent-first, with a **Project column** resolving `jobId` to `"{jobNumber} — {clientName}"` (clickable into that job), or a dash for entries with no associated job.

### 8.6 Reconciliation (nav)

**List → detail flow, not everything inline on one page.** The nav page opens on a job list (Job #, Client, Status, Allocated, Actual, Variance, Reconciliation status) — clicking a row opens that job's full **Reconciliation Documents** page, which consolidates exactly five things:

1. **Budget vs. Expense Variance** — line-by-line, plus Mark Reconciled / Flag for Review (reason required) / Revert to Pending actions.
2. **Payment Records** (read display, including receipt thumbnails).
3. **Receipts & Withholdings** — every expense with a receipt attached, plus the total withholding figure.
4. **Final Profit After Expenses** — `Sold Price − Actual Total Expenses − Commission (if active)`, clearly formula-labeled on screen.
5. **Final Checklist** — the two manual checkboxes, plus **Close Job**, which only renders once the job's reconciliation status is actually `Reconciled` (before that, show an explanatory placeholder instead of a disabled button).

### 8.7 Purchase Orders (embedded in Dashboard, not a separate nav page)

Form: Date, Purchaser, Item, Description, Category (Cash/Stock dropdown), Qty, Price → Total computed live. "Submit for Approval" creates a `Pending` PO. Whoever has `approvePurchaseOrder` sees Approve / Reject buttons on Pending rows; Reject requires a typed reason (Section 7.9).

### 8.8 Users (nav, Admin-gated page)

Per-user card: name, username, role dropdown (resets to role defaults on change), active/deactivate toggle, password reset (inline, no browser `prompt()`), delete (two-step confirm, blocked for self-delete), and the full permissions editor (Pages checkboxes, Tabs checkboxes, Actions View/Edit checkbox grid) exactly per Section 5.

### 8.9 Settings (nav, Admin-gated page)

Withholding percentage setting (currently 3%, editable — note this is a *rate* setting; the *threshold* of 20,000 ETB from Section 7.1 was hardcoded in the prototype and should probably become a setting too in production).

---

## 9. UI/UX Conventions to Preserve

These patterns repeat throughout the app and should be treated as house style, not one-off choices:

- **Rejection/reversal actions require a typed reason** before they can be confirmed (Request Revision, Flag for Review, Reject Purchase Order) — inline text input + disabled confirm button until non-empty, never a browser `prompt()`.
- **Two-step destructive confirms** (Cancel Job, Delete User) — click once to reveal a "Confirm / Never Mind" pair, not a native `confirm()` dialog.
- **No native browser dialogs anywhere** (`alert`, `confirm`, `prompt`) — everything is inline UI state.
- **File uploads always show an inline thumbnail with click-to-enlarge** (a lightbox overlay), consistently, everywhere a picture or PDF is attached — receipts, advance payment proof, price list files, Sign Description art.
- **Numeric inputs must support free typing of decimals** — this was a recurring real bug (values under 1, like `0.1`, would get silently stripped mid-keystroke when the input was bound too tightly to a parsed number on every change). In the production build, don't re-parse a numeric field to a `Number` on every keystroke; store the raw string during editing and parse only when computing derived values or on blur/submit.
- **"Pull From X" buttons** (Cost Estimate → Budget, Budget → Expenses) are idempotent and non-destructive: re-running one refreshes only the rows it previously generated (tagged by a `source` field), never touching manually-added rows.
- **Permission-gated UI hides things entirely** rather than showing them disabled/greyed-out, in most cases — especially for View-level gates (e.g., the Sale Price & Profit card). Edit-level gates more often show read-only content instead of hiding it (e.g., Budget line items display as plain text instead of inputs when the user lacks edit rights, so they can still *see* the numbers).

---

## 10. Known Simplifications in the Prototype (things production should NOT copy)

- **Plaintext passwords in a hardcoded array** — replace entirely, do not migrate the actual seed passwords into production.
- **All files as base64 data URIs in memory** — replace with real object storage; store just the URL/key in the database.
- **Client-side-only permission enforcement** — every permission check in this document must be re-enforced server-side on the corresponding API route, not just hidden in the UI.
- **No real persistence** — obviously; this is the entire point of the production build.
- **Print/export uses the browser's native print dialog** (`window.print()`), not real PDF generation. Confirm with the business owner whether this is acceptable for production or whether real PDF export (invoices, job records) is needed.
- **Dates use plain JS `Date`, single timezone assumed** (Addis Ababa). Fine as-is unless multi-timezone use is ever needed.
- **Job numbers are a simple in-memory incrementing counter** (`HAD-2026-0001`, etc.) — needs to become a real atomic sequence in the database to avoid collisions under concurrent job creation.

---

## 11. Suggested Build Order

1. **Data model + migrations** (Section 4) — get the schema right first; almost everything else depends on it.
2. **Auth + permission enforcement** (Section 5) — build this as a first-class concern from day one, not bolted on later. Every API route should check the calling user's stored permission object.
3. **Job CRUD + lifecycle** (Section 6) — the core object and its status machine.
4. **Price Database + Cost Estimate** — these are tightly coupled (Cost Estimate reads live from Price Database).
5. **Budget + the deadline-approval flow** (6.1) — including the Inventory auto-deduction side effect (7.5), which needs Inventory to exist first.
6. **Inventory** (Section 8.5) — needed before Budget approval can fully work end-to-end.
7. **Expenses** (Purchases + Receipts, Section 7.4–7.6) — the most formula-dense part of the app; test the Over/Under Budget math thoroughly against the rules in Section 7.4.
8. **Payments + Remaining Payment math** (7.7–7.8).
9. **Reconciliation page** (8.6) — pulls together data from most other modules, build it last among the job-related features.
10. **Purchase Orders + Users/Permissions UI + Settings** — mostly independent, can be built in parallel with the above once auth exists.
11. **File upload/storage integration** — thread through last, since almost every module has an upload point; get the interaction patterns right once, then apply everywhere.

---

*This brief reflects the state of `hadar-job-management-prototype.jsx` as of the end of the prototyping session. If further changes are made to the prototype after this document is written, re-sync this brief (or just point Claude Code directly at the updated prototype file with a note about what changed).*
