# FabSimple v5 — Backend Requirements

**Status:** Draft v3 (reconciled with persona spec + secure-production demo HTML)
**Customer:** Novus Steel Engineering
**Produced via:** gstack `/office-hours` → `/plan-eng-review` methodology
**Sources of truth:**
- This document (architecture, schema, endpoints, tests)
- `docs/personas-and-rbac-v5.md` (RBAC matrix + UX rules) — copy of user spec
- `docs/reference/fabsimple-v5-demo.html` — **visual + behavioural source of truth**; 30 pages, 7 role-based demo logins, `FabAPI` reference impl
- `lib/mock-data.ts` (DEMO-mode data fixtures)
- `lib/nav-config.ts` (sidebar shape — mirror of `ROLE_NAV` in persona doc §10.5)

> **Locked decisions (v5):**
> - Multi-tenant SaaS, 7 roles, **30 pages** (28 sidebar modules + Part Detail drill-down + Live Activity)
> - Supabase (Postgres 15 + Auth + Realtime + Storage + **Edge Functions [Deno]**)
> - **Auth: Supabase JWT in-memory** (held in `FabAPI` closure; refresh token in `@supabase/ssr` HttpOnly cookie — see §9, revised from earlier "localStorage" plan)
> - **All business logic in 31 Edge Functions** (18 core transactional + 13 CRUD wrappers — see §6). Client uses one wrapper: `FabAPI` (`lib/api.ts`).
> - **17 form modals** specced in §6.5 with Zod schemas — one block per demo modal
> - **Realtime** for shop-floor part status + activity feed + notifications + Live Activity presence
> - **DEMO / LIVE dual-mode** behind `NEXT_PUBLIC_FAB_MODE`; 7 hardcoded demo accounts mirror the demo HTML
> - **v5 Tekla = CSV import only**; **v6 = Tekla Open API / .NET** (out of v5 scope)
> - **Integrations page = UI shell only** (Procore "demo sync" button is a stub; real OAuth integrations are v6)
> - **42 Postgres entities** (37 base tables + `notifications`, `aisc_checklist_catalogue`, `procore_sync_log` + 2 materialised views — see §3 and §3.bis); all tables have RLS

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 16, React 19, mobile-first on /worker)             │
│  • Redux Toolkit (UI state)                                          │
│  • TanStack Query (server state; Realtime → invalidateQueries)       │
│  • supabase-js client:                                               │
│      ├─ Realtime subscriptions                                       │
│      ├─ Storage upload (drawings, photos, MTRs, billing PDFs)        │
│      └─ Auth: JWT in localStorage; refresh via refreshSession()      │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS + Bearer (Supabase JWT)
┌────────────────────────▼────────────────────────────────────────────┐
│  Next.js Server (Vercel, Node runtime)                               │
│  • Server Components hydrate initial query state via prefetching    │
│  • middleware.ts: auth gate (verify JWT, set CU = current-user      │
│    context with org_id + role; redirect Worker → /worker)            │
│  • No business logic on Next.js side. UI + RSC + reverse-proxy only │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS, fab-api/* routes
┌────────────────────────▼────────────────────────────────────────────┐
│  Supabase Edge Functions (Deno) — 18 endpoints                       │
│  All writes + business rules here. RLS still enforced; functions    │
│  use the caller's JWT (not service_role) for tenant scoping.        │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│  Supabase managed services                                           │
│  ├─ Postgres 15 + 37 tables + RLS on every tenant-scoped table      │
│  ├─ Auth (JWT, magic link / OTP / password)                          │
│  ├─ Realtime (Postgres CDC over WebSocket)                           │
│  ├─ Storage (4 RLS-scoped buckets)                                   │
│  └─ pg_cron for nightly jobs (cert expiry, inventory, billing)       │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Edge Functions over Server Actions

This is your call (and a defensible one). Trade-offs we accept:
- ✅ Same code surface whether called from web, mobile native, or QR-redirect; no Next.js coupling.
- ✅ Centralised business rules — RLS + Edge Function input validation + DB constraints = three layers of defence.
- ✅ Easier to swap Next.js for another front-end later.
- ❌ Slight latency overhead vs Server Actions (extra hop).
- ❌ Loses Server Action ergonomics (`<form action={...}>` + progressive enhancement).
- ⚠️ We must keep Edge Function inputs *and* outputs Zod-validated; no implicit trust.

### Why in-memory JWT (revised after reading the v5 demo HTML)

> **Revision:** the v5 demo HTML (`FabSimple-v5-Secure-Production.html`) holds the JWT in a **closure variable inside the `FabAPI` IIFE**, not in `localStorage`. That's the better security posture and it's what we should ship. The persona doc was inaccurate on this point.

Storage policy:
- **Access token** → in-memory only. Held in `FabAPI` (web) / React Context (Next.js port). Lost on page reload — that's fine, the refresh-token call rehydrates it.
- **Refresh token** → managed by `@supabase/ssr`'s default cookie storage (HttpOnly, Secure, SameSite=Lax). Token never enters JS.
- **No `localStorage` for JWT.** The demo proves it's not needed; Supabase JS v2 auto-rehydrates from the refresh cookie on page load.

Defences layered on top:
- ✅ Strict CSP: `script-src 'self'; object-src 'none'; base-uri 'self'` (no inline, no eval).
- ✅ `FabAPI.sanitize()` runs every response through HTML-escape before render. Apps prefer `safeText(el, value)` over `innerHTML`.
- ✅ Short JWT TTL (1 hour) + Supabase auto-refresh; Edge Functions verify on every call.
- ✅ **Idle-timeout watchdog:** `FabAPI` resets a timer on every `click`/`keydown`/`touchstart`. 30 min idle → `clearToken()` + force re-login. Matches the demo behaviour.
- ✅ Storage RLS scoped by JWT claims — stolen token still tenant-isolated.
- ✅ Every Edge Function logs `(jwt_sub, ip, ua, route)` for forensic trace.
- 📋 Open: revisit moving the refresh token into an HttpOnly cookie owned by a Next.js Route Handler if a customer asks for SOC2.

### Canonical client wrapper — `FabAPI` (port from demo)

Every data call from the React side MUST go through one wrapper. The demo defines it like this — port directly to `lib/api.ts`:

```ts
// lib/api.ts (Next.js port of the demo's FabAPI)
const API_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min idle

let _token: string | null = null;
let _sessionTimer: ReturnType<typeof setTimeout> | undefined;

export const FabAPI = {
  setToken(t: string)    { _token = t; resetSession(); },
  clearToken()           { _token = null; clearTimeout(_sessionTimer); },

  get   : <T = unknown>(path: string, params?: Record<string, string | number | null>) =>
            req<T>('GET', path + qs(params)),
  create: <T = unknown>(path: string, body: unknown)                => req<T>('POST', path, body),
  update: <T = unknown>(path: string, id: string, body: unknown)    => req<T>('PATCH', `${path}/${id}`, body),
  remove: (path: string, id: string)                                => req<void>('DELETE', `${path}/${id}`),

  // Convenience endpoints (also exposed as Edge Functions)
  dashboard: () => req<DashboardSummary>('GET', 'dashboard'),
  profile  : () => req<UserProfile>('GET', 'profile'),
  importCsv: (csv: string, projectId: string | null, filename: string) =>
              req<ImportResult>('POST', 'import/csv', { csv, project_id: projectId, filename }),

  sanitize, esc,   // XSS helpers (port from demo)
};
```

Rules:
- 401 → auto `clearToken()` + redirect to `/auth/signin`.
- 403 → throw with `error` message from Edge Function.
- 429 → throw "Too many requests — wait a moment" (rate limit).
- `Content-Type: application/json` + `Authorization: Bearer ${_token}` on every request.
- DEMO mode short-circuits before hitting `req()` and returns mock data from `lib/mock-data.ts` — same signature, no UI branching.

---

## 2. Roles, RBAC matrix, navigation guard

### 7 roles (matches persona doc)

`owner` | `estimator` | `pm` | `foreman` | `qc` | `accounting` | `worker`

### Authoritative module × role matrix (verbatim from your spec)

Legend: **F** = Full (CRUD), **V** = View, **C** = Create only, **A** = Approve action, **—** = hidden

| Module | Owner | Estimator | PM | Foreman | QC | Acct | Worker |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | F | V | F | V | V | V | — |
| Projects | F | V | F | V | V | V | — |
| **Live Activity** *(`multiuser`)* | F | — | F | — | — | — | — |
| Parts List | F | — | F | F | V | — | V |
| **Part Detail** *(`partdetail`, drill-down)* | F | — | F | F | V | — | V |
| Assemblies | F | — | F | F | V | — | — |
| Drawing Log | F | — | F | V | V | — | V |
| Erection Sequence | F | — | F | F | — | — | — |
| Daily Log | F | — | F | F | — | — | — |
| Estimating | F | F | V | — | — | — | — |
| GC Contacts | F | F | F | — | — | — | — |
| AISC 303 Checklist | F | — | F | V | F | — | — |
| AWS Weld Log | F | — | V | — | F | — | — |
| Paint Inspection | F | — | V | — | F | — | — |
| NCR Reports *(aspirational — Phase 4)* | F | — | V | V | F | — | — |
| Heat Numbers | F | — | V | — | F | — | — |
| Cert Tracker | F | — | V | — | F | — | — |
| OSHA Checklist | F | — | F | F | V | — | — |
| Purchase Orders | F | — | F | V | — | F | — |
| Material Receiving | F | — | F | F | V | V | — |
| Inventory | F | V | F | V | — | V | — |
| Shipping Tickets | F | — | F | C | — | V | — |
| RFIs | F | — | F | V | V | — | — |
| Change Orders | F | — | F | — | — | V | — |
| Job Cost Tracker | F | V | F | — | — | F | — |
| AIA G702 Billing | A | — | V | — | — | F | — |
| Cut Plan Optimizer *(aspirational — Phase 7)* | F | — | F | F | — | — | — |
| Worker View (Mobile) | — | — | — | — | — | — | F |
| Users & Roles | F | — | — | — | — | — | — |
| Integrations | F | — | V | — | — | — | — |
| Import / Tekla CSV | F | — | F | — | — | — | — |
| QR Codes | F | — | F | F | — | — | — |

> **Sidebar shape vs capability** — this table is *capability* per role. The exact sidebar (sections + order) per role is the authoritative `ROLE_NAV` in `personas-and-rbac-v5.md` §10.5. `lib/nav-config.ts` must mirror that.

### Navigation guard implementation

```ts
// middleware.ts — runs before every /dashboard/* and /worker request
export async function middleware(req: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/auth/signin', req.url));

  const role = user.app_metadata.org_role as Role;
  const orgId = user.app_metadata.active_org_id;

  // Worker allow-list (matches demo `ROLE_NAV.worker`): /worker, /parts, /partdetail/*, /drawings
  const WORKER_ALLOW = /^\/(worker|parts|partdetail|drawings)(\/|$)/;
  if (role === 'worker' && !WORKER_ALLOW.test(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/worker', req.url));
  }

  // Block other roles from /worker (it's a mobile-only view)
  if (role !== 'worker' && req.nextUrl.pathname.startsWith('/worker')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // RBAC check for the requested module (uses authoritative ROLE_NAV from §10.5)
  const moduleKey = resolveModuleKey(req.nextUrl.pathname);
  if (moduleKey && !ROLE_NAV[role].some(s => s.items.some(i => i.id === moduleKey))) {
    return NextResponse.redirect(new URL('/dashboard', req.url)); // or 403
  }

  // Pass CU context downstream
  const res = NextResponse.next();
  res.headers.set('x-cu-role', role);
  res.headers.set('x-cu-org', orgId);
  return res;
}
```

`ROLE_NAV` is generated from the matrix above and lives in `lib/rbac.ts`.

**Sidebar rendering rule:** `Sidebar.tsx` must filter `NAV_SECTIONS` against `ROLE_NAV[role]`. Currently the sidebar shows all items unconditionally — this is the first bug to fix in Phase 0.

---

## 3. Data model — 37 tables

Conventions on every tenant-scoped table:
- `id uuid pk default gen_random_uuid()`
- `org_id uuid not null references orgs(id) on delete cascade`
- `created_at timestamptz default now()`
- `updated_at timestamptz` maintained by `fn_set_updated_at()` trigger
- `created_by uuid references auth.users(id)`
- RLS enabled with the `org_isolation` policy from §2 + role-gated write policy

### Catalogue

| # | Table | Drives module | Realtime | Notes |
|---|---|---|---|---|
| 1 | `orgs` | (root) | — | Org settings, plan, billing_status |
| 2 | `org_members` | Users & Roles | — | (org_id, user_id, role, active, invited_at) |
| 3 | `user_invitations` | Users & Roles | — | Pending invites with expiry |
| 4 | `org_audit_log` | (security) | — | Every Edge Function call: who/what/when/from-where |
| 5 | `projects` | Projects | ✅ | client, contract_type, contract_value, deadline, status, color, description |
| 6 | `project_milestones` | Projects | ✅ | phase, due_date, completed_at |
| 7 | `estimates` | Estimating | — | est_number, structural_tons, misc_metal_lbs, total_bid, margin_pct, bid_due_date, status |
| 8 | `estimate_line_items` | Estimating | — | category, qty, unit_cost, labor_hours |
| 9 | `gc_contacts` | GC Contacts | — | name, company, role, project_id, phone, email, last_contact |
| 10 | `gc_interactions` | GC Contacts | — | Log of phone/email/site-visit per contact |
| 11 | `change_orders` | Change Orders | ✅ | co_number, drawing_rev, total_value, status, billed_in_app_id |
| 12 | `rfis` | RFIs | ✅ | rfi_number, submitted_to, question, answer, date_answered, status |
| 13 | `drawings` | Drawing Log | — | drawing_no (unique), current_revision_id |
| 14 | `drawing_revisions` | Drawing Log | — | drawing_id, revision, date_issued, approved_by, file_id, status (Current/Superseded), parts_linked_count |
| 15 | `parts` | Parts List | **✅ hot** | part_id_text, profile, material, length_text, weight_lbs, phase, status enum, drawing_revision_id, assembly_id, heat_number_id, co_ref_id |
| 16 | `part_status_history` | Parts List | — | Append-only history of every status change with reason + actor |
| 17 | `assemblies` | Assemblies | ✅ | assembly_id_text, description, status; progress computed via view |
| 18 | `daily_logs` | Daily Log | ✅ | log_date, station, operators[], parts_completed, operation_type, hours_worked, notes |
| 19 | `purchase_orders` | Purchase Orders | ✅ | po_number, supplier, qty_ordered, qty_received, receiving_status, total_amount, status |
| 20 | `po_line_items` | Purchase Orders | — | po_id, material, qty, unit_price |
| 21 | `receipts` | Material Receiving | ✅ | receipt_number, po_id, delivery_date, supplier, bundle_tag, heat_number_id, qty_received, qty_ordered, mtr_status, damage_notes, released |
| 22 | `inventory` | Inventory | ✅ | material, astm_spec, qty_on_hand, max_stock, reorder_point, status (ok/low/out — computed view) |
| 23 | `inventory_transactions` | Inventory | — | +/- movements for audit; recompute qty_on_hand from sum |
| 24 | `heat_numbers` | Heat Numbers | ✅ | heat_number, astm_spec, profile, supplier, mtr_status, mtr_file_id, parts_count, status (Released/Quarantine) |
| 25 | `material_specs` | (lookup) | — | ASTM grade catalogue (A992, A36, A500 Gr.C, …) |
| 26 | `paint_inspections` | Paint Inspection | ✅ | insp_number, part_id, surface_prep, primer_dft, topcoat_dft, total_dft, total_req, inspector, result |
| 27 | `weld_inspections` | AWS Weld Log | ✅ | weld_id, part_id, joint_type, weld_process, filler_metal, insp_method, inspector, result, notes |
| 28 | **`ncr_reports`** | **NCR Reports** | **✅** | ncr_number, source_inspection_id (FK paint OR weld), part_id, description, root_cause, corrective_action, closed_at, closed_by |
| 29 | `ncr_attachments` | NCR Reports | — | Photos/PDFs linked to an NCR |
| 30 | `certifications` | Cert Tracker | — | person_company, cert_type, cert_number, issue_date, expiry_date, alert_days |
| 31 | `aisc_checklist_items` | AISC 303 | ✅ | project_id, item_key, status (open/hold/cleared), assigned_to, notes |
| 32 | `osha_checklist_items` | OSHA Checklist | ✅ | project_id, item_key, status, assigned_to, photo_id |
| 33 | `erection_sequences` | Erection Sequence | ✅ | seq_number, phase, description, profiles, assembly_ids[], status |
| 34 | `shipments` | Shipping Tickets | ✅ | load_number, ship_date, carrier, driver, erection_seq_id, total_pieces, total_weight, status |
| 35 | `shipment_parts` | Shipping Tickets | — | shipment_id ↔ part_id (m:n) |
| 36 | `job_cost_lines` | Job Cost Tracker | ✅ | project_id, category, budget, actual, committed |
| 37 | `billing_applications` | AIA G702 Billing | ✅ | app_number, period_to, pct_complete, amount_claimed, retainage_pct, retainage_withheld, amount_certified, status (Draft/Submitted/Certified) |
| 38 | `billing_g703_lines` | AIA G702 Billing | — | billing_app_id, item_no, description, scheduled_value, work_completed_to_date, materials_stored, total_completed, pct, balance_to_finish |
| 39 | `cut_plans` | Cut Plan Optimizer | — | project_id, generated_at, total_yield_pct, total_drop_lbs, parameters_json |
| 40 | `cut_plan_lines` | Cut Plan Optimizer | — | cut_plan_id, stock_length_id, parts[] (m:n with offsets), waste_in |
| 41 | `qr_codes` | (cross-cutting) | — | entity_type, entity_id, generated_at, image_url — used by /qr/[partId] |
| 42 | `notifications` | (cross-cutting) | **✅ hot** | user_id, type, message, entity_link, read |
| 43 | `activity_events` | Live Activity | **✅ hot** | append-only audit log powering /dashboard/live-activity |
| 44 | `file_attachments` | (cross-cutting) | — | polymorphic: entity_type, entity_id, storage_bucket, storage_path, mime, size, uploaded_by |

> **Count:** 44 tables proposed. Persona spec said 37; the extra 7 are normalised line-items and audit/lookup tables I'd argue are essential. Cut to 37 by collapsing `*_line_items` into JSONB on the parent if you prefer flatter schema — flag for §15.

### Two schemas worth showing in detail

```sql
-- ─────────────────── NCR REPORTS (new in v5) ───────────────────
CREATE TYPE ncr_status AS ENUM ('Open','Investigating','Corrective Action','Closed','Voided');

CREATE TABLE ncr_reports (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id             uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ncr_number             text NOT NULL,
  source_table           text NOT NULL CHECK (source_table IN ('paint_inspections','weld_inspections','manual')),
  source_inspection_id   uuid,
  part_id                uuid REFERENCES parts(id),
  description            text NOT NULL,
  root_cause             text,
  corrective_action      text,
  status                 ncr_status NOT NULL DEFAULT 'Open',
  opened_by              uuid REFERENCES auth.users(id),
  closed_by              uuid REFERENCES auth.users(id),
  closed_at              timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, ncr_number)
);

CREATE INDEX ncr_open_idx ON ncr_reports (org_id, status) WHERE status NOT IN ('Closed','Voided');
```

### Auto-NCR trigger (the v5 "QC auto-prompt" rule)

```sql
CREATE FUNCTION fn_auto_ncr_on_fail() RETURNS trigger AS $$
DECLARE
  next_num text;
BEGIN
  IF NEW.result LIKE 'Fail%' THEN
    SELECT 'NCR-' || LPAD((COUNT(*)+1)::text, 5, '0')
      INTO next_num FROM ncr_reports WHERE org_id = NEW.org_id;

    INSERT INTO ncr_reports (
      org_id, project_id, ncr_number, source_table, source_inspection_id,
      part_id, description, opened_by, status
    ) VALUES (
      NEW.org_id, NEW.project_id, next_num, TG_TABLE_NAME, NEW.id,
      NEW.part_id, 'Auto-created from ' || TG_TABLE_NAME || ' fail: ' || NEW.notes,
      NEW.inspector_user_id, 'Open'
    );

    -- Realtime broadcast picks up the INSERT automatically; notify QC role
    INSERT INTO notifications (org_id, user_id, type, message, entity_link)
    SELECT NEW.org_id, m.user_id, 'error',
           'NCR ' || next_num || ' auto-opened for ' || NEW.part_id,
           '/dashboard/ncr/' || next_num
    FROM org_members m
    WHERE m.org_id = NEW.org_id AND m.role IN ('qc','owner','pm') AND m.active;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_ncr_paint AFTER INSERT ON paint_inspections
  FOR EACH ROW EXECUTE FUNCTION fn_auto_ncr_on_fail();
CREATE TRIGGER auto_ncr_weld  AFTER INSERT ON weld_inspections
  FOR EACH ROW EXECUTE FUNCTION fn_auto_ncr_on_fail();
```

This is exactly the persona spec's rule: *"When Paint or Weld inspection fails, system auto-prompts to create NCR"* — implemented at the DB layer so the rule cannot be bypassed by client bugs.

---

## 3.bis Missing tables (gap-fill from demo audit)

Four tables and one enum were referenced in §3 / §4 / §6 but never defined. Adding them here brings the table count from 37 → **41** (still under the 44 mentioned in the persona doc; remaining 3 are normalisation tables flagged for owner sign-off, see §17).

### `notifications` (referenced everywhere — schema pinned)

```sql
CREATE TYPE notification_type AS ENUM ('error','warning','info','success');
-- demo bell panel shows: unread-r (error/red), unread-a (warning/amber),
-- unread-g (success/green), default/info (no border)

CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         notification_type NOT NULL DEFAULT 'info',
  message      text NOT NULL,
  entity_link  text,                    -- e.g. '/dashboard/ncr/NCR-00042'
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notif_user_unread_idx
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
```

### `aisc_checklist_catalogue` (master list of AISC items)

Derived from the demo's AISC page. Four categories × ~3 items each; expand as needed. Lives at **org level** (each org gets a seeded copy on `auth-bootstrap-org`) so customers can add custom items per shop.

```sql
CREATE TYPE aisc_section AS ENUM (
  '8.1_qc_plan', '6.4.1_mtrs', '8.2_welding_qc', '4.4_shop_drawings',
  '8.4_inspection_signoff', '8.2.2_cwi_credentials', 'custom'
);

CREATE TABLE aisc_checklist_catalogue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  section         aisc_section NOT NULL,
  title           text NOT NULL,
  reference       text NOT NULL,        -- e.g. 'AISC 303-10 §6.4.1 · ASTM A992'
  default_active  boolean NOT NULL DEFAULT true,
  sort_order      smallint NOT NULL DEFAULT 100,
  UNIQUE (org_id, section, title)
);
```

Per-project state (which items are Done/Pending/Hold/Overdue) lives in the existing `aisc_checklist_items` table — link via `catalogue_id`.

### `procore_sync_log` (audit trail for Integrations stub)

```sql
CREATE TYPE procore_sync_status AS ENUM ('ok','partial','failed','demo');

CREATE TABLE procore_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  triggered_by    uuid REFERENCES auth.users(id),
  payload_kind    text NOT NULL,        -- 'submittal' | 'rfi' | 'daily_log' | 'part_status'
  procore_id      text,                 -- nullable when payload_kind='demo'
  status          procore_sync_status NOT NULL,
  error_message   text,
  request_body    jsonb,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX procore_org_recent_idx
  ON procore_sync_log (org_id, created_at DESC);
```

In v5 the only writer is the `demoProcore()` button → rows with `status='demo'`. v6 OAuth integration uses the same table for real syncs.

### `system_metrics` (materialised view powering Live Activity tile)

```sql
CREATE MATERIALIZED VIEW system_metrics AS
SELECT
  org_id,
  count(*) FILTER (WHERE action='login'        AND created_at > now() - interval '24 hours') AS logins_24h,
  count(*) FILTER (WHERE action='update-part-status' AND created_at > now() - interval '24 hours') AS part_updates_24h,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_latency_ms,
  now() AS refreshed_at
FROM audit_log
GROUP BY org_id;

CREATE UNIQUE INDEX system_metrics_pk ON system_metrics (org_id);

-- Refreshed by pg_cron every 5 minutes (see §11)
```

### `productivity_metrics` (rolling view for Daily Log dashboard)

```sql
CREATE MATERIALIZED VIEW productivity_metrics AS
SELECT
  org_id, project_id, station, log_date,
  sum(parts_completed)        AS parts_completed,
  sum(hours_worked)           AS hours_worked,
  sum(material_consumed_lbs)  AS material_consumed_lbs,
  CASE WHEN sum(hours_worked) > 0
       THEN sum(parts_completed)::numeric / sum(hours_worked)
       ELSE 0 END             AS parts_per_hour
FROM daily_logs
GROUP BY org_id, project_id, station, log_date;

CREATE UNIQUE INDEX productivity_metrics_pk
  ON productivity_metrics (org_id, project_id, station, log_date);
```

### Updated table count

| Group | Count | Notes |
|---|---|---|
| Original §3 catalogue | 37 | unchanged |
| §3.bis additions | 5 | `notifications` (pinned), `aisc_checklist_catalogue`, `procore_sync_log`, `system_metrics` (mview), `productivity_metrics` (mview) |
| **Total** | **42** | counted as 2 mviews + 40 base tables |
| Persona doc target | 44 | remaining 2 are normalisation tables on hold (see §17 Q-7) |

### Pricing page resolution

The `pg-pricing` page in the demo is **not part of the application proper** — it is a marketing/billing artefact (Starter $99 / Professional $349 / Enterprise Custom). Two clean options:

1. **Move it out** — relocate the `<div id="pg-pricing">` content to a marketing landing page (`/pricing` under the public site), not inside `/dashboard/*`. **Recommended.**
2. **Keep it in-app as "Plan & Billing"** — surface it as a tab under `Users & Roles` for Owner only; backs onto a `subscription_plans` + `org_subscriptions` table (out of v5 scope).

Decision deferred to Owner sign-off (added to §17 Q-8).

---

## 4. Realtime channels

| Channel | Filter | Audience | Drives |
|---|---|---|---|
| `org:<orgId>:activity` | `activity_events` INSERT | all active users | `<LiveActivityFeed>`, dashboard, **`/multiuser`** feed |
| `org:<orgId>:presence` | Supabase presence channel | owner, pm | **`/multiuser`** "Active Users Now" tile |
| `org:<orgId>:notifications:<userId>` | `notifications` INSERT WHERE user_id=X | self only | `<NotifPanel>`, bell badge |
| `org:<orgId>:parts` | `parts` UPDATE | foreman, qc, pm, worker | `/parts`, `/assemblies`, dashboard pie, **`/worker`** |
| `org:<orgId>:project:<projectId>` | parts/assemblies/COs/RFIs WHERE project_id=X | viewers of that project | project detail |
| `org:<orgId>:shipments` | `shipments` UPDATE | pm, foreman, accounting | `/shipping` |
| `org:<orgId>:qc` | paint/weld inspections + **ncr_reports** + parts(hold) | qc, pm | `/aisc`, `/weld-log`, `/paint-inspection`, **`/ncr`** |
| `org:<orgId>:osha` | `osha_checklist_items` | foreman, pm, qc | `/osha` |
| `org:<orgId>:inventory` | `inventory` UPDATE when status changes | pm, foreman, accounting | `/inventory` |

Realtime evaluates RLS per event, so cross-tenant leakage is structurally prevented.

### Live Activity page (`/multiuser`) — owner + PM only

What the demo renders, and the data behind it:

| Tile | Source | Realtime hook |
|---|---|---|
| **Active Users Now** — list of online users with role, what they're doing, last action | Supabase **presence channel** `org:<orgId>:presence` — every client `track()`s `{ user_id, role, current_page, last_action_at }` on mount | presence diff events |
| **Activity Feed** (last 50 events, "● Live" badge) | `activity_events` table (already in §3) | INSERT on `org:<orgId>:activity` |
| **Concurrent Usage** — `Active Now`, `Today's Logins`, `Status Updates (24h)`, `Latency (p95)` | aggregate from `audit_log` + `part_status_history`; p95 from Edge Function execution logs | poll every 30s (cheap) |

Implementation notes:
- Presence channel pushes `{ user_id, role_label, current_page, status }`. UI shows online (green dot) when seen <60s ago, "Last: <project> · 2h ago" when older.
- Activity feed is bounded — keep last 100 events client-side; `useEffect` cleanup on unmount.
- Latency tile reads from a `system_metrics` materialised view refreshed every 5 min by `pg_cron`. Don't query Edge Function logs at request time.

### Worker view real-time

`/worker` subscribes to `org:<orgId>:parts` filtered to `assigned_user_id = <self>`. When a part is reassigned to them, the queue updates immediately. When status changes (their own update or someone else's), the card flips colour.

---

## 5. Storage — 4 buckets

| Bucket | Path | RLS |
|---|---|---|
| `drawings` | `{org_id}/{project_id}/{drawing_id}/{rev}.pdf` | `org_id` prefix policy |
| `photos` | `{org_id}/{entity_type}/{entity_id}/{uuid}.jpg` | `org_id` prefix policy |
| `mtrs` | `{org_id}/heat-numbers/{heat_number_id}/{filename}.pdf` | `org_id` prefix policy |
| `billing-pdfs` | `{org_id}/billing/{billing_app_id}/G702-{app_number}.pdf` | `org_id` prefix policy, signed URL only |

Signed URLs expire in 1 hour. The QR PNG references a signed deep-link to `/worker?part=<id>` valid for 24h (long, because workers may scan a card hours after it's printed).

---

## 6. API surface — 31 endpoints (18 core + 13 CRUD wrappers)

All deploy as Supabase Edge Functions (Deno runtime, TypeScript, Zod validation, `Authorization: Bearer <jwt>` from caller). Naming convention: kebab-case verb-object. Every endpoint is reachable through `FabAPI` (see §1).

> **Header revision:** the earlier "18 Edge Functions" referred to *core/transactional* endpoints only. After auditing all 30 demo pages + 17 modals against the doc, **13 simple-CRUD endpoints** were missing. The complete list below is what Phase 0–10 must ship.

### 6.1 Core transactional endpoints (write paths with side effects)

| # | Endpoint | Method | Purpose | Modal/Source | Side effects | RBAC |
|---|---|:--:|---|---|---|---|
| 1 | `auth-bootstrap-org` | POST | First sign-up: creates `orgs` + `org_members` (owner). Idempotent on `auth.user.id`. | sign-up flow | seeds `audit_log` | new user |
| 2 | `invite-user` | POST | Owner invites email + role. Sends Supabase invite; creates `user_invitations`. | `m-invite` | email + notification | owner |
| 3 | `accept-invite` | POST | Flips `org_members.active=true`. | invite-link flow | — | invited user |
| 4 | `switch-active-org` | POST | Multi-org users; updates `app_metadata.active_org_id`; returns new JWT. | sidebar org-switcher | — | any |
| 5 | `crud-project` | POST | Create/update/archive project. Archive cascades to assemblies/parts/drawings. | `m-proj` | `activity_events`, `audit_log` | owner, pm |
| 6 | `crud-estimate` | POST | Create/update estimate + line items. Computes totals server-side. | `m-estimate` | — | owner, estimator |
| 7 | `update-part-status` | POST | Update one or many parts' status. Writes `part_status_history` + `activity_events` in same tx. Enforces state machine. | parts list, `partdetail`, `/worker` 3-tap | Realtime `parts`, NCR trigger on Hold | owner, pm, foreman, qc, worker(own only) |
| 8 | `import-tekla-csv` | POST | PapaParse on stream; batch upsert parts/assemblies. Returns `{ inserted, updated, skipped[], errors[] }`. Advisory lock per org. | `pg-import` | `activity_events` | owner, pm |
| 9 | `preview-csv-import` | POST | Same input as #8; returns first 50 parsed rows + column mapping inference. No writes. | `pg-import` preview pane | — | owner, pm |
| 10 | `crud-rfi` | POST | Create/update/answer RFI. | `m-rfi` | notification to assignee | owner, pm |
| 11 | `crud-change-order` | POST | Create/update/approve CO. On `Approved`, notifies accounting. | `m-co` | notification | owner, pm |
| 12 | `crud-inspection` | POST | One endpoint for paint + weld; routes by `kind`. INSERT triggers **auto-NCR on fail** (§3). | `m-paint`, `m-weld` | Realtime `qc`, optional photo upload | owner, qc |
| 13 | `crud-ncr` | POST | Update NCR fields, attach root cause, close. Cannot delete. | NCR detail (Phase 4) | Realtime `qc` | owner, qc |
| 14 | `crud-purchase-order` | POST | Create/update PO + line items. Approve-gate: > threshold needs owner approval. | `m-po` | notification on submit | owner, pm, accounting |
| 15 | `crud-receipt` | POST | Log receipt against PO; updates PO `qty_received`, `receiving_status`; inserts `inventory_transactions`; auto-creates `heat_numbers` row if new. | `m-receive` | Realtime `inventory`, optional MTR upload | owner, pm, foreman |
| 16 | `crud-shipment` | POST | Create shipment + link parts (m:n); flip `parts.status='Shipped'` in same tx; auto-render BOL PDF. | `m-ship` | Realtime `shipments`+`parts`, PDF to `billing-pdfs` | owner, pm, foreman(create-only) |
| 17 | `generate-cut-plan` *(Phase 7)* | POST | Optimizer over parts + inventory; persists `cut_plans` + `cut_plan_lines`. Long-running → returns `job_id`; client polls or subscribes. | (no UI yet) | Realtime on `cut_plans` | owner, pm, foreman |
| 18 | `render-aia-g702` | POST | Generate G702/G703 PDF from `billing_applications`. Uploads to `billing-pdfs` bucket. Returns signed URL. | `m-billing` "Generate G702" button | PDF to bucket | owner, accounting |

### 6.2 Simple-CRUD wrappers (one per resource not covered above)

These follow a uniform `crud-<resource>` shape: `POST` body with `{ op: 'create' | 'update' | 'archive', payload }`. They exist as Edge Functions (rather than direct table writes) so that RLS, audit logging, and notification side effects stay centralised.

| # | Endpoint | Modal/Source | Side effects | RBAC |
|---|---|---|---|---|
| 19 | `crud-drawing` | `pg-drawings` (drag-drop + revision upload) | Storage write to `drawings` bucket; bumps `drawings.current_rev`; `activity_events` | owner, pm |
| 20 | `crud-assembly` | `pg-assemblies` (inline edit / detail panel) | Realtime `parts` channel | owner, pm, foreman |
| 21 | `crud-daily-log` | `m-dailylog` | Updates rolling `productivity_metrics` view | owner, pm, foreman |
| 22 | `crud-aisc-checklist` | `pg-aisc` (click-to-toggle item) | Writes `aisc_checklist_items` + sign-off audit; on item `Overdue` → notification to QC + Owner | owner, pm, qc |
| 23 | `crud-osha-item` | `pg-osha` (click-to-toggle item) | `audit_log` only | owner, pm, foreman |
| 24 | `crud-heat-number` | `m-heat` | If MTR file attached → upload to `mtrs` bucket; sets `heat_numbers.mtr_status`; **`Quarantine` on missing MTR blocks fabrication** | owner, pm, foreman, qc |
| 25 | `crud-certification` | `m-cert` | Schedules cron entry for expiry alert (T-30 days configurable) | owner, qc |
| 26 | `crud-erection-sequence` | `m-seq` | Links assemblies to sequence; updates `erection_sequence.status` | owner, pm |
| 27 | `crud-gc-contact` | `m-gc` | — | owner, pm, estimator |
| 28 | `crud-inventory-adjust` | `m-stock` | Writes `inventory_transactions` (`kind='manual_adjust'`); Realtime `inventory` | owner, pm, foreman |
| 29 | `crud-billing-application` | `m-billing` "Save Draft" path | Creates/updates `billing_applications` + `billing_g703_lines`; **does NOT render PDF** (use #18 for that) | owner, accounting |
| 30 | `crud-notification` | bell panel (mark-read, mark-all-read) | Updates `notifications.read_at` | self only |
| 31 | `jobcost-summary` | `pg-jobcost` | **Read-only** aggregate endpoint (POs + receipts + daily-logs + change-orders → project-level rollup). Cached 60s. | owner, pm, accounting |

### 6.3 What's NOT an Edge Function

- **List reads** — go directly to Postgres via `supabase-js` (RLS filters). Pagination via `range()`. No Edge Function indirection needed for plain `SELECT`.
- **CSV / PDF / QR downloads** — Next.js Route Handlers under `/api/export/*` because they need streaming + `Content-Disposition` headers. QR rendering uses `qrcode.react` **on the client** (demo uses `qrcodejs` CDN); only the deep-link URL is server-generated.
- **Auth handshake** — Supabase Auth handles sign-up/sign-in natively; we only intervene with `auth-bootstrap-org` as a post-hook.
- **Realtime subscriptions** — `supabase-js` channels are opened from the client; Edge Functions only fire INSERTs that those channels pick up.

### 6.4 Cross-cutting endpoint behaviours

Every endpoint above MUST:
- Verify JWT and resolve `(user_id, org_id, role)` before any work.
- Run Zod validation on body; reject 400 with `error.flatten()` on failure.
- Re-check RBAC server-side even though the UI already gates it (defence in depth).
- Append one row to `audit_log` with `(actor_user_id, action, target_table, target_id, payload_hash, ip, ua)`.
- Use a single transaction when touching ≥2 tables. If any write fails, the whole call returns 4xx and rolls back.
- Return `{ ok: true, data: ... }` on success; `{ ok: false, error: '...' }` on failure. `FabAPI` keys off `res.ok` + HTTP status.
- Emit at most one `notifications` row per affected user per action (no spam).

### Edge Function template (all 18 follow this shape)

```ts
// supabase/functions/update-part-status/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { z } from "https://deno.land/x/zod/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRole, auditLog, ok, fail } from "../_shared/utils.ts";

const InputSchema = z.object({
  partIds: z.array(z.string().uuid()).min(1).max(500),
  nextStatus: z.enum(['Not Started','Cutting','Welding','Painting','Completed','Shipped']),
  reason: z.string().max(500).optional(),
});

serve(async (req) => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } }
  });
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return fail(401, 'unauthenticated');

  const role = user.user.app_metadata.org_role;
  const guard = requireRole(role, ['owner','pm','foreman','qc','worker']);
  if (!guard.ok) return fail(403, guard.reason);

  const body = InputSchema.safeParse(await req.json());
  if (!body.success) return fail(400, body.error.flatten());

  // Worker may only update their own assigned parts — enforced via RLS on the UPDATE
  const { data, error } = await sb.rpc('fn_update_part_status', {
    p_part_ids: body.data.partIds,
    p_next: body.data.nextStatus,
    p_reason: body.data.reason ?? null,
  });

  if (error) return fail(400, error.message);
  await auditLog(sb, 'update-part-status', { count: body.data.partIds.length });
  return ok({ updated: data });
});
```

Shared utils in `supabase/functions/_shared/` keep all 31 endpoints consistent.

---

## 6.5 Form field specifications (all 17 demo modals)

Each block below maps a demo modal (`m-*` in `docs/reference/fabsimple-v5-demo.html`) to its Zod schema, the Edge Function it calls, and any computed/auto fields. Fields marked `auto` are server-generated; do not surface them as inputs.

### M-1 · `m-proj` → `crud-project` (#5)

```ts
const ProjectInput = z.object({
  project_name:        z.string().min(1).max(120),
  client_or_gc:        z.string().min(1).max(120),
  deadline:            z.coerce.date(),
  contract_type:       z.enum(['Lump Sum','GMP','T&M','Unit Price']),
  gc_site_contact:     z.string().max(120).optional(),
  gc_contact_phone:    z.string().max(30).optional(),
  description_scope:   z.string().max(2000).optional(),
});
// auto: id, org_id, project_number ('PRJ-YYYY-NNNN'), created_by, status='Bidding'
```

### M-2 · `m-estimate` → `crud-estimate` (#6)

```ts
const EstimateInput = z.object({
  project_name:         z.string().min(1),
  client:               z.string().min(1),
  project_type:         z.enum(['Commercial Building','Industrial','Parking Structure','Bridge / Infrastructure','Misc Metals Only','Other']),
  structural_tons:      z.number().positive(),
  misc_metal_lbs:       z.number().nonnegative(),
  connection_complexity:z.enum(['Simple','Moderate','Complex','Heavy']),
  paint_system:         z.enum(['None','Primer Only','2-Coat','3-Coat SSPC']),
  est_labor_hours:      z.number().positive(),
  material_cost_est:    z.number().positive(),
  overhead_pct:         z.number().min(0).max(100).default(15),
  profit_margin_pct:    z.number().min(0).max(100).default(18),
  bid_due_date:         z.coerce.date(),
  delivery_distance_mi: z.number().nonnegative().optional(),
  scope_notes:          z.string().max(2000).optional(),
});
// auto: estimate_number ('EST-YYYY-NNN'), total_bid (server-computed), margin_pct, status='Pending'
// server compute: total_bid = (labor_hours * labor_rate) + material_cost_est + overhead + profit
```

### M-3 · `m-co` → `crud-change-order` (#11)

```ts
const ChangeOrderInput = z.object({
  project_id:        z.string().uuid(),
  description:       z.string().min(1).max(500),
  drawing_revision:  z.string().max(20),
  requested_by:      z.string().max(120),
  scope_of_work:     z.string().max(2000),
  est_labor_hours:   z.number().nonnegative(),
  est_material_cost: z.number().nonnegative(),
  markup_pct:        z.number().min(0).max(100).default(18),
  status:            z.enum(['Pending Approval','Approved','Rejected']).default('Pending Approval'),
});
// auto: co_number ('CO-NNN'), total_value = (labor*rate + material) * (1 + markup_pct/100)
```

### M-4 · `m-rfi` → `crud-rfi` (#10)

```ts
const RfiInput = z.object({
  project_id:        z.string().uuid(),
  submit_to:         z.string().min(1).max(120),
  question:          z.string().min(1).max(2000),
  drawing_reference: z.string().max(60).optional(),
  date_needed_by:    z.coerce.date(),
});
// auto: rfi_number ('RFI-NNNN'), status='Open', date_submitted=now()
```

### M-5 · `m-receive` → `crud-receipt` (#15)

```ts
const ReceiptInput = z.object({
  po_id:              z.string().uuid(),
  delivery_date:      z.coerce.date(),
  supplier_or_driver: z.string().max(120),
  material_profile:   z.string().max(60),
  bundle_tag:         z.string().max(60),
  heat_number:        z.string().max(60),
  qty_received:       z.number().positive(),
  qty_on_po:          z.number().positive(),
  damage_noted:       z.string().max(1000).optional(),
  mtr_status:         z.enum(['On File','Awaiting from supplier','Not Required']),
  release_to_shop:    z.boolean().default(true),
});
// auto: receipt_number ('REC-NNNN'), inventory_transactions row, heat_numbers upsert
// rule: if mtr_status='Awaiting' → heat_numbers.status='Quarantine' (blocks fabrication)
```

### M-6 · `m-ship` → `crud-shipment` (#16)

```ts
const ShipmentInput = z.object({
  project_id:        z.string().uuid(),
  scheduled_date:    z.coerce.date(),
  carrier_or_truck:  z.string().max(120),
  driver_name:       z.string().max(120),
  erection_sequence: z.string().max(60).optional(),
  total_pieces:      z.number().positive().int(),
  part_ids:          z.array(z.string().uuid()).min(1),
});
// auto: load_number ('L-NNNN'), bol_pdf_url (rendered post-create), status='Scheduled'
```

### M-7 · `m-po` → `crud-purchase-order` (#14)

```ts
const PurchaseOrderInput = z.object({
  supplier:           z.string().min(1).max(120),
  order_date:         z.coerce.date(),
  material_profile:   z.string().max(60),
  astm_spec:          z.enum(['ASTM A992','ASTM A500 Gr.C','ASTM A36','ASTM A572 Gr.50']),
  quantity:           z.number().positive(),
  unit_price:         z.number().positive(),
  expected_delivery:  z.coerce.date(),
  project_id:         z.string().uuid(),
});
// auto: po_number ('PO-YYYY-NNNN'), total = quantity * unit_price, status='Issued'
// approve-gate: total > org.po_approval_threshold → status='Pending Owner Approval'
```

### M-8 · `m-gc` → `crud-gc-contact` (#27)

```ts
const GcContactInput = z.object({
  name:        z.string().min(1).max(120),
  company:     z.string().min(1).max(120),
  role_title:  z.string().max(120),
  project_id:  z.string().uuid().optional(),
  phone:       z.string().max(30).optional(),
  email:       z.string().email().optional(),
});
```

### M-9 · `m-stock` → `crud-inventory-adjust` (#28)

```ts
const InventoryAdjustInput = z.object({
  material_profile:   z.string().min(1).max(60),
  astm_spec:          z.enum(['ASTM A992','ASTM A500','ASTM A36','ASTM A572 Gr.50']),
  quantity:           z.number().positive(),
  max_stock_level:    z.number().positive(),
  reorder_point:      z.number().nonnegative(),
  heat_number:        z.string().max(60).optional(),
});
// auto: inventory_transactions row { kind: 'manual_adjust' }
```

### M-10 · `m-seq` → `crud-erection-sequence` (#26)

```ts
const ErectionSequenceInput = z.object({
  sequence_number:    z.number().int().positive(),
  phase:              z.enum(['Phase 1','Phase 2','Phase 3']),
  description:        z.string().min(1).max(500),
  profiles_included:  z.string().max(500),
  piece_count:        z.number().int().positive(),
  assembly_ids:       z.string().max(500),     // free-text range; parse server-side
  status:             z.enum(['Queued','In Progress','Complete']).default('Queued'),
});
```

### M-11 · `m-dailylog` → `crud-daily-log` (#21)

```ts
const DailyLogInput = z.object({
  log_date:           z.coerce.date(),
  station:            z.enum(['Beam Line / CNC','Welding Station 1','Welding Station 2','Paint Booth','Touch-up / Shipping Prep']),
  operator_names:     z.string().max(500),
  parts_completed:    z.number().int().nonnegative(),
  operation_type:     z.enum(['Cutting','Welding','Painting','Finishing']),
  hours_worked:       z.number().positive(),
  material_consumed_lbs: z.number().nonnegative().optional(),
  equipment_issues:   z.string().max(500).optional(),
  notes_delays:       z.string().max(1000).optional(),
});
```

### M-12 · `m-paint` → `crud-inspection` (#12, `kind='paint'`)

```ts
const PaintInspectionInput = z.object({
  kind:                  z.literal('paint'),
  part_id:               z.string().uuid(),
  assembly_id:           z.string().uuid().optional(),
  inspection_date:       z.coerce.date(),
  inspector_name:        z.string().min(1).max(120),   // include cert # in same string
  surface_prep_spec:     z.enum(['SSPC SP-6 Commercial Blast','SSPC SP-10 Near-White Blast','SSPC SP-1 Solvent Clean']),
  grade_achieved:        z.enum(['SP-6 Compliant','SP-10 Compliant','Non-Compliant']),
  primer_system:         z.string().max(120),
  primer_dft_mils:       z.number().nonnegative(),
  primer_dft_required:   z.number().positive(),
  topcoat_system:        z.string().max(120),
  topcoat_dft_mils:      z.number().nonnegative(),
  topcoat_dft_required:  z.number().positive(),
  result:                z.enum(['Pass','Fail — Rework Required','Conditional Pass']),
  notes_defects:         z.string().max(2000).optional(),
});
// auto: inspection_number ('PI-NNNN'), total_dft = primer + topcoat
// trigger: result LIKE 'Fail%' → fn_auto_ncr_on_fail() (§3)
```

### M-13 · `m-cert` → `crud-certification` (#25)

```ts
const CertificationInput = z.object({
  person_or_company:    z.string().min(1).max(120),
  role_title:           z.string().max(120),
  cert_type:            z.enum(['AWS CWI','AWS Welder','SSPC Painting Inspector','AISC Company Certification','Crane / Rigging','DOT Carrier','Other']),
  cert_number:          z.string().min(1).max(60),
  issuing_body:         z.string().max(120),
  issue_date:           z.coerce.date(),
  expiry_date:          z.coerce.date(),
  alert_days_before:    z.number().int().positive().default(30),
  document_reference:   z.string().max(500).optional(),
});
// auto: schedules pg_cron job → notification (alert_days_before) days prior to expiry
// constraint: expiry_date > issue_date
```

### M-14 · `m-weld` → `crud-inspection` (#12, `kind='weld'`)

```ts
const WeldInspectionInput = z.object({
  kind:                z.literal('weld'),
  part_id:             z.string().uuid(),
  inspection_date:     z.coerce.date(),
  joint_type:          z.enum(['CJP Groove','PJP Groove','Fillet','Plug / Slot']),
  fillet_size:         z.string().max(30).optional(),                      // e.g. '5/16"'
  welding_process:     z.enum(['FCAW / E71T-1','SMAW / E7018','GMAW / ER70S-6','SAW']),
  filler_metal:        z.string().max(60),
  inspection_method:   z.enum(['VT (Visual)','UT (Ultrasonic)','MT (Magnetic Particle)','PT (Dye Penetrant)','RT (Radiographic)']),
  inspector_cwi:       z.string().min(1).max(120),
  result:              z.enum(['Pass','Fail — Repair Required','Pending']),
  aws_d11_reference:   z.string().max(60).optional(),                      // e.g. '§6.9 Visual'
  notes:               z.string().max(2000).optional(),
});
// auto: weld_number ('WLD-NNNN')
// trigger: result LIKE 'Fail%' → fn_auto_ncr_on_fail()
```

### M-15 · `m-heat` → `crud-heat-number` (#24)

```ts
const HeatNumberInput = z.object({
  heat_number:        z.string().min(1).max(60),
  astm_spec:          z.enum(['ASTM A992','ASTM A500 Gr.C','ASTM A36','ASTM A572 Gr.50','ASTM A325']),
  material_profile:   z.string().max(60),
  supplier:           z.string().max(120),
  mtr_status:         z.enum(['On File','Awaiting']),
  receipt_number:     z.string().max(60).optional(),
});
// rule: mtr_status='Awaiting' → status='Quarantine' (parts cannot leave receiving)
// upload: optional multipart MTR PDF → mtrs bucket
```

### M-16 · `m-billing` → `render-aia-g702` (#18) OR `crud-billing-application` (#29)

```ts
const BillingApplicationInput = z.object({
  application_number:        z.number().int().positive(),
  period_ending_date:        z.coerce.date(),
  project_id:                z.string().uuid(),
  pct_complete_this_period:  z.number().min(0).max(100),
  materials_stored_on_site:  z.number().nonnegative().default(0),
  change_orders_included:    z.string().max(500).optional(),  // 'CO-039, CO-040' free-text → server parses
  notes_for_gc:              z.string().max(2000).optional(),
  generate_pdf:              z.boolean().default(false),       // true → also call #18
});
// auto: application_id, g703 lines pulled from approved schedule of values
// rule: pct_complete must be ≥ previous application's pct_complete (no negative draws)
```

### M-17 · `m-invite` → `invite-user` (#2)

```ts
const InviteUserInput = z.object({
  first_name: z.string().min(1).max(60),
  last_name:  z.string().min(1).max(60),
  email:      z.string().email(),
  role:       z.enum(['owner','estimator','pm','foreman','qc','accounting','worker']),  // demo says 'Admin/Worker/Viewer' — see §6.5 note below
});
```

> **Demo wart to fix in v5:** the `m-invite` modal currently shows three roles (`Admin`, `Worker`, `Viewer`) — a leftover from v4. The persona spec defines **seven** roles. The Next.js port must render all seven role options, color-coded per `ROLE_COLORS` in `personas-and-rbac-v5.md` §10.5.

### Shared form rules

- All modals submit through `FabAPI.create()` or `FabAPI.update()`; never direct table writes.
- Date fields use `<input type="date">` and submit ISO-8601 `YYYY-MM-DD`; server upgrades to `timestamptz` at midnight `org_timezone`.
- Numeric fields with `step="0.01"` are money; backend stores as `numeric(14,2)`.
- All `*_id` foreign keys are resolved on the client via async-select pickers — never typed free-text.
- Validation errors render inline below each field; the modal cannot close until `FabAPI` returns `{ ok: true }`.
- Cancel = close modal; no warning prompt (matches demo behaviour).

---

## 7. CSV import (Tekla v5) — file-based only

The user spec is explicit: **v5 = Tekla CSV (file-based); v6 = Tekla Open API / .NET**.

Tekla CSV columns expected (configurable in `/dashboard/import` mapping UI):
- `Part Mark` → `parts.part_id_text`
- `Assembly Mark` → resolve to `parts.assembly_id` (create assembly if missing)
- `Profile` → `parts.profile`
- `Material Grade` → `parts.material` (validated against `material_specs`)
- `Length` → `parts.length_text` (free-form preserve)
- `Weight` → `parts.weight_lbs`
- `Phase` → `parts.phase`
- `Drawing Revision` → resolved to `drawing_revisions.id`; mismatch flagged

### Conflict policy

| Existing part status | Incoming row | Action |
|---|---|---|
| Not Started | any | UPDATE (Tekla is authoritative on geometry) |
| Cutting / Welding / Painting | row matches existing geometry | UPDATE non-geometry fields only |
| Cutting / Welding / Painting | row differs on geometry | SKIP + add to `errors[]` (`"part has progressed; resolve manually"`) |
| Completed / Shipped | any | SKIP + log to `errors[]` |

### Edge Function `import-tekla-csv` returns

```json
{
  "summary": { "inserted": 1247, "updated": 312, "skipped": 4, "errors": 0 },
  "skipped": [
    { "row": 1899, "part_id_text": "W14×82-1044", "reason": "part has progressed (Welding); geometry change blocked" }
  ],
  "errors": []
}
```

UI shows the summary banner; if `skipped.length > 0` or `errors.length > 0`, the entire response is downloadable as a CSV "import report".

---

## 8. DEMO vs LIVE mode

The persona doc requires both modes. Implementation:

```ts
// lib/api.ts — every UI mutation goes through this seam
export async function callApi<T>(endpoint: string, body: unknown): Promise<T> {
  if (process.env.NEXT_PUBLIC_FAB_MODE === 'demo') {
    await sleep(300);            // simulate latency for UX testing
    toast.success(`[DEMO] ${endpoint}`);
    return mockResponse(endpoint, body) as T;
  }
  // LIVE mode
  const res = await fetch(`/fab-api/${endpoint}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getJwt()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    toast.error(`Failed: ${res.statusText}`);
    throw new Error(await res.text());
  }
  toast.success(`Saved`);
  return res.json();
}
```

```ts
// lib/db.ts — every UI read goes through this seam
export function useResource<T>(table: string, filter: any): UseQueryResult<T[]> {
  return useQuery({
    queryKey: [table, filter],
    queryFn: async () => {
      if (process.env.NEXT_PUBLIC_FAB_MODE === 'demo') {
        return readFromMock(table, filter);
      }
      const { data, error } = await supabase.from(table).select('*').match(filter);
      if (error) throw error;
      return data as T[];
    },
  });
}
```

Toggle: `NEXT_PUBLIC_FAB_MODE=demo` (default) | `live`. Demo build can be deployed to a public URL for sales demos without any Supabase wiring; live build hits the real backend.

### Required for DEMO mode

Every page currently imports straight from `lib/mock-data.ts`. They need to be refactored to use `useResource('parts', { project_id })` instead, so the SAME page code works in both modes. This is Phase 0.5 — UI refactor before backend wiring.

---

## 9. Auth flows

| Flow | Implementation |
|---|---|
| Sign up | `/auth/signup` → `supabase.auth.signUp({ email, password })` → Edge Function `auth-bootstrap-org` creates org + owner membership in one tx |
| Sign in | Magic link / OTP / password (configurable per org). On success, JWT goes to `localStorage` (per spec); `refreshSession()` runs every 50 min |
| Invite | Edge Function `invite-user` → Supabase invite email → on acceptance, `accept-invite` flips active flag |
| Worker role | Sees no signup form — onboarded by Owner via invite; lands on `/worker` after first sign-in |
| Switch org | `switch-active-org` Edge Function returns new JWT with updated `app_metadata.active_org_id`; client persists; UI remounts |
| Sign out | `supabase.auth.signOut()` + clear localStorage explicitly + force redirect |
| Password reset | Supabase built-in |

### JWT trust boundary

Edge Functions verify JWT via Supabase's verification helper (asymmetric RS256). Never trust client-supplied role; always re-read from JWT claims. The `_shared/utils.ts → requireRole()` helper is the single place this check lives.

---

## 10. Mobile Worker View — UX constraints

Per persona doc:
- **375px viewport minimum.**
- **3-tap status update.**
- **QR-first navigation.**
- **No sidebar; no other modules accessible.**

### Worker home (`/worker`)

```
┌─────────────────────────────────┐
│ NOVUS · R. Torres        [⎋]   │ ← top bar: org + name + sign-out
├─────────────────────────────────┤
│ [📷  Scan QR]                   │ ← primary CTA, full-width, 56px tall
├─────────────────────────────────┤
│ My Queue (4)                    │
│ ┌─────────────────────────────┐ │
│ │ W14×82-1044     🟡 Welding  │ │ ← tap → part detail
│ │ A-204 · DS-104 Rev D        │ │
│ ├─────────────────────────────┤ │
│ │ HSS6×6-0312     🟦 Painting │ │
│ │ B-108 · DS-102 Rev C        │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 3-tap status update

```
Tap 1: scan QR        → opens /worker/part/<id>
Tap 2: "Update status" → bottom sheet with 6 status pills
Tap 3: pick status    → optimistic update + toast + auto-return to queue
```

### "Flag a problem" (without leaving the floor)

Long-press a part card → bottom sheet with `[ Wrong revision ] [ Material shortage ] [ Damage ] [ Other (voice note) ]`. Each posts a `notifications` row to the foreman + creates an `activity_events` entry. Voice note uploads as a `file_attachments` row pointing to the `photos` bucket (audio mime accepted).

---

## 11. Cron / scheduled jobs (`pg_cron`)

| Function | Schedule | Action |
|---|---|---|
| `cert-expiry-alerts` | daily 06:00 UTC | Insert notifications when `expiry_date - alert_days <= today` |
| `inventory-status-refresh` | every 15 min | Recompute `inventory.status` from qty vs reorder_point |
| `activity-feed-trim` | weekly Sun 02:00 UTC | Archive `activity_events` > 90d old to `activity_events_archive` |
| `billing-pct-recalc` | nightly 01:00 UTC | Recompute `pct_complete` on open billing apps from `v_assembly_progress` |
| `ncr-aging-alert` | daily 07:00 UTC | If any NCR open > 7 days, notify QC + PM |
| `pending-invite-cleanup` | nightly | Expire `user_invitations` rows older than 30 days |

---

## 12. Edge cases & failure modes

| # | Scenario | Mitigation |
|---|---|---|
| 1 | Two users update same part status concurrently | Postgres serializable isolation; `update-part-status` returns `conflict`; client toasts "refresh and retry" |
| 2 | Realtime drops mid-shift | supabase-js auto-reconnects; on reconnect, `queryClient.refetchQueries` for visible queries |
| 3 | 50k-row Tekla CSV | Streamed parse + batched 500-row inserts; advisory lock per org; max 5 min |
| 4 | Two concurrent CSV imports | Postgres advisory lock per `(org_id, 'tekla_import')`; second gets 409 |
| 5 | Owner deletes own account | Constraint: org must have ≥1 active owner — surfaces as 400 |
| 6 | Drawing revision supersession | New revision INSERT triggers prior revision → `Superseded`; parts retain FK to specific revision |
| 7 | Heat number quarantined while parts in production | Trigger flips affected parts' `hold=true`; notification fan-out to QC + PM |
| 8 | Inspection fail without immediate NCR follow-up | Auto-NCR trigger (§3); cannot bypass |
| 9 | NCR closed without root cause | DB CHECK constraint: `status='Closed' ⇒ root_cause IS NOT NULL AND corrective_action IS NOT NULL` |
| 10 | Worker on shop floor, no network | TanStack Query offline persist via IndexedDB; writes queued; replayed on reconnect |
| 11 | JWT stolen via XSS | Mitigated by short TTL + revocation list + per-call audit log (see §1) |
| 12 | Storage path traversal | Edge Function sanitises path; bucket policy enforces `org_id` prefix |
| 13 | Cut plan generated against stale inventory | `cut_plans.parameters_json` snapshots inventory at generation time; UI flags if inventory has changed since |
| 14 | RLS policy bug exposes cross-tenant data | Production smoke test: "synthetic Org B" sees 0 rows of Org A on every deploy |
| 15 | G702 generated with unbilled approved COs | `render-aia-g702` joins `change_orders WHERE status='Approved' AND billed_in_app_id IS NULL` and refuses to render until either included or explicitly excluded |
| 16 | Shipment created, parts not in Completed state | DB constraint blocks insert into `shipment_parts` unless `parts.status='Completed'` |

---

## 13. Performance budget

| Operation | p95 target | How |
|---|---|---|
| Dashboard initial load (Owner) | < 600ms TTFB | 4 parallel queries; SSR-hydrated |
| Parts list (1000 rows) | < 300ms | Index `(org_id, project_id, status)`; pagination 50/page |
| Tekla CSV ingest (5000 rows) | < 30s end-to-end | Batched 500-row inserts |
| Realtime event delivery | < 500ms | Supabase Realtime SLA |
| QR-scan → status update | < 800ms perceived | Optimistic update; rollback if Edge Function fails |
| G702 PDF render | < 3s | React-PDF in Node runtime; cache signed URL 1h |
| Cut Plan generation (200 parts) | < 5s | Run synchronously; > 200 parts switches to async job |

---

## 14. Tests — three tiers (Boil the Lake)

### Tier 1 — unit (free, <5s)

- Zod schemas for every Edge Function input + output
- `lib/rbac.ts` matrix: every (role, module) cell has a test
- `lib/utils.ts` helpers
- Status-transition state machine for `parts`

### Tier 2 — integration (Supabase local, ~30s)

- One test per Edge Function: happy path + 1 RLS violation + 1 role violation
- Migration up/down idempotency
- Realtime: subscribe → mutate → assert event within 1s
- Tekla CSV round-trip: 100-row sample → import → verify counts + conflicts
- Auto-NCR trigger fires on inspection fail; does not fire on Pass

### Tier 3 — E2E via Playwright (gated `EVALS=1`, ~10min)

One spec per role traversing their exact happy path:
- **Owner**: sign up → invite PM + Foreman + QC → view dashboard → approve G702
- **Estimator**: build estimate from past job → check inventory → submit
- **PM**: import Tekla CSV → assign parts → answer RFI → log change order
- **Foreman**: update daily log → reassign parts → flag erection sequence change
- **QC**: log fail weld → confirm NCR auto-created → close NCR with root cause → release heat number from Quarantine
- **Accounting**: create PO → mark received → generate G702 → submit
- **Worker** (mobile viewport 375px): scan QR → update status → flag problem → see queue update via Realtime

### Tier 4 — security (gstack `/cso`)

- OWASP Top 10
- Tenant isolation fuzz: random Org-A JWTs against every endpoint with Org-B IDs → all must 403 or empty result
- XSS test against every text input — even though JWT is in-memory, a successful XSS can still call `FabAPI` with the live token. `sanitize()` on output + CSP `script-src 'self'` are the defences under test.
- Idle-timeout test: confirm `FabAPI` clears token after 30 min idle and redirects to `/auth/signin`.
- Refresh-token rotation: confirm a stolen refresh cookie outside its issuing browser fails (Supabase rotation policy).

---

## 15. Phased build sequence

| Phase | Scope | Est. (CC+gstack) |
|---|---|---|
| 0 | Supabase project + `0000_init.sql` (orgs, org_members, audit_log, auth-bootstrap-org) + middleware + ROLE_NAV + Sidebar filtering | 0.5 day |
| 0.5 | UI refactor: replace `lib/mock-data.ts` direct imports with `useResource()` seam — DEMO mode still uses mock-data behind the seam | 1 day |
| 1 | Projects + Parts + Assemblies + Drawings + Drawing Revisions + status state machine + Realtime on parts. `update-part-status` + `crud-project` Edge Functions. | 1.5 days |
| 2 | Production loop completion: `daily_logs`, `change_orders`, `rfis` + corresponding Edge Functions | 1 day |
| 3 | Procurement: POs, line items, Receiving, Inventory + transactions + Heat Numbers + MTR bucket | 1 day |
| 4 | QC: Paint + Weld inspections + **NCR auto-trigger** + Cert Tracker + AISC checklist + photo bucket | 1.5 days |
| 5 | OSHA checklist + Erection Sequence + Shipments + shipment_parts + QR generation | 1 day |
| 6 | Finance: Job Cost + Billing applications + G703 lines + `render-aia-g702` + billing-pdfs bucket | 1 day |
| 7 | Cut Plan Optimizer table + `generate-cut-plan` Edge Function + UI | 1 day |
| 8 | Admin: Users & Roles UI, invites, role-switching, Integrations page (placeholder) | 0.5 day |
| 9 | **Worker view (mobile)** — `/worker`, QR scan, 3-tap status, problem-flag voice notes | 1 day |
| 10 | Tekla CSV import end-to-end (preview → map → ingest) + **`/multiuser` Live Activity page** (presence + activity feed) + notifications | 1 day |
| 11 | Polish: offline queue on Worker, optimistic updates, XSS hardening pass, full RLS smoke test, `/cso` audit | 1 day |
| **Total** | | **~12 days CC+gstack** (≈ 4-5 months human-team) |

---

## 16. Non-goals (v5)

- ❌ **Tekla Open API / .NET integration** — explicit v6 target. Integrations page lists it as "Configure" placeholder.
- ❌ **Native mobile apps** — `/worker` is PWA-grade mobile web
- ❌ **Multi-region / data residency** — single Supabase region per project
- ❌ **SSO / SAML** — Supabase Auth email-based only
- ❌ **Public webhooks (outbound)** — internal use only
- ❌ **Full offline-first CRDT** — only TanStack queue on Worker view
- ❌ **HttpOnly-cookie auth migration** — refresh token already cookie-backed by `@supabase/ssr`; full HttpOnly access token is v6 if SOC2 customer asks

### Integrations page — clarification

The demo's Integrations page renders **four marketed integrations**. Read this as UI presence only, not functional scope:

| Integration | Demo status | v5 actual scope | Notes |
|---|---|---|---|
| **Procore** | "Connected" badge + "▶ Demo Sync" button | **Stub only** — button fires `demoProcore()` which posts a hardcoded payload and shows a fake 200 response | Real OAuth2 + Procore Submittals/RFI API push lands in v6. v5 ships the UI shell. |
| **Tekla Direct API** | "Configure" button, "Enterprise plan" label | Not built. CSV import is the v5 path. | Aspirational; do not implement in v5 |
| **Viewpoint Vista** | "Configure" button | Not built. | v6+ |
| **QuickBooks Online** | "Connect" toast | Not built. | v6+ |

Net: the Integrations *page* is in scope (UI + Procore demo-sync stub). Real bidirectional sync to any of these systems is out of scope for v5.

---

## 17. Open questions (next `/office-hours`)

1. **PO approval threshold** — owner-spec says POs above threshold need owner approval. What's the default ($)?
2. **Owner's "less than 60s morning glance" dashboard** — current dashboard has 4 stat cards + 3 charts. Is that the right shape, or does Owner want a single "what's on fire today" panel?
3. **Cut Plan inputs** — only `parts` + `inventory`, or also `purchase_orders` (incoming stock)?
4. **Drawing revision PDFs** — can FabSimple consume Tekla's drawing export folder directly, or always manual upload?
5. **Voice-note transcription on Worker problem-flag** — Whisper API? Out of v5?
6. **Mobile camera for weld photos** — PWA `getUserMedia`, or postpone?
7. **Billing approval workflow** — Owner approves G702; what if Owner is out and PM needs to release the draw? Delegation?
8. **NCR aging escalation** — does an NCR open > 14d auto-page the Owner? Configurable per org?
9. **Pricing page placement** (§3.bis) — move to public marketing site, keep in-app as Owner-only "Plan & Billing" tab, or drop entirely from v5?
10. **AISC catalogue scope** — ship the 4 demo sections (8.1, 6.4.1, 8.2, 4.4) or expand to the full AISC 303-10 §8 inspection checklist (~30 items)?
11. **Invite-modal role mismatch** (§6.5 M-17) — demo modal still shows v4's `Admin/Worker/Viewer`. Confirm the Next.js port renders the 7 v5 roles.
12. **Two remaining tables** — persona doc targets 44; we have 42. Which two normalisation tables are required for v5 (e.g. `material_grades_lookup`, `weld_filler_metals_lookup`)?

---

## 18. Next gstack steps

```
/plan-design-review   # rate data model + endpoint surface 0-10 on each design dim
/plan-devex-review    # measure TTHW: from "git clone" to "ship a feature" — sub-30 min?
/autoplan             # run CEO + design + eng + DX in one pass on this updated doc

# When ready to build Phase 0:
/ship                 # opens the PR for Phase 0 + 0.5
/cso                  # security audit — JWT-in-localStorage warrants extra attention
/qa https://<demo>    # browser-driven QA on DEMO mode build
```

---

**Doc owner:** Engineering
**Last reconciled with persona spec:** 2026-05-23
**Tracked in:** `docs/backend-requirements.md`

---

## GSTACK REVIEW REPORT

**Reviewer:** `/plan-eng-review` · **Run:** 2026-05-23 · **Branch:** `main` · **Commit:** `f91b694`
**Confidence gate:** every finding below is anchored to a quoted line from this doc.
**Outside voices:** unavailable (`codex` CLI not installed) — single-reviewer mode.

### Status: DONE_WITH_CONCERNS

The plan is unusually thorough for a v5 cut (1,267 lines, 18 numbered sections, 17 modal schemas, 31 endpoints, 46 base tables). The recent audit-and-fill cycle closed most pre-existing gaps. **5 P1 blockers and 8 P1/P2 issues remain** — almost all are concrete corrections to the doc itself, not architectural rethinks.

**Score:** 7.5 / 10 once P1s land. Today, 6 / 10 — the P0s break the worker view, the auto-NCR trigger, and 11 ID generators.

### Findings summary

| # | Severity | Confidence | Component | Issue |
|---|---|---|---|---|
| 1 | P1 | 10 | `parts` schema | `assigned_user_id` referenced in §4 + §6.1 but missing from §3 catalogue |
| 2 | P1 | 10 | inspections | `fn_auto_ncr_on_fail` reads `NEW.inspector_user_id`; modals only capture free-text name |
| 3 | P1 | 10 | auth | §9 lines 1045/1049 still say `localStorage`; header says in-memory closure |
| 4 | P1 | 9 | numbering | `LPAD(COUNT(*)+1)` race condition replicated across 11 `*_number` generators |
| 5 | P1 | 10 | catalogue | Entity count math wrong: real total is 46 base + 2 mviews (not 42); `notifications` double-counted in §3.bis |
| 6 | P1 | 10 | tests | Zero test framework installed — no `vitest`/`playwright`/`msw` in `package.json` |
| 7 | P1 | 8 | modal M-16 | `change_orders_included` free-text comma list — parser footgun |
| 8 | P1 | 8 | dashboards | Owner/PM dashboards N+1 risk; mviews exist but no wire-up to dashboard endpoints |
| 9 | P2 | 9 | db funcs | `fn_update_part_status` + `fn_set_updated_at` used in template but undefined |
| 10 | P2 | 9 | activity | `activity_events_archive` referenced in cron, never in catalogue |
| 11 | P2 | 9 | audit_log | `org_audit_log` vs `audit_log` naming clash + no RLS policy spec |
| 12 | P2 | 9 | activity | `activity_events` schema undefined |
| 13 | P2 | 7 | receipts | Heat auto-create needs `UNIQUE(org_id, heat_number)` + PO/supplier check |
| 14 | P2 | 6 | auth idle | 30-min idle inappropriate for Worker mobile shop-floor session |
| 15 | P2 | 8 | AISC | `aisc_checklist_items.item_key` text should FK to `aisc_checklist_catalogue.id` |
| 16 | P2 | 8 | modal M-10 | `assembly_ids` free-text range — same footgun as M-16 |
| 17 | P2 | 8 | perf SLOs | Missing budgets for RT push (<500ms p95), list endpoints (<200ms p95), login→paint (<1.5s p95) |
| 18 | P3 | 7 | RT presence | 30s presence updates × N users could storm; recommend 60s + dedupe |
| 19 | P3 | 6 | storage | Signed-URL TTL 1h too long for G702/MTR — recommend 5m |
| 20 | P3 | 7 | edge runtime | Use `Deno.serve` instead of legacy `std/http/server.ts` |

### Critical gaps (must close before Phase 0 starts)

- **Worker view's data model is broken.** Without `parts.assigned_user_id`, there is no "my queue" — the entire mobile UX collapses to "all parts in org". Fix #1 first.
- **Auto-NCR trigger will crash on first failed inspection.** Fix #2 alongside #1.
- **11 atomic-counter races** silently lose business IDs under concurrent load. Fix #4 with one shared helper; touches every CRUD endpoint.

### What this review did NOT cover

- **Design (UI/UX) review** — skipped because demo HTML is the spec; run `/plan-design-review` if you want a separate UI audit (icon contrast, focus states, mobile breakpoints, etc.).
- **CEO (strategy) review** — accepted persona-spec premises (steel fab, 7 roles, v5 cut). Run `/plan-ceo-review` to challenge the V5/V6 split or compete-vs-build matrix.
- **Security audit** — flagged surface-level (RLS, JWT, XSS) only. Run `/cso` for adversarial fuzzing of the in-memory JWT scheme, refresh-token rotation, file-attachment SSRF, etc.
- **Code review** — there is no implementation code yet (UI mock only). Re-run `/plan-eng-review` after Phase 0 lands actual Edge Functions.

### Artifacts written

- Test plan: `~/.gstack/projects/puneetbagewadi-fab-simple/main-test-plan-20260523-135347.md`
- Tasks JSONL: `~/.gstack/projects/puneetbagewadi-fab-simple/tasks-eng-review-20260523-135347.jsonl` (21 tasks, P1/P2/P3)

### Recommended next step

1. Land **E1–E5 + E13 + E16** (the 7 P1 tasks) — ~3.5h human / ~35min CC — before opening Phase 0.
2. Then `/cso` for the security pass.
3. Then begin Phase 0 (schema + RLS + 5 critical Edge Functions).

---

