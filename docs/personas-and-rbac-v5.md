# FabSimple v5 — User Persona & Role Reference

**For:** Development Team · Novus Steel Engineering
**Status:** Source of truth for RBAC, navigation guards, and UX rules
**Companion docs:**
- `docs/backend-requirements.md` — architecture, schema, endpoints
- `docs/reference/fabsimple-v5-demo.html` — **visual source of truth** (open in browser; all 30 pages + 7 demo logins)
- `lib/nav-config.ts` — sidebar nav (must mirror §10.5 `ROLE_NAV`)
- `lib/rbac.ts` — generated from the matrix in §10

> Steel Fabrication Management Platform · 7 Roles · 30 Pages (28 sidebar modules + Part Detail drill-down + Live Activity) · Tekla CSV import (v5; API in v6)

---

## 1. Owner / Admin

> "Sees everything. Approves the big decisions. Watches the money."

In shops under 30 people, the Owner is often also the PM and Estimator. In larger shops (50+), the Owner primarily watches dashboards and financials but does not enter data daily. Their homepage should show **money first**.

| Field | Details |
|---|---|
| **Key modules** | All 28 — financial dashboard, job cost, billing, project status, AISC, QC, users/roles |
| **Permissions** | Full access. Approves POs above threshold. Approves G702 draw requests. Manages all users. |
| **Primary success metric** | Opens dashboard every morning to see: active project health, outstanding billing, shop floor status — in under 60 seconds. |

**Goals**
- Know exactly where every project stands at any moment — what's bid, what's in shop, what's shipped
- Catch cost overruns before they hit the final invoice
- Never have an AISC audit surprise them
- Grow revenue without proportionally growing headcount

**Pain points (current state)**
- Verbal updates or manual Excel sheets for job status
- Blindsided by unbilled change orders at project closeout
- Hours spent pulling AISC binder before each audit
- Cannot easily compare estimated hours vs actual hours across projects

**Validation question for dev team**
> "If your best PM gets hit by a bus tomorrow, can the next person know what's been bid, cut, shipped, and what the AISC auditor needs — by Monday?"

---

## 2. Estimator

> "Wins the work. Sees nothing after the contract is signed."

Lives entirely in the pre-contract world. Once a job is won, hands it to the PM and moves to the next bid. Needs **read access to inventory** so they can see what material is on hand when pricing.

| Field | Details |
|---|---|
| **Key modules** | Estimating, bid history, GC Contacts, Inventory (view only) |
| **Permissions** | Full: Estimating, GC Contacts. View: Projects, Inventory. Hidden: Job Cost, Billing, Weld/Paint, Users. |
| **Primary success metric** | "Show me your last 5 lost bids. Could you have won with better $/lb data from past projects?" |

**Goals**
- Build accurate bids faster using historical $/ton and $/lb data
- Know current material prices and on-hand inventory before pricing
- Track bid status: sent, won, lost, no-bid
- See GC contacts and communication history

**Pain points**
- Lost bids because they couldn't accurately price based on past job data
- Re-enters the same client info for every bid
- Cannot easily see what similar past jobs actually cost vs what was estimated
- No system to track which bids are pending decision from the GC

**Validation question**
> "How long does it take you to price a bid from scratch vs using a similar past project as a template?"

---

## 3. Project Manager

> "The hub of the operation. Touches everything, owns outcomes."

The most critical user. Coordinates between Estimator (pre-award), Shop (production), QC (compliance), and GC (client). Dashboard needs to show project health, team productivity, and open issues at a glance.

| Field | Details |
|---|---|
| **Key modules** | Dashboard, Projects, Parts, Assemblies, Drawings, RFIs, Change Orders, AISC, Shipping, Daily Log, GC Contacts, Job Cost, Erection Sequence |
| **Permissions** | Full on operational + compliance modules. View on Billing, Estimating. |
| **Primary success metric** | "When your AISC auditor arrives, how many hours does it take to pull your compliance binder together?" |

**Goals**
- Know exact production status of every part on every active project
- Track estimated hours vs actual hours to predict overruns before they happen
- Manage RFIs, submittals, change orders without losing anything in email
- One place for all GC communication and site contacts

