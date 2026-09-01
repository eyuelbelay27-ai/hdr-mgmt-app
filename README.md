# Hadar Advertising — Job Management App

Production build for Hadar Advertising's signage job management workflow,
built from a validated client-side React prototype (`F hadar-job-management-prototype.jsx`,
this repo root) and its handoff brief (`HANDOFF_BRIEF.md`). The prototype is
the source of truth for every workflow, permission, formula, and screen
layout — where this README and the prototype ever disagree, the prototype
wins. Section numbers referenced below (e.g. "Section 7.4") refer to
`HANDOFF_BRIEF.md`.

The production app lives in `app/` (Next.js + Prisma/Postgres + Auth.js).

## What's built

Every step of the brief's Section 11 build order has a working implementation:

1. **Data model + migrations** (Section 4) — `app/prisma/schema.prisma`.
   Every entity in the brief (Job + its sub-tables, Material/Price Database,
   Purchase Orders, Inventory ledger, Users/Permissions, Settings) is modeled
   relationally, with atomic per-year `JobSequence`/`PoSequence` counters
   (Section 10's known-gap) and unique links (`CostEstimateItem` ↔
   `BudgetItem` ↔ `Expense`) that make "Pull From X" buttons idempotent.
2. **Auth + permission enforcement** (Section 5) — bcrypt-hashed credentials
   via Auth.js (`auth.ts`/`auth.config.ts`), and the full three-dimension
   permission system (`lib/permissions.ts`). Every check reads the user's
   live database row — nothing is cached in the session/JWT — so an Admin's
   permission edit takes effect on the target user's very next request.
   Enforcement runs inside server actions themselves, not just the UI.
3. **Job CRUD + full lifecycle** (Section 6) — Create Job with the mandatory
   Advance Payment amount + proof picture (7.8); Draft → Waiting for
   Approval → Approved Budget → Waiting for Reconciliation → Closed, plus
   Cancel/Restore, Request Revision, and Reopen, all enforced server-side
   (`app/jobs/[id]/statusActions.ts`).
4. **Price Database + Cost Estimate** (8.4, 8.3/7.2) — shared material
   catalog with price history; the Cost Estimate fill-in sheet reads
   Material rates live (editing a price updates every job's display
   immediately); Sale Price & Profit card hidden entirely when its View
   permission is off.
5. **Budget + the deadline-approval flow** (6.1) — one shared control used
   at both entry points (header shortcut and Budget tab); approving
   auto-deducts every Stock budget line from Inventory; Undo Approval
   reverses deductions with offsetting Stock In entries, never deletions.
6. **Inventory** (8.5) — balances are derived (never stored) from the
   ledger; Stock In/Out/Transactions tabs with a Project column resolving
   back to the originating job.
7. **Expenses** (7.4–7.6) — Purchases + Receipts sheets, "Pull From Budget",
   the Actual Spent/Variance math (including the Manual-row-always-Over-
   Budget rule), and the Stock Actual-Spent → Inventory reconciliation
   (7.5) with idempotent replace-not-stack adjustment entries.
8. **Payments + Remaining Payment math** (7.7–7.8) — Advance is created
   once at job creation and never selectable again; the `max(0, …)` clamp
   is enforced in `lib/calc/payments.ts`.
9. **Reconciliation page** (8.6) — list → detail flow consolidating Budget
   vs. Expense variance, Payment Records, Receipts & Withholdings, Final
   Profit (formula-labeled), and the Final Checklist gating Close Job.
10. **Purchase Orders + full Users/Permissions UI + Settings** — the PO
    panel embedded in the Dashboard (not a separate nav page), a complete
    per-user Pages/Tabs/Actions permissions editor (`app/users/[id]`) with
    Edit-auto-grants-View behavior, role-reset, password reset, two-step
    delete, and the Settings page for the withholding rate/threshold.
11. **File storage** — a local-disk `lib/storage.ts` behind a small
    interface (swap for S3 by changing that one file), used at every
    upload point named in Section 9: receipts, advance payment proof,
    sign art, cut files, and the Cost Estimate price list file — each
    shown with the click-to-enlarge Lightbox convention.

Also closed after the initial pass, per Section 8.2's fuller spec for the
Jobs list:

- **Search + status filter** on the Jobs list (client/job#/title search,
  status dropdown), server-rendered via query params.
- **Financial columns** (Final Price / Advance / Remaining) on the Jobs
  list, shown only to users who can see financial tabs — same gate as the
  Overview tab's Advance Payment card.
- **Full job record + print** (Section 6/8.2) — a "Record" print button
  appears only on Closed jobs (Jobs list and Job Detail header), opening
  `/jobs/[id]/print`: a consolidated Client/Design/Cost Estimate/Budget/
  Expenses/Payments/Activity summary using the browser's print dialog
  (`window.print()`), per Section 9/10 — real PDF generation is called out
  in the brief as an open decision for the business owner, not something
  to build ahead of that decision.

The full job lifecycle (Draft → Waiting for Approval → Approved Budget →
Waiting for Reconciliation → Closed) was driven end-to-end through a
headless browser during development, verifying every formula in Section 7
against its worked numbers and catching one real bug along the way (see
below) — not just type-checked in isolation.

## What's deliberately thinner than a full production launch

Everything the brief specifies has a working implementation (see above).
What's left is launch/production-readiness work that was never part of the
brief's own scope — real infrastructure, hardening, and one open decision
the brief punts to the business owner:

