# FabSimple

> End-to-end management for structural steel fabricators — estimating, production tracking, AISC 303 QC, paint inspection, billing, and shop-floor workflows.

[![CI](https://github.com/your-org/fab-simple/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/fab-simple/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---
---
## What it does

FabSimple replaces the patchwork of spreadsheets, paper logs, and one-off Access databases small fab shops still run on. It covers the work that actually happens in a structural steel shop:

- **Projects** — bids, contract values, deadlines, tonnage, AIA G702/G703 billing
- **Parts** — Tekla/SDS2 CSV import, sequential part marks, bulk status updates, QR codes
- **Drawings** — revision control with auto-supersede, BOL/MTR attachments
- **Production** — daily logs by station/shift, kit/release tracking, fab cell schedules
- **QC** — AISC 303 checklist, paint DFT (SSPC), weld inspection, NCR auto-creation on fail
- **Inventory / POs** — receiving with BOL upload, MRR documents, low-stock alerts
- **RFIs + Change orders** — sequential numbering, status workflows, fan-out notifications
- **Shop floor (mobile)** — QR scan → 3-tap status updates, on-device photo capture, works offline (PWA)
- **AI Copilot** — context-aware assistant grounded in your project KPIs and open NCRs

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 16 App Router · TanStack Query · Redux UI)    │
│   ─ Dashboard pages   ─ Worker PWA   ─ Command palette          │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTPS + Bearer JWT
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase Edge Functions (Deno · TypeScript)                    │
│   /api  — REST routes + RBAC + rate limit + audit log            │
│   ─ generic CRUD   ─ files   ─ copilot   ─ search   ─ signup    │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Postgres (Supabase)                                            │
│   ─ 35+ tables   ─ 75+ RLS policies (multi-tenant by company)   │
│   ─ Triggers: NCR auto-open, notification fan-out, audit trail  │
│   ─ Realtime: activity_feed, notifications                      │
│   ─ Storage: drawings · mtrs · photos · billing                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why this stack?** Single vendor (Supabase) for auth + DB + storage + realtime + Edge runtime keeps ops simple for a shop owner who is not interested in managing infrastructure. Next.js on Vercel handles the marketing site and dashboard. The PWA worker view is a single mobile-first route that installs to the home screen.

---

## Quickstart (local development)

### Prerequisites

- Node.js 20+
- Docker Desktop (for the local Supabase stack)
- `npm install -g supabase` (or use the bundled `npx supabase`)

### 1. Install + start

```bash
git clone https://github.com/your-org/fab-simple
cd fab-simple
npm install
npx supabase start            # boots Postgres, Auth, Storage, Edge runtime
npx supabase db reset         # applies migrations + demo seed
```

The first `start` pulls Docker images and takes a couple of minutes. Subsequent starts are fast.

### 2. Wire env vars

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from `supabase status` output>
NEXT_PUBLIC_API_BASE=http://127.0.0.1:54321/functions/v1/api
SUPABASE_SERVICE_ROLE_KEY=<from `supabase status` output>
```

For Edge Function secrets (Copilot, AI):

```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

### 3. Run

```bash
npm run dev          # Next.js on http://localhost:3000
```

### 4. Demo accounts

The seed migration installs a `FabSimple Demo, Inc.` company with five users:

| Email                            | Password               | Role       |
|----------------------------------|------------------------|------------|
| `owner@fabsimple.demo`           | `demo-password-12345`  | owner      |
| `foreman@fabsimple.demo`         | `demo-password-12345`  | foreman    |
| `qc@fabsimple.demo`              | `demo-password-12345`  | qc         |
| `welder@fabsimple.demo`          | `demo-password-12345`  | worker     |
| `paint@fabsimple.demo`           | `demo-password-12345`  | worker     |

Sign in at <http://localhost:3000/auth/signin>.

---

## Project structure

```
fab-simple/
├── app/                       # Next.js App Router
│   ├── (dashboard)/           # Admin / shop manager pages
│   ├── auth/                  # Sign in, sign up
│   ├── worker/                # Mobile shop-floor PWA
│   └── layout.tsx             # Root layout (PWA manifest wired here)
├── components/                # React components (DataTable, ResourceModal, …)
├── hooks/                     # TanStack Query hooks (useResource, useNotifications)
├── lib/                       # Client utilities (api, csv-export, pdf, observability)
├── store/                     # Redux slices (auth, ui)
├── supabase/
│   ├── functions/api/         # Deno Edge Functions (all backend logic)
│   │   ├── controllers/       # /files, /copilot, /search, /signup-bootstrap, …
│   │   ├── lib/               # response helpers, RBAC, validation, log, rate-limit
│   │   ├── services/          # audit, notifications, business logic
│   │   └── index.ts           # Router
│   └── migrations/            # SQL migrations (schema, RLS, triggers, seeds)
├── tests/                     # Vitest unit + component tests (jsdom)
├── tests-integration/         # Live Edge Function + RLS tests
├── e2e/                       # Playwright E2E specs
└── openapi.yaml               # Edge Function API reference
```

---

## Testing

```bash
npm test                       # unit + component tests (vitest)
npm run test:integration       # live HTTP integration tests
npm run test:e2e               # Playwright E2E (set E2E_RUN_AUTH=1 for signed-in flows)
npm run typecheck              # TypeScript
npm run lint                   # ESLint
```

CI runs everything on every PR; see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Deployment

See [`DEPLOY.md`](DEPLOY.md) for a step-by-step production deployment guide covering hosted Supabase, Vercel, Edge Function secrets, Auth configuration, and a hardening checklist.

---

## API reference

See [`openapi.yaml`](openapi.yaml). It documents every route the Edge Function exposes and is the authoritative reference for client integrations.

---

## Contributing

1. Fork and create a feature branch.
2. Run `npm test && npm run typecheck && npm run lint` before pushing.
3. Open a PR — CI will gate it.

---

## License

MIT — see [`LICENSE`](LICENSE).