**Pain points**
- Hours every week chasing status updates from the shop floor
- Change orders get verbal approval but no formal tracking — billing suffers
- Drawing revision mismatches cause rework and schedule delays
- No easy way to see which parts have AISC holds vs which are ready to ship

**Validation question**
> "Can you show me the exact production status of every beam on the Dallas project right now?"

---

## 4. Shop Foreman

> "Runs the floor. Needs fast information, no paperwork."

Manages the physical workflow — cutting, fitting, welding, grinding, painting, loading. Works on the floor, often with dirty hands. **Mobile-first design is critical.** Needs QR scan to update part status in 3 taps.

| Field | Details |
|---|---|
| **Key modules** | Parts List, QR Scanner, Daily Log, Assemblies, Erection Sequence, OSHA, Shipping Tickets |
| **Permissions** | Full: Parts (status), Daily Log, QR. View: Projects, Drawings, Shipping. Hidden: Financial, Users. |
| **Primary success metric** | "Has a welder ever started cutting to the wrong drawing revision? What did it cost you?" |

**Goals**
- Know exactly what to cut, weld, paint today — in priority order
- Update part status quickly without going to an office
- See the daily work log: who is working on what right now
- Flag problems (wrong revision, material shortage) immediately

**Pain points**
- Welders have started cutting to the wrong drawing revision
- Daily reporting on paper, then re-entered — double work
- No easy way to see which assemblies are waiting on parts to clear a hold
- Erection sequence changes come through phone calls, not system updates

**Validation question**
> "Would you scan a QR code on each piece if it took 3 seconds and eliminated your foreman's morning status call?"

---

## 5. QC Inspector / CWI

> "The gatekeeper. Nothing ships without their sign-off."

Often a Certified Welding Inspector. Responsible for ensuring all parts meet AWS D1.1, AISC 303, and project spec. Logs weld and paint inspections, manages heat numbers, tracks certifications, must produce an audit-ready record on demand.

| Field | Details |
|---|---|
| **Key modules** | AISC Checklist, AWS Weld Log, Paint Inspection, NCR Reports, Heat Numbers, ASTM MTRs, Cert Tracker |
| **Permissions** | Full: Weld Log, Paint, AISC, NCR, Heat Numbers, Certs. View: Parts, Drawings, Shipping. Hidden: Financial. |
| **Primary success metric** | "Where do you log your weld inspections right now? How long would an AISC auditor take to review them?" |

**Goals**
- Complete, audit-ready weld and paint inspection log for every project
- Flag NCRs immediately and track corrective actions to closure
- Never let an expired certification (personal or equipment) go unnoticed
- Verify heat numbers trace from MTR to finished part

**Pain points**
- Weld logs in Excel — hard to filter by project or inspector
- Paint DFT readings on paper, then re-entered — transcription errors
- No automated alert when a CWI certification is 30 days from expiry
- Heat number traceability requires manually cross-referencing MTRs with parts list

**Validation question**
> "How do you currently trace a finished beam back to its mill cert and heat number?"

---

## 6. Accounting / Billing

> "Turns completed work into revenue. Watches the money flow."

Manages AIA G702/G703 billing applications, tracks purchase orders, monitors job costs vs budget, handles payables. Should never see shop floor data; needs full visibility into financial modules.

| Field | Details |
|---|---|
| **Key modules** | AIA G702 Billing, Job Cost Tracker, Purchase Orders, Change Orders (view), Projects (view) |
| **Permissions** | Full: Billing, Job Cost, POs. View: Projects, COs. Hidden: Parts, Weld/Paint, AISC, Users. |
| **Primary success metric** | "How long does it take to prepare each monthly draw request? How often is it submitted late?" |

**Goals**
- Generate monthly G702 draws from actual percent-complete data — not estimates
- Track all POs and vendor invoices against project budgets
- See job cost vs estimate variance in real time, not at month-end
- Never miss billing for an approved change order

**Pain points**
- G702 prep takes 4–6 hours of manual data collection from PM
- Change orders get approved verbally but not billed because accounting isn't notified
- PO tracking is in email threads — no central record
- Job cost reports produced at project closeout, not during execution

**Validation question**
> "How much unbilled revenue do you have in approved-but-not-billed change orders right now?"

---

## 7. Shop Worker (Mobile)

> "On the floor, on the move. 3 taps and done."

