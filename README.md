# Hadar Advertising — Job Management App

Production build for Hadar Advertising's signage job management workflow,
built from a validated client-side React prototype (`F hadar-job-management-prototype.jsx`,
this repo root) and its handoff brief (`HANDOFF_BRIEF.md`). The prototype is
the source of truth for every workflow, permission, formula, and screen
layout — where this README and the prototype ever disagree, the prototype
wins. Section numbers referenced below (e.g. "Section 7.4") refer to
`HANDOFF_BRIEF.md`.

The production app lives in `app/` (Next.js + Prisma/Postgres + Auth.js).

## What's built (this pass — "Foundation")

Per the brief's Section 11 build order, this pass covers **steps 1–2 solidly**,
plus a thin, real, end-to-end slice of step 3 to prove the foundation actually
works rather than just type-checking in isolation:

1. **Data model + migrations** (Section 4) — `app/prisma/schema.prisma`.
   Every entity in the brief (Job + its sub-tables, Material/Price Database,
   Purchase Orders, Inventory ledger, Users/Permissions, Settings) is modeled
   relationally. A `JobSequence` table gives atomic, collision-free job
   numbering (Section 10's known-gap called this out explicitly).
2. **Auth + permission enforcement** (Section 5) — real bcrypt-hashed
   credentials via Auth.js (`auth.ts`), and the full three-dimension
   permission system (`lib/permissions.ts`: `ACTION_KEYS`, `PAGE_KEYS`,
   `TAB_KEYS`, role defaults, `can`/`canViewAction`/`canSeePage`/`canSeeTab`,
   and `requireAction`/`requirePage`/`requireTab` guards). Every permission
   check reads the user's live row from the database — nothing is cached in
   the session/JWT — so an Admin's edit to someone's permissions takes effect
   on their very next request.
3. **Job CRUD (thin slice)** — Create Job with the mandatory Advance Payment
   amount (Section 7.8), a Jobs list respecting `manageDraftJobs`
   Draft-visibility (Section 5.4), and a Users list/create/deactivate page
   demonstrating `manageUsers` enforcement (Section 8.8, partial).

Server-side enforcement is real, not UI-only: `requireAction`/`requirePage`
run inside the server actions themselves (`app/jobs/actions.ts`,
`app/users/actions.ts`), so a request that skips the UI is still rejected.

## What's NOT built yet (next, per the brief's build order)

- Job Detail (Section 8.3): Design, Cut List, Cost Estimate, Budget,
  Expenses, Payments & Profit, Activity tabs — and the whole status machine
  (Section 6), the two-step deadline-approval flow (6.1), and every formula
  in Section 7 (withholding, cost estimate math, budget vs. actual variance,
  stock reconciliation, remaining payment).
- Price Database page (8.4), Inventory page (8.5, current-balance
  derivation), Reconciliation page (8.6), Purchase Orders panel (8.7),
  Settings page (8.9).
- The full per-user permissions editor grid (part of 8.8) — today, creating
  a user seeds role-default permissions; there's no UI yet to customize an
  individual's permissions afterward (the data model and `buildPermSet`
  already support it).
- File/object storage (Section 11, step 11) — every upload point
  (receipts, advance payment proof, sign art, cut files, price list files)
  is deferred; the Advance Payment's `receiptUrl` field exists and is
  nullable until storage is wired up.

## Repo layout

```
/                                    repo root
├── F hadar-job-management-prototype.jsx   validated prototype — source of truth for behavior
└── app/                             the production Next.js app
    ├── prisma/schema.prisma         data model (Section 4)
    ├── prisma/seed.ts               dev seed: users + Price Database materials + Settings
    ├── lib/permissions.ts           permission system (Section 5)
    ├── lib/current-user.ts          loads the live user row for every permission check
    ├── lib/job-number.ts            atomic job-number sequence
    ├── auth.ts / auth.config.ts     Auth.js — full config vs. Edge-safe subset for middleware
    ├── middleware.ts                route-level auth gating
    └── app/                         Next.js App Router pages (login, dashboard, jobs, users)
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
