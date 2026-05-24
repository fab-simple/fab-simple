# FABSIMPLE — Backend Services Application Requirement
**Version 5.1 · May 2026 · Confidential**
**Source:** Authoritative product spec provided by Vinay (NOVUSsteel Engineering)
**Saved:** 2026-05-23 — pasted verbatim from user session.

> This is the **production status document** describing what has been built across 30+ sessions, NOT a forward plan. It supersedes the planning fiction in `docs/backend-requirements.md` for any field where the two disagree. Treat this file as read-only / reference.

---

# 1. Executive Summary

FabSimple is a cloud-native, multi-tenant SaaS platform purpose-built for structural steel fabrication shops in the United States. It replaces the Excel spreadsheets, paper binders, and shop-floor whiteboards that most small-to-mid-size fabricators (10–100 employees) rely on today with a single, mobile-responsive web application covering every operational workflow from estimating through shipping.

The platform was conceived and built by Vinay at NOVUSsteel Engineering, leveraging deep domain expertise in steel detailing and fabrication project management. Development has progressed through multiple iterations across 30+ collaborative sessions, producing a production-grade backend (database + API) and a comprehensive frontend.

## 1.1 Product Identity

- **Product Name:** FabSimple
- **Tagline:** Steel Fabrication Made Simple
- **Parent Company:** NOVUSsteel Engineering
- **Founder / Contact:** Vinay — vinay@novusteelengg.com — +91-9742975323
- **Target Market:** US structural steel fabricators (10–100 employees, 50–500 tons/month)
- **Addressable Market:** ~4,100 structural shops (1,600+ AISC-certified + ~2,500 non-certified)
- **Pricing:** Starter $199/mo (10 users) | Professional $499/mo (25 users) | Enterprise $999+/mo (unlimited)
- **Tech Stack:** Supabase (PostgreSQL + Auth + Realtime) + Deno Edge Functions + HTML/React frontend

## 1.2 Competitive Positioning

FabSimple occupies the gap between expensive enterprise systems (Tekla PowerFab at $15K–30K+, STRUMIS at $10K+) and generic tools (Excel, paper). Unlike EZIIL which covers operations but lacks AISC/AWS compliance depth, FabSimple provides audit-ready QC documentation (AISC 303, AWS D1.1, SSPC paint DFT tracking) at a fraction of the cost. It is the first cloud-native, mobile-first platform specifically designed for structural steel fabrication.

---

# 2. Development Timeline & Session History