Welders, fitters, painters, material handlers. **Will not use a desktop app.** The interface must work on a personal phone in a noisy, dirty shop environment. Large tap targets, minimal text, clear status colors. QR scan is the primary input method.

| Field | Details |
|---|---|
| **Key modules** | Worker View (mobile), QR Scanner, Status Update (3-tap), Current Part Queue |
| **Permissions** | Scan + update status on assigned parts only. View: own queue. Hidden: all financial, admin, QC, management. |
| **Primary success metric** | "Would you scan a QR code on each piece if it took 3 seconds and your foreman stopped asking for verbal updates?" |

**Goals**
- Know exactly what piece they should be working on right now
- Update part status in under 10 seconds
- See the drawing or assembly diagram for the piece they're working on
- Raise a question or flag a problem without leaving the floor

**Pain points**
- Gets instructions verbally — confusion about revision levels
- No way to update status without finding the foreman first
- Unclear which pieces are priority vs which can wait
- No way to flag "I found a problem" without stopping work

**Validation question**
> "What happens when you're not sure which revision of a drawing you should be working from?"

---

## 10. Role-Based Access Matrix

Source of truth for navigation guards, API authorization, and sidebar rendering.

**Legend:** **F** = Full (CRUD) · **V** = View only · **C** = Create only · **A** = Approve · **—** = hidden

> The matrix below defines **capability per role**. The actual **sidebar shape** (sections + ordering) is in §10.5 — derived from the demo's authoritative `ROLE_NAV`.

### Overview

| Module | Owner | Estimator | PM | Foreman | QC | Acct | Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | F | V | F | V | V | V | — |

### Projects

| Module | Owner | Estimator | PM | Foreman | QC | Acct | Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Projects | F | V | F | V | V | V | — |
| Parts List | F | — | F | F | V | — | V |
| Assemblies | F | — | F | F | V | — | — |
| Drawing Log | F | — | F | V | V | — | V |
| Erection Sequence | F | — | F | F | — | — | — |
| Daily Log | F | — | F | F | — | — | — |

### Estimating

| Module | Owner | Estimator | PM | Foreman | QC | Acct | Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Estimating | F | F | V | — | — | — | — |
| GC Contacts | F | F | F | — | — | — | — |

### Compliance / QC

| Module | Owner | Estimator | PM | Foreman | QC | Acct | Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| AISC 303 Checklist | F | — | F | V | F | — | — |
| AWS Weld Log | F | — | V | — | F | — | — |
| Paint Inspection | F | — | V | — | F | — | — |
| NCR Reports | F | — | V | V | F | — | — |
| Heat Numbers | F | — | V | — | F | — | — |
| Cert Tracker | F | — | V | — | F | — | — |
| OSHA Checklist | F | — | F | F | V | — | — |

### Procurement

| Module | Owner | Estimator | PM | Foreman | QC | Acct | Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Purchase Orders | F | — | F | V | — | F | — |
| Material Receiving | F | — | F | F | — | V | — |
| Inventory | F | V | F | V | — | V | — |

### Field / Shipping

| Module | Owner | Estimator | PM | Foreman | QC | Acct | Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Shipping Tickets | F | — | F | C | — | V | — |
| RFIs | F | — | F | V | V | — | — |
| Change Orders | F | — | F | — | — | V | — |

### Finance

| Module | Owner | Estimator | PM | Foreman | QC | Acct | Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Job Cost Tracker | F | V | F | — | — | F | — |
| AIA G702 Billing | A | — | V | — | — | F | — |

### Tools

| Module | Owner | Estimator | PM | Foreman | QC | Acct | Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Cut Plan Optimizer | F | — | F | F | — | — | — |
| Worker View (Mobile) | — | — | — | — | — | — | F |

### Settings

| Module | Owner | Estimator | PM | Foreman | QC | Acct | Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Users & Roles | F | — | — | — | — | — | — |
| Integrations | F | — | V | — | — | — | — |

---

## 10.5 Authoritative sidebar config (from demo `ROLE_NAV`)

Extracted verbatim from `FabSimple-v5-Secure-Production.html`. This is what `lib/nav-config.ts` MUST produce per role. The matrix in §10 expresses **capability**; this section expresses **sidebar shape**.

### Page registry (route IDs and titles)