- **Real PDF export** — the brief explicitly defers this decision to the
  business owner (Section 10): the print view built here uses the browser's
  native print dialog, matching the prototype's own approach, not a
  production PDF generator. Revisit once that decision is made.
- **Local-disk file storage** — fine for one dev instance; swap
  `lib/storage.ts` for an S3-compatible implementation (the interface is
  isolated there for exactly this) before deploying anywhere with more than
  one server instance or ephemeral disk.
- **No automated test suite** — correctness was verified via manual/headless
  end-to-end runs against the formulas in Section 7, not a checked-in test
  suite. Adding one (especially for `lib/calc/*`) would be the highest-value
  next step.
- **UI polish**: functional and permission-correct throughout, but a couple
  of interactions are simpler than the prototype's (e.g. quantities on the
  Cost Estimate fill-in sheet save in one batch per category rather than
  live-updating on keystroke; Design components are edited via a small
  inline form per row rather than in place).
- **Deployment infrastructure** — no hosted Postgres, no real secrets
  (`.env.example`'s `AUTH_SECRET` and the seed passwords are placeholders),
  no hosting target/Dockerfile/CI, no upload size/MIME validation, no login
  rate-limiting, no error monitoring, no self-service password reset. None
  of this was in the brief's behavioral spec — it's the standard pre-launch
  checklist for any app before real users touch it.

Server-side enforcement is real, not UI-only: every mutation calls
`requireAction`/`requirePage`/`requireTab` (or the equivalent explicit
check) before touching the database, so a request that skips the UI is
still rejected.

## A bug the end-to-end pass caught

The Section 7.5 Actual-Spent inventory adjustment entry wasn't linked to
the same `materialId` as the original Budget-approval deduction (the
`Expense` row had no `materialId` column at all), so a corrected quantity
showed up as a *second*, separate balance row for the same material
instead of merging into one. Fixed by adding `Expense.materialId`,
populated from the matched `BudgetItem` in "Pull From Budget", and used in
the adjustment entry. Confirmed fixed by re-running the full lifecycle.

## Repo layout

```
/                                    repo root
├── F hadar-job-management-prototype.jsx   validated prototype — source of truth for behavior
├── HANDOFF_BRIEF.md                 the full handoff brief (all section numbers referenced above)
└── app/                             the production Next.js app
    ├── prisma/schema.prisma         data model (Section 4)
    ├── prisma/seed.ts               dev seed: users + Price Database materials + Settings
    ├── lib/permissions.ts           permission system (Section 5)
    ├── lib/calc/                    pure formula modules (cost estimate, budget, expenses,
    │                                 payments, reconciliation, inventory) — Section 7
    ├── lib/storage.ts               file storage abstraction (local disk; swap for S3)
    ├── lib/current-user.ts          loads the live user row for every permission check
    ├── lib/job-number.ts, po-number.ts   atomic sequence generators
    ├── auth.ts / auth.config.ts     Auth.js — full config vs. Edge-safe subset for middleware
    ├── middleware.ts                route-level auth gating
    └── app/                         Next.js App Router pages:
        ├── page.tsx                 Dashboard (status cards, Remaining Payments, PO panel)
        ├── jobs/, jobs/[id]/        Jobs list + full Job Detail (all 8 tabs)
        ├── calculator/              Price Database
        ├── inventory/               Inventory (balances, Stock In/Out, transactions)
        ├── reconciliation/          Reconciliation list + detail
        ├── users/, users/[id]/      Users list + full permissions editor
        └── settings/                Withholding rate/threshold
```

## Local setup

Requires Node 20+ and a local PostgreSQL instance.

```bash
cd app
npm install
cp .env.example .env       # then fill in DATABASE_URL, AUTH_SECRET, SEED_*_PASSWORD
npm run db:migrate         # applies prisma/migrations
npm run db:seed            # seeds users + Price Database + Settings
npm run dev                # http://localhost:3000
```

Generate a real `AUTH_SECRET` with `openssl rand -base64 32` — don't ship the
placeholder in `.env.example`.

Seed accounts (username / role — password comes from the `SEED_*_PASSWORD`
env vars you set before seeding, matching the prototype's demo roster):
`bereket` (Admin), `eyuel` (Owner/Finance), `netsi` (Designer), `yonas`
(Manager), `dawit` (Supervisor).

## Notes on stack decisions made this pass

- **Prisma pinned to 6.19.3**, not the `8.0.0-rc` that `npm install prisma`
  currently resolves to `latest`. Prisma 7+ removed the classic
  `datasource { url = env(...) }` schema style in favor of a
  `prisma.config.ts` + driver-adapter-only `PrismaClient` constructor, which
  isn't yet what most Auth.js/Prisma tutorials and the wider ecosystem
  expect. 6.x is the last version compatible with the classic setup used
  here.
- **Session strategy is JWT**, not database sessions — Auth.js's Credentials
  provider only supports JWT sessions. Permission data is deliberately kept
  out of the JWT and re-fetched from Postgres on every check (see above).
- **`auth.config.ts` / `auth.ts` split**: middleware needs an Edge-safe
  config (no bcrypt/Prisma); the Credentials provider (which needs both)
  only loads in route handlers and server actions, which run on the Node
  runtime.
- **File storage built early, not last**: the brief's Section 11 puts file
  storage last because it's retrofitting uploads onto an already-built UI
  ("get the interaction pattern right once, then apply everywhere"). Since
  this was a from-scratch build rather than a retrofit, the storage
  abstraction and the Lightbox/FileField components were built as shared
  infrastructure early and reused at every upload point as each tab was
  built — same rationale, different point in the sequence.