| Phase | Session / Milestone | Key Deliverables |
|---|---|---|
| Phase 1 | FabSimple v4 — Initial HTML Prototype | Complete HTML webapp with 25+ modules, demo mode, mobile-responsive design, DM Sans/DM Mono typography, navy (#1A3A5C) brand color, 4-square logo |
| Phase 2 | Supabase Schema Design (SQL) | Complete PostgreSQL schema matched 1:1 to every HTML modal and form field. Initial version: 26 tables with RLS policies |
| Phase 3 | FabSimple v5 — Production Backend | Expanded to 37 tables, 1,173 lines of SQL. 17 functions, auto-calculation triggers (paint DFT, bid totals, job costs), multi-tenant isolation via `company_id` |
| Phase 4 | API Layer (Deno Edge Function) | 1,081 lines, 18 route handlers. JWT auth, role-based permissions, input sanitization, XSS prevention, audit logging, activity feed, rate limiting (120 req/min) |
| Phase 5 | Security Hardening & RLS Audit | 1,598-line hardened RLS patch. 149 policies across 38 tables, FORCE ROW LEVEL SECURITY, per-operation role gating, custom JWT claims hook, sequence-based ID generation |
| Phase 6 | API Security Refactoring | 17-file refactored API (2,151 lines). Service role eliminated from user queries, user-scoped Supabase client from JWT, Upstash Redis rate limiting, Zod schema validation |
| Phase 7 | Production HTML Build | 117-item build specification. Complete frontend with all modals persisting to API, forgot password flow, CSP meta tag, session timeout, XSS-safe DOM building |
| Phase 8 | AI Features Integration | FabSimple AI Copilot (powered by Claude) — fabrication-aware chatbot for production status, bottleneck analysis, QC compliance, schedule forecasting, bid estimation |
| Phase 9 | Mobile App (KMP + React Native) | Kotlin Multiplatform project (39 files, Clean Architecture, MVVM). Expo/React Native project with EAS Build profiles for Android AAB + iOS IPA |
| Phase 10 | React Migration | Vite + React + TypeScript project. Feature-based folder structure, Zustand state management, Supabase service layer, role-based routing |
| Phase 11 | Sales & Business Strategy | Sales deck (PDF/DOCX), pricing strategy, competitive analysis vs PowerFab/STRUMIS/EZIIL/FabSuite, financial projections, deployment rollout plan |

---

# 3. Database Architecture

The FabSimple database is a PostgreSQL instance hosted on Supabase with **37 production tables, 17 functions, and 149 RLS policies**. Every table uses `company_id` for multi-tenant isolation.

## 3.1 Complete Table Inventory (37 Tables)

### Core / Identity

- **companies** — Multi-tenant root. `name, aisc_cert, plan (starter/professional/enterprise), max_parts, max_projects, active`
- **users** — All platform users. `auth_id (FK to Supabase Auth), company_id, role (owner/pm/estimator/foreman/qc/accounting/worker), full_name, email, is_active, last_login`
- **subscriptions** — Billing/plan tracking. `company_id, plan, status, current_period_start/end, max_users, max_projects`

### Project Management

- **projects** — Job tracking. `name, number, gc_name, contract_value, est_tonnage, status, pm_id, start_date, deadline, is_archived`
- **parts** — Individual steel pieces. `part_mark, assembly_mark, profile, grade, length, weight, quantity, status (not_started/in_progress/complete/shipped), phase, heat_number`
- **assemblies** — Groups of parts. `assembly_mark, description, total_weight, total_parts, completed_parts`
- **drawings** — Shop/erection drawings. `drawing_number, revision, title, type (shop/erection/connection), status (in_progress/submitted/approved/released), current_revision flag`
- **change_orders** — Contract modifications. `co_number, description, amount, status (pending/approved/rejected), submitted_by, approved_by`
- **rfis** — Requests for Information. `rfi_number, question, answer, status, submitted_by, responded_by`

### Quality Control & Compliance

- **weld_inspections** — AWS D1.1 weld log. `joint_type, weld_process, filler_metal, inspection_method, cwi_reference, result (pass/fail/hold), inspector_id`
- **paint_inspections** — SSPC coating log. `surface_prep, primer_dft, topcoat_dft, total_dft (auto-calculated trigger), required_min, result (auto pass/fail), inspector_id`
- **aisc_checklist** — AISC 303-10 compliance. `section_ref, item_text, category, status (open/done/hold/na), project_id`. 24 standard items seeded per project
- **ncr_reports** — Non-Conformance Reports. `ncr_number (auto: NCR-0001+), description, root_cause, corrective_action, status (open/in_progress/re_inspected/closed), assigned_to, blocks_shipping flag`
- **heat_numbers** — MTR traceability. `heat_number, material_grade, mill_name, mtr_status (pending/received/verified)`, linked to parts via `part_id`
- **certifications** — Personnel/equipment cert tracker. `cert_type, holder_name, cert_number, issue_date, expiry_date, status`. Auto-alert at 30 days before expiry
- **osha_checklists** — OSHA 29 CFR safety checklists. Persistent per company, not per project

### Production & Shop Floor

- **daily_production_log** — Shift logs. `date, shift, station, parts_completed, hours_worked, notes`. Auto-populated stats from part status changes
- **cut_plans** — Cut list optimizer output. `profile, stock_length, kerf, min_remnant, cuts (JSONB array), waste_percentage, total_bars`
- **erection_sequence** — Field install priority ordering. `sequence_number, part_id, load_number, priority`
- **shipping_tickets** — Load manifests. `ticket_number, truck_number, carrier, ship_date, destination, parts (JSONB), total_weight, status`

### Financial & Estimating

- **estimates** — Bid tracking. `estimate_number, project_name, gc_name, status (draft/submitted/won/lost), total_amount, bid_per_lb, bid_per_ton, scenarios (JSONB for multiple bid options)`
- **estimate_line_items** — Detailed bid breakdown. `category (structural/misc/shop_labor/field_labor/detailing/freight/coating), description, quantity, unit_cost, total`
- **billing_applications** — AIA G702/G703 pay apps. `application_number, period_to, original_contract, change_orders_total, completed_to_date, retainage_percent, amount_due`
- **job_costs** — Budget vs actual tracking. `cost_code, budget_amount, actual_amount, committed, variance (auto-calculated)`
- **purchase_orders** — Material purchasing. `po_number, vendor, items (JSONB), total_amount, status (draft/issued/partial/received/closed)`

### Inventory & Materials

- **inventory** — Stock tracking. `profile, grade, length, quantity, location, reorder_point, status (ok/low/out)`. Auto-alert when qty ≤ reorder_point
- **inventory_adjustments** — Full audit trail. `adjustment_type (received/consumed/manual/damaged), quantity_change, reason, adjusted_by`

### System & Platform

- **notifications** — In-app alerts. `type (cert_expiry/inventory_low/qc_failure/ncr_created/co_approved), title, message, is_read, user_id`
- **activity_feed** — Real-time event stream. `action, entity_type, entity_id, metadata (JSONB), user_id, created_at`
- **audit_log** — Immutable security log. `action, table_name, record_id, old_values, new_values, user_id, ip_address`
- **security_audit_log** — Service-role only. Failed logins, permission denials, rate limit hits. No user-facing RLS policies
- **sequence_counters** — Thread-safe sequential IDs. `table_name, prefix (NCR/PI/WLD/L), current_value`. RPC-only access via `next_sequence_number()`
- **gc_contacts** — General contractor directory. `gc_company, contact_name, email, phone`, linked to projects
- **ai_insights** — AI Copilot analysis results. `insight_type (bottleneck/reorder/schedule/cost), priority, title, description, suggested_action, is_resolved`
- **ai_chat_history** — AI conversation persistence. `user_id, role, message, metadata (JSONB)`

---

# 4. API Architecture

The API is a Deno-based Supabase Edge Function (deployed via `supabase functions deploy api`). After the security refactoring, the API consists of **17 files totaling 2,151 lines** across a modular architecture.

## 4.1 API File Structure

| File | Purpose |
|---|---|
| `main.ts` | Request router, CORS, error handling |
| `middleware/auth.ts` | JWT validation, user-scoped Supabase client |
| `middleware/rateLimit.ts` | Upstash Redis distributed rate limiting (120/min) |
| `schemas/validation.ts` | Zod schemas for every table's insert/update |
| `controllers/crud.ts` | GET/POST/PATCH/DELETE for all 35 data tables |
| `controllers/dashboard.ts` | Owner dashboard: Financial KPIs, PM workload, schedule health |
| `controllers/import.ts` | Tekla/SDS2 CSV parser with unit auto-detection |
| `controllers/cutOptimizer.ts` | 1D bin packing (first-fit-decreasing) with kerf |
| `controllers/admin.ts` | User invite, project archive, notification mark-all |
| `services/audit.ts` | Immutable audit trail for all mutations |
| `lib/supabase.ts` | User-scoped + service-role Supabase clients |
| `lib/permissions.ts` | Role-to-table permission matrix (7 roles) |
| `lib/response.ts` | Standardized JSON responses with CORS |
| `lib/sanitize.ts` | Input sanitization for all string fields |
| `lib/types.ts` | Request context, role enum, table config |
| `migrations/001_rls.sql` | 149 policies across 38 tables |

## 4.2 API Endpoints (18 Routes)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/{table}` | List records with pagination, filtering, sorting. RLS enforced |
| POST | `/{table}` | Create record. Zod validation, `company_id` auto-injected |
| PATCH | `/{table}/{id}` | Update record. Partial updates only |
| DELETE | `/{table}/{id}` | Soft/hard delete based on table config |
| GET | `/dashboard` | Owner dashboard: backlog, billed, collected, retainage, PM workload, alerts |
| POST | `/import/csv` | Tekla/SDS2 CSV import. Auto-detects 9 column name variations, metric/imperial |
| POST | `/cut-optimize` | 1D cut list optimizer. FFD bin packing with kerf allowance, waste % calculation |
| POST | `/seed-aisc` | Seed 24 AISC 303 checklist items for a new project (7 categories) |
| POST | `/invite-user` | Send invite via Supabase Auth email. Enforces subscription user limits |
| GET | `/qc-report` | Export QC data for PDF generation (welds, paint, NCRs, checklists) |
| POST | `/convert-estimate` | Convert won estimate to active project with linked data |
| POST | `/archive-project/{id}` | Archive/restore project. Cascades to related records |
| POST | `/notifications/mark-all-read` | Mark all user notifications as read |

## 4.3 Request Pipeline (Every Request)

1. CORS preflight handling
2. Rate limiting (120 requests/minute per IP via Upstash Redis, in-memory fallback)
3. JWT extraction and validation from `Authorization: Bearer` header
4. User lookup from `auth.uid()` to get `company_id, role, user_id`
5. User-scoped Supabase client creation (RLS enforced on every query)
6. Route matching and role permission check against RBAC matrix
7. Input sanitization (XSS prevention on all string fields)
8. Zod schema validation for POST/PATCH payloads
9. Business logic execution with `company_id` auto-injection
10. Audit log entry written (action, table, record_id, old/new values)
11. Activity feed entry created for user-facing event stream
12. Standardized JSON response with appropriate HTTP status

---

# 5. Security Architecture

Security was built in five layers, each independently audited and hardened:

## 5.1 Layer 1 — Row Level Security (Database)

- 149 RLS policies across 38 tables
- `FORCE ROW LEVEL SECURITY` on every table (table owners cannot bypass)
- Per-operation policies: separate SELECT, INSERT, UPDATE, DELETE for each table
- Role-based gating: 7 roles with granular permissions per table per operation
- `company_id` isolation: `get_user_company_id()` helper function resolves tenant from `auth.uid()`
- No JWT claim trust for security: RLS looks up `company_id` from the `users` table, not JWT custom claims

## 5.2 Layer 2 — API Authentication

- JWT validation on every request (Supabase Auth)
- User-scoped Supabase client: every database query runs as the authenticated user, not service role
- Service role restricted to 5 specific operations: audit log writes, user invites, sequential ID generation, last_login updates, PM name resolution

## 5.3 Layer 3 — Input Validation & Sanitization

- Zod schema validation for every table's insert/update payload
- XSS prevention: all string inputs sanitized before storage
- CSP meta tag in frontend HTML
- No `innerHTML` with user-supplied data (DOM built via `createElement`)

## 5.4 Layer 4 — Rate Limiting & Abuse Prevention

- 120 requests/minute per IP (Upstash Redis distributed, in-memory fallback)
- Login attempt tracking: 5 failed attempts triggers lockout
- 20-minute session timeout with auto-logout

## 5.5 Layer 5 — Audit & Monitoring

- Immutable `audit_log` table: every INSERT, UPDATE, DELETE recorded with old/new values
- `security_audit_log`: service-role only, captures failed logins, permission denials, rate limit hits
- `activity_feed`: user-facing event stream for real-time collaboration awareness
- No user-facing RLS on `security_audit_log` (only service role can read/write)

---

# 6. Role-Based Access Control (RBAC)

FabSimple implements 7 roles with granular permissions. Access is enforced at three levels: database (RLS), API (middleware), and frontend (navigation guards).

| Role | Access Scope | Key Restrictions |
|---|---|---|
| **owner** | Full CRUD on all tables within company. Users & Roles page, invite/deactivate users, owner dashboard with financial KPIs | Only role that can invite users, view subscription, see all financial data |
| **pm** | Full CRUD on projects, parts, drawings, shipping, billing, change orders, RFIs. View inventory | Cannot invite users. Cannot see other PM's job costs unless owner |
| **estimator** | Full CRUD on estimates and estimate_line_items. Read-only on projects, parts, inventory (needed for bid pricing) | Cannot see job costs or actual margins. Cannot modify projects |
| **foreman** | Full CRUD on parts, assemblies, daily_production_log, cut_plans, inventory. View drawings, shipping | Cannot see financial modules (billing, job costs, estimates). Cannot modify projects |
| **qc** | Full CRUD on weld_inspections, paint_inspections, aisc_checklist, ncr_reports, heat_numbers, certifications. View parts, drawings, shipping | Cannot see financial modules. Full NCR creation (can block shipping) |
| **accounting** | Full CRUD on billing_applications, job_costs, purchase_orders. View-only on change_orders (to bill them), projects, parts | Cannot edit change orders (PM owns). Cannot see shop floor modules |
| **worker** | Read-only on most tables. Can update own part status only (`not_started → in_progress → complete`) | Always lands on `/worker` page. No sidebar. Cannot see any other module. Designed for shop floor tablets with QR scanning |

---

# 7. Frontend Modules (25+ Pages)

## 7.1 Authentication

- Login form: email + password, Supabase Auth `signInWithPassword`
- Forgot password flow: sends reset email via Supabase Auth
- Password visibility toggle on login and reset forms
- Session timeout: 20-minute inactivity auto-logout
- Role-based redirect after login (`worker → /worker`, others → `/dashboard`)
- Branding: "Powered by NOVUSsteel Engineering" in auth footer and sidebar footer

## 7.2 Dashboard

- Owner view: financial KPIs (backlog, total billed, collected, retainage held), PM workload matrix, schedule health indicators, cert expiry alerts, inventory reorder alerts
- PM view: assigned projects with progress bars, action items, upcoming deadlines
- Real-time activity feed (Supabase Realtime subscription)
- API: `GET /dashboard`

## 7.3 Projects

- Project list with status filters (active/on_hold/completed/archived)
- New/Edit modal: name, number, GC, contract value, tonnage, PM assignment, start/deadline, status
- PM assignment dropdown (populated from users where role = pm)
- Archive/restore functionality
- API: `GET/POST/PATCH/DELETE /projects`, `POST /archive-project/{id}`

## 7.4 Parts List

- Master parts table with search, filter by project/status/profile
- QR code generation per part (for shop floor scanning)
- Status cycling: `not_started → in_progress → complete → shipped`
- Tekla CSV import (`POST /import/csv`)
- Assembly grouping view
- API: `GET/POST/PATCH/DELETE /parts`

## 7.5 Drawing Log

- Grouped by project with current-revision-only toggle
- Revision history per drawing
- Status workflow: `in_progress → submitted → approved → released`
- Superseded alert blocks new part creation against old revision
- API: `GET/POST/PATCH/DELETE /drawings`

## 7.6 Estimating

- Estimate list with status tracking (draft/submitted/won/lost)
- Detailed line items: structural, misc steel, shop labor, field labor, detailing, freight, coating
- Auto-calculated $/lb and $/ton sanity checks
- Multiple bid scenarios per estimate (JSONB storage)
- Convert to Project (`POST /convert-estimate`)
- API: `GET/POST/PATCH/DELETE /estimates`, `/estimate_line_items`

## 7.7 Quality Control Suite

- **AISC 303 Checklist**: 24 standard items seeded per project (`POST /seed-aisc`), 7 categories, section references, status toggle (done/hold/open/na)
- **AWS D1.1 Weld Log**: joint type, weld process, filler metal, inspection method, CWI reference, result, inspector
- **Paint/Coating DFT Log**: surface prep, primer DFT, topcoat DFT, auto-calculated total DFT, auto pass/fail against project spec
- **NCR Reports**: auto-numbered (NCR-0001+), root cause, corrective action, status workflow (`open → in_progress → re_inspected → closed`), `blocks_shipping` flag
- **Heat Number Traceability**: linked to parts and MTRs, quarantine workflow
- **Certification Tracker**: CWI, equipment, company certs with 30-day expiry alerts
- **OSHA 29 CFR Checklist**: persistent per company, not per project
- **QC Report Export** (`GET /qc-report`)

## 7.8 Production & Shop Floor

- **Daily Production Log**: shift logs with auto-populated stats from part status changes
- **Cut List Optimizer**: 1D FFD bin packing with kerf allowance, min remnant, waste % (`POST /cut-optimize`)
- **Worker View**: glove-sized buttons, QR scanner, simplified status update interface
- **Erection Sequence**: field install priority ordering
- **Live Activity Feed**: real-time updates via Supabase Realtime

## 7.9 Financial Modules

- **AIA G702/G703 Billing**: application number, period, contract values, completed-to-date, retainage, amount due
- **Job Costing**: budget vs actual tracking with auto-calculated variance
- **Purchase Orders**: vendor, items, total, status workflow
- **Change Order tracking** with auto-impact on contract value

## 7.10 Inventory & Shipping

- **Inventory**: stock levels with OK/LOW/OUT status indicators, reorder point alerts
- Manual adjustments with full audit trail (received/consumed/manual/damaged)
- **Shipping Tickets**: load manifests with part selection, truck/carrier info, total weight

## 7.11 Administration

- **Users & Roles**: invite new users (`POST /invite-user`), deactivate, role assignment
- 7-role dropdown in invite modal
- Subscription management and user limit enforcement
- Notification center with mark-all-read
- Pricing page (Starter $199 / Professional $499 / Enterprise $999+)

---

# 8. AI Features (FabSimple AI Copilot)

The AI Copilot is powered by Claude and provides fabrication-aware intelligence across the platform:

- **Production Status**: real-time summary of all active projects, completion percentages, station throughput
- **Bottleneck Analysis**: identifies constraints across the shop (slow stations, material shortages, inspection backlogs)
- **QC Compliance**: flags expiring certifications, open NCRs blocking shipping, incomplete AISC checklists
- **Schedule Forecasting**: predicts project completion dates based on current production velocity
- **Bid Estimation**: suggests pricing based on historical data ($/lb trends, material costs, labor rates)
- **Inventory Alerts**: proactive reorder suggestions based on consumption patterns

## 8.1 AI Database Tables

- `ai_insights`: stores analysis results with priority, suggested actions, resolution tracking
- `ai_chat_history`: persistent conversation history per user for context continuity

---

# 9. Deployment Architecture

## 9.1 Infrastructure

- **Database:** Supabase (PostgreSQL) — managed, auto-scaling, built-in Auth + Realtime
- **API:** Supabase Edge Functions (Deno) — serverless, auto-scaling, global edge deployment
- **Frontend (Web):** Static HTML/JS hosted on Netlify/Vercel — CDN-distributed
- **Frontend (Mobile):** React Native (Expo) with EAS Build — Android APK/AAB + iOS IPA
- **Rate Limiting:** Upstash Redis (serverless) — distributed, no cold starts

## 9.2 Deployment Steps

1. Create Supabase project → save URL, anon key, service role key
2. Run `FabSimple-v5-FINAL-Schema.sql` in SQL Editor (37 tables created)
3. Run hardened RLS patch (149 policies applied)
4. Configure Auth hook: `custom_access_token_hook` for JWT custom claims
5. Deploy Edge Function: `supabase functions deploy api --no-verify-jwt`
6. Set environment secrets: `SUPABASE_ANON_KEY`, `CORS_ORIGIN`, `UPSTASH_REDIS_REST_URL/TOKEN`
7. Deploy frontend HTML to Netlify/Vercel
8. Run verification queries (8 checks in the RLS patch)

## 9.3 Production Readiness Checklist

- [x] CORS_ORIGIN set to exact frontend domain (never wildcard in production)
- [x] Upstash Redis configured for distributed rate limiting
- [x] Service role key never exposed to frontend
- [x] CSP meta tag present in HTML
- [x] Session timeout active (20 minutes)
- [x] All 37 tables have RLS enabled and forced
- [x] Auth hook configured for custom JWT claims
- [x] Audit log capturing all mutations
- [x] Security audit log capturing failed logins and permission denials

---

# 10. Evolution Path & Scaling Strategy

## 10.1 Frontend Scaling

- **Stage 1 (now → 20 clients):** Single HTML file (~5,500 lines). One developer can manage it
- **Stage 2 (20–50 clients):** Split HTML into per-module files sharing common CSS and API client
- **Stage 3 (50–100+ clients):** Migrate to React (Vite + TypeScript). Feature-based folder structure. API calls remain identical
- React project already scaffolded: Vite + React + TypeScript + Zustand + Supabase service layer

## 10.2 Mobile Strategy

- Kotlin Multiplatform (KMP) project with 39 files, Clean Architecture, MVVM
- Expo/React Native project with EAS Build profiles
- Development APK for testing, Preview APK for internal distribution, Production AAB/IPA for stores
- OTA updates via EAS Update for JS-only changes

## 10.3 Feature Roadmap

- **Phase 1 (now):** Parts, QR scanning, drawing log, AISC compliance, weld/paint logs
- **Phase 2:** Estimating, G702 billing, job costing, change orders
- **Phase 3:** Cross-project analytics, historical trending ($/lb across jobs, estimator accuracy, welder rework rates)
- **Phase 4:** Offline mode (IndexedDB queue for shop floor tablets with weak WiFi)
- **Phase 5:** Tekla Direct API integration (replace CSV import with real-time sync)
- **Phase 6:** QuickBooks / Procore integrations for enterprise tier

## 10.4 Known Issues & Planned Fixes

- **Supabase cold starts:** 3–4 second load times at 8am when all users login simultaneously. Plan: connection pooling optimization, query indexing review
- **Offline mode:** paint booth WiFi dead zones cause lost entries. Plan: ServiceWorker + IndexedDB sync queue
- **Cross-project analytics:** data exists but no dashboard for it yet. Plan: analytics module for Phase 3
- **Report generator:** no PDF export from within the app. Plan: server-side PDF generation using QC report data endpoint
- **Sequential ID race condition:** current count-based approach (NCR-0001) has concurrency issues. Fix: PostgreSQL sequence via `next_sequence_number()` RPC (already in hardened patch)

---

# 11. Complete Deliverables Inventory

| File | Lines | Description |
|---|---:|---|
| `FabSimple-v5-FINAL-Schema.sql` | 1,173 | Complete database: 37 tables, functions, triggers, indexes |
| `fabsimple-rls-hardened.sql` | 1,598 | Hardened RLS: 149 policies, FORCE RLS, role-based per-operation |
| `FabSimple-v5-FINAL-API.ts` (original) | 1,081 | Monolithic API: 18 endpoints in single file |
| `fabsimple-api/` (refactored) | 2,151 | 17-file modular API with user-scoped clients |
| `FabSimple-v5-HTML-Build-Spec.md` | ~600 | 117-item specification for production frontend |
| `FabSimple-v5-Secure-Production.html` | ~2,700 | Production HTML frontend (base version) |
| `FabSimple-v6-Production.html` | ~3,800 | Enhanced HTML with AI features |
| `FabSimple-v6-Mobile.jsx` | ~980 | React artifact (mobile-first SaaS design) |
| `fabsimple-react/` (Vite project) | ~2,500 | Full React + TypeScript + Zustand project |
| `fabsimple-kmp/` (Kotlin) | ~3,000 | KMP project: 39 files, Clean Architecture |
| `fabsimple-expo/` (React Native) | ~1,800 | Expo project with EAS Build profiles |
| `FabSimple-Sales-Deck.pdf/docx` | N/A | Sales deck with NOVUSsteel branding |
| `DEPLOYMENT_GUIDE.md` | ~200 | Step-by-step deployment instructions |
| `SECURITY_NOTES.md` | ~150 | Security architecture documentation |

---

**END OF DOCUMENT**
© 2026 FabSimple · A Product of NOVUSsteel Engineering · Confidential