| ID | Title | Type |
|---|---|---|
| `dash` | Dashboard | page |
| `projects` | Projects | page |
| `multiuser` | **Live Activity** | page (real-time presence + activity feed) |
| `estimating` | Estimating | page |
| `co` | Change Orders & RFI | page |
| `drawings` | Drawing Log | page |
| `po` | Purchase Orders | page |
| `receiving` | Material Receiving | page |
| `inventory` | Inventory | page |
| `parts` | Parts List | page |
| `partdetail` | **Part Detail** | drill-down route (not in sidebar) |
| `import` | Import / Tekla CSV | page |
| `qr` | QR Codes | page |
| `assemblies` | Assemblies | page |
| `dailylog` | Daily Production Log | page |
| `paint` | Paint & Coating Log | page |
| `aisc` | AISC 303 Compliance | page |
| `weld` | AWS D1.1 Weld Log | page |
| `heat` | ASTM Heat Numbers | page |
| `osha` | OSHA Checklist | page |
| `certs` | Cert Tracker | page |
| `erection` | Erection Sequence | page |
| `shipping` | Shipping Tickets | page |
| `gc` | GC Contacts | page |
| `jobcost` | Job Cost Tracker | page |
| `billing` | AIA G702 Billing | page |
| `worker` | Worker View | page (mobile) |
| `users` | Users & Roles | page |
| `integrations` | Integrations | page |
| `pricing` | Pricing | (defined; not currently in any role's sidebar — surfaced via Users & Roles) |

> Aspirational pages from §10 not yet built in the demo: **NCR Reports** and **Cut Plan Optimizer**. These remain in the spec but are explicitly flagged as Phase 4 / Phase 7 work.

### Per-role sidebar (sections → items, in order)

**Owner** — 8 sections
- Overview: `dash`, `projects`, `multiuser` *(badge: Live)*
- Pre-Construction: `estimating`, `co`, `drawings`
- Procurement: `po`, `receiving`, `inventory`
- Production: `parts`, `import`, `qr`, `assemblies`, `dailylog`
- Quality & Compliance: `paint`, `aisc`, `weld`, `heat`, `osha`, `certs`
- Shipping & Field: `erection`, `shipping`, `gc`
- Billing & Finance: `jobcost`, `billing`
- Settings: `users`, `integrations`

**Estimator** — 3 sections, 5 items only
- Overview: `dash`
- Estimating: `estimating`, `gc`
- Reference: `projects`, `inventory`

**PM (Project Manager)** — 6 sections, ~22 items
- Overview: `dash`, `projects`, `multiuser` *(badge: Live)*
- Pre-Construction: `co`, `drawings`
- Procurement: `po`, `receiving`, `inventory`
- Production: `parts`, `import`, `qr`, `assemblies`, `dailylog`
- Quality & Compliance: `paint`, `aisc`, `weld`, `heat`, `osha`, `certs`
- Shipping & Field: `erection`, `shipping`, `gc`
- Finance: `jobcost`, `estimating` *(NOTE: estimating appears here as view-only reference, not under Estimating section)*

**Foreman** — 4 sections
- Overview: `dash`, `projects`
- Production: `parts`, `qr`, `assemblies`, `dailylog`, `inventory`
- Field: `erection`, `shipping`, `osha`
- Reference: `drawings`, `co`

**QC Inspector** — 3 sections
- Overview: `dash`
- Quality & Compliance: `paint`, `aisc`, `weld`, `heat`, `certs`
- Reference: `receiving`, `parts`, `drawings`

**Accounting** — 3 sections
- Overview: `dash`
- Finance: `jobcost`, `billing`, `po`
- Reference: `co`, `projects`

**Worker (Shop Mobile)** — 2 sections
- My Work: `worker`
- Reference: `parts`, `drawings`

> **Correction to earlier rule:** Workers DO see Parts List and Drawing Log (read-only), reachable from a minimal sidebar. They still **land on `/worker` by default** and middleware blocks routes outside `[worker, parts, drawings, partdetail]`.

### Role colors and labels (for avatars / chips)

```ts
const ROLE_COLORS = {
  owner:     '#dc2626', // red
  estimator: '#d97706', // amber
  pm:        '#2563eb', // blue
  foreman:   '#059669', // green
  qc:        '#7c3aed', // purple
  accounting:'#0891b2', // cyan
  worker:    '#6b7280', // gray
};
const ROLE_LABELS = {
  owner:'Owner', estimator:'Estimator', pm:'Project Manager',
  foreman:'Shop Foreman', qc:'QC Inspector', accounting:'Accounting',
  worker:'Worker',
};
```

### Demo accounts (DEMO mode only)

| Role | Email | Name | Avatar color |
|---|---|---|:---:|
| owner | owner@demo.com | Jake Rivera | blue |
| estimator | est@demo.com | Tony Mendez | amber |
| pm | pm@demo.com | Sarah Kim | blue |
| foreman | foreman@demo.com | Mike Torres | green |
| qc | qc@demo.com | D. Nguyen | purple |
| accounting | acct@demo.com | Maria Santos | cyan |
| worker | worker@demo.com | R. Torres | green |

Demo Mode = no Supabase call; user object is constructed in-memory and `DEMO=true` switches all `lib/api.ts` calls to read `lib/mock-data.ts`. JWT machinery is bypassed entirely.

---

## 11. Integration & Technical Notes

### Tekla Structures (file-based in v5)

FabSimple imports parts and assemblies from Tekla via CSV export. Columns expected:

- `Part Mark`
- `Assembly Mark`
- `Profile`
- `Material Grade`
- `Length`
- `Weight`
- `Phase`
- `Drawing Revision`

Behavior:
- **Parts import:** Tekla CSV → FabSimple Parts List (one-click import, duplicate detection by Part Mark)
- **Drawing revision tracking:** FabSimple stores current revision and flags mismatches vs Tekla export
- **No real-time API in v5.** Integration is file-based. Tekla Open API / .NET planned for **v6**.

### Supabase architecture

- **Database:** PostgreSQL 15, 44 tables (37 modeled in `backend-requirements.md` §3 + 7 normalization tables flagged for owner sign-off)
- **Auth:** Supabase Auth. Demo HTML holds JWT in an **in-memory closure** (not `localStorage`). The Next.js port MAY mirror this with React Context + sessionStorage for refresh; final decision lives in `backend-requirements.md` §9.
- **API:** 18 Edge Function endpoints (Deno) — all business logic server-side. Client never queries Postgres directly except through `FabAPI` / `lib/api.ts`.
- **Row-Level Security:** Every tenant-scoped table. Roles enforced at DB layer, not just UI.
- **Realtime:** Supabase Realtime for live part status updates on Shop Floor view + NCR auto-creation + Live Activity feed (`multiuser` page)

### Key implementation rules for dev team

- **Navigation guard:** Check `CU.role` against `ROLE_NAV` (§10.5) before rendering any page. Never trust client-side role claims without JWT verification (`middleware.ts` is the chokepoint).
- **Worker role:** Lands on `/worker` after login. Sidebar limited to `worker`, `parts`, `drawings`. Middleware allow-list = `[/worker, /parts, /partdetail/*, /drawings]`. Any other route → redirect to `/worker`.
- **Owner role:** Only role that can see Users & Roles page and invite new users.
- **Estimator role:** Can see Inventory (view-only) — critical for bid pricing. Cannot see Job Cost or actual margins.
- **PM role:** Sees `estimating` under **Finance** section (not Estimating) — view-only, used to check bid-vs-actual.
- **Accounting role:** Sees Change Orders as view-only (to bill them) but cannot edit COs — PM owns that.
- **QC role:** Full access to NCR creation. **Auto-prompt:** when Paint or Weld inspection fails, DB trigger auto-creates an NCR (see `backend-requirements.md` §3).
- **Live Activity (`multiuser`):** Owner + PM only. Driven by `activity_events` table + Supabase Realtime presence channel. Shows online users, real-time feed, p95 latency stat.
- **All save functions:** must respect mode: DEMO → toast success only; LIVE → Edge Function call via `FabAPI` → toast result. Same code path via `lib/api.ts` seam.
- **Mobile breakpoint:** Worker View and QR Scanner must work on 375px viewport minimum.
- **XSS sanitisation:** Every value returned from `FabAPI` runs through `sanitize()`. Prefer `safeText(el, value)` over `el.innerHTML = value` when injecting any field that originated in user input (part marks, project names, notes).
