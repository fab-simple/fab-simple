# FabSimple — Procurement & Material Traceability Module

**Development-ready specification**
**Status:** Draft v2 — key decisions confirmed by owner (see §13), ready for implementation
**Author:** Drafted by Claude Code from `FabSimple Procurement & Material Traceability Module.pdf` (product vision, undated) reconciled against the current codebase (`main`, 2026-07-27)
**Reconciles with:** `docs/backend-requirements.md` (planning doc), `docs/reference/fabsimple-v5.1-product-spec.md` (production status doc), `lib/nav-config.ts`, `supabase/migrations/20260524000001_schema.sql`, `docs/compulsory-project-selection-plan.md`

---

## 0. How to read this document

The source PDF describes a *vision*: a fully connected procurement chain from Material Requirement → RFQ → Vendor Quote → PO → Vendor Confirmation → Shipment → Receiving → Bundle → Heat → Lot → Inventory → Production → Assembly → Shipping → Installation, where every object auto-inherits project context and knows its parent/child/status/next-action.

The current codebase implements **the two ends of that chain** (Purchase Orders and a bulk `inventory` table) but **none of the middle** (no RFQ, no vendor master, no discrete receiving records, no bundles, no heat→lot linkage). It also does not yet apply the Global Project Context to Inventory or Heat Numbers, which the PDF calls out by name.

This document is a gap-driven build spec: what exists today, what's missing, the concrete schema/API/UI to build, phased so the team can ship incrementally instead of a big-bang rewrite. Section 13 lists decisions that need an explicit **owner sign-off** before Phase 1 starts.

---

## 1. Current-state audit

| PDF concept | Repo reality today | Verdict |
|---|---|---|
| Global Project Context (all modules inherit project) | Implemented via `store/projectSlice.ts` + `hooks/useGlobalProject.ts` + `components/layout/ProjectGate.tsx`. `purchase-orders` and `receiving` nav items are already `projectScoped: true`. | ✅ Mostly done — extend to Inventory/Heat Numbers (see §5) |
| Material Requirement (Module 1) | Does not exist. Closest analog: `parts` rows with `status='not_started'`, aggregated ad hoc by `supabase/functions/api/controllers/purchaseOrder.ts` (`create-po-from-not-started-parts`, shipped 2026-07-04). | ❌ Missing as a first-class object |
| RFQ / Vendor Quotes (Modules 2–3) | Does not exist anywhere. No vendor master table at all — `purchase_orders.vendor` is a free-text string. | ❌ Missing entirely |
| Purchase Order (Module 4) | `purchase_orders` table exists: `po_number`, `vendor` (text), `items` (JSONB line items), `status` enum (`draft/issued/partial/received/closed`), `qty_ordered`/`qty_received` aggregates. No `vendor_id`, `rfq_id`, approval gate, or confirmation tracking. | ⚠️ Partial — needs vendor FK + traceability links |
| Vendor Confirmation (Module 5) | Does not exist. | ❌ Missing |
| Shipment Tracking, inbound (Module 6) | Does not exist. **Careful naming collision:** `shipping_tickets` already exists but is **outbound** (shop → jobsite), the opposite direction from the PDF's Module 6/15. | ❌ Missing (and needs a distinct name) |
| Material Receiving (Module 7) | No discrete receiving record. Receiving today = directly mutating `purchase_orders.qty_received`/`status` from `app/(dashboard)/dashboard/receiving/page.tsx`. No per-delivery audit trail, no photos, no exceptions field. | ❌ Missing as a first-class object — this is the single biggest gap |
| Bundle Registration (Module 8) | Does not exist. | ❌ Missing |
| Heat Assignment (Module 9) | `heat_numbers` exists but is **company-level and flat**: `heat_number`, `material_grade`, `mill_name`, `mtr_status`, a free-text `receipt_number`, and an `parts_count` int with no real FK to parts, bundles, or receivings. No bundle→heat→lot chain. | ⚠️ Exists but structurally wrong for traceability |
| MTR Management (Module 10) | `heat_numbers.mtr_file_url` is a single nullable text field. No OCR extraction, no structured yield/tensile/chemistry data, no per-document history. | ❌ Missing structure |
| Inventory as Material+Grade+Heat+Lot (Module 11) | `inventory` table is `profile + grade + length` only — exactly the anti-pattern the PDF calls out ("never only material size"). No heat/lot dimension at all. | ❌ Architecturally contradicts the PDF's core inventory principle |
| Production Allocation (Module 12) | `cut_plans` exists (1D bin-packing optimizer) but has no concept of "recommend best lot" — it operates on `parts` + a raw `stock_length` parameter, not on heat-traceable inventory. | ⚠️ Partial, disconnected from material traceability |
| Saw Integration / QR (Module 13) | QR codes + worker scan flow exist (`app/worker/parts/[id]`, `qr_codes`-style public route). Parts carry a free-text `heat_number` column, not a lot FK. | ⚠️ Infrastructure exists; wiring to lots is missing |
| Assembly / Shipping / Installation (Modules 14–16) | `assemblies`, `shipping_tickets`, `erection_sequence`/`erection_ops` all exist and are reasonably mature. They do not yet roll up heat/MTR traceability summaries. | ⚠️ Extend, don't rebuild |
| Universal Object Pattern (header/status/timeline/attachments/activity/relationships/actions) | `AttachmentsDrawer`, `activity_feed` table, and per-table `DataTable` list views exist. There is **no generic object detail page** anywhere in the app — every module is list + modal, no drill-down detail view with timeline/relationships/suggested actions. | ❌ Missing as a reusable pattern |
| Role-based dashboards (Purchasing Manager / Receiving Clerk / Production Manager tiles) | `controllers/dashboard.ts` exists with owner/PM views; no procurement-specific role tiles (open RFQs, delayed deliveries, missing heat assignments). | ❌ Missing |

**Bottom line:** the PDF is describing a materials-traceability spine that the codebase doesn't have yet. Building it is a real, multi-phase project — not a tweak to the existing PO page.

---

## 2. Scope and phasing

Building all 16 modules simultaneously is not recommended — the receiving→bundle→heat→lot chain is the load-bearing part and should land first, since everything else (production allocation, MTR quarantine, part traceability) depends on it existing.

| Phase | Delivers | Depends on |
|---|---|---|
| **Phase 1 — Traceability spine** | Vendor master, PO↔vendor FK, inbound shipments, **receivings** (discrete, auditable), bundles, heat→lot redesign, MTR documents **with OCR-assisted extraction**, quarantine automation | Nothing — foundational |
| **Phase 2 — Sourcing workflow** | Material Requirements (formal object), RFQ, Vendor Quotes, Award→PO, vendor performance scoring | Phase 1 (PO/vendor tables) |
| **Phase 3 — Production integration** | Lot recommendation endpoint (best lot / closest length / lowest waste), part↔lot FK, saw-scan lot consumption, cut-plan integration | Phase 1 |
| **Phase 4 — UX unification** | Universal Object Pattern component, role-based procurement dashboard tiles, "what happened / what's next" copy pattern | Phases 1–3 (needs real relationships to render) |
| **Phase 5 (explicitly deferred)** | RFQ PDF/email generation & vendor-response tracking automation, Tekla/SDS2/ERP live import (v5 backend-requirements.md already scoped this as CSV-only for now), cut-plan optimizer rewrite | Out of scope here |

This document specs Phase 1 in full implementation detail (schema, API, RBAC, UI) and Phases 2–4 at design-decision depth (enough to start, not full DDL) so the team isn't blocked, but the underlying tables aren't fully bikeshedded before Phase 1 ships and informs them.

---

## 3. Non-goals (explicit)

- No re-platforming. Same stack: Next.js App Router + Supabase Postgres/Auth/Storage/Realtime + Deno Edge Functions, same generic-CRUD-table-registry pattern (`permissions.ts` → `crud.ts` → `hooks/useResource.ts`).
- No replacement of `shipping_tickets` (outbound) — inbound shipping is a **new, separate** table (`inbound_shipments`) to avoid conflating directions.
- No removal of the existing bulk `inventory` table. It stays for non-traceable stock (hardware, consumables). Structural steel requiring heat traceability moves to the new `material_lots` table (see §6.6 for the reasoning and the UI split).
- No change to the existing `create-po-from-not-started-parts` endpoint's contract in Phase 1 — Material Requirements (Phase 2) sits underneath it later without breaking it (§13, decision D1).
- No RFQ email/PDF generation automation in Phase 1 — vendors are awarded and POs issued manually from quote data entered by the user; automated vendor outreach is Phase 5.
- No new user roles. Map PDF personas onto the existing 7 roles (`owner, estimator, pm, foreman, qc, accounting, worker`) — see §9.1.
- MTR OCR extraction (§6.8) is the one AI-assisted feature that **is** in Phase 1 scope, per owner decision in §13 (D5) — called out here since automation is otherwise deferred everywhere else in this list.

---

## 4. Design decisions (with rationale)

These are the architecturally load-bearing calls this spec makes. Flagged again in §13 where they need explicit sign-off.

1. **Receiving becomes append-only.** Today, receiving a delivery directly overwrites `purchase_orders.qty_received`. That destroys history — you can't answer "what arrived on which truck, on which date, with what exceptions." Phase 1 introduces `receivings` as one row per delivery event; `purchase_orders.qty_received` becomes a derived rollup maintained by trigger, matching the codebase's existing philosophy of pushing rollups into triggers (e.g., `inventory.status` is already a generated column, `ncr_reports` auto-creation is already trigger-driven).
2. **Heat/Lot is additive, not a rip-and-replace of `inventory`.** The PDF is right that "material + grade" alone is insufficient for structural steel. But the existing `inventory` table already has adopters (dashboard low-stock alerts, `inventory_adjustments` audit trail) for non-traceable stock. Splitting into two paths (bulk `inventory` vs. traceable `material_lots`) avoids a disruptive migration while still fixing the actual problem (steel needs heat/lot tracking).
3. **`vendors` is a genuinely new master table**, not a text field upgrade. Vendor performance scoring, quote comparison, and the "Award Vendor" action all require a real entity, not a string.
4. **Inbound shipping is a new table, not a repurposed `shipping_tickets`.** Same shape of problem (truck/carrier/status), opposite direction, different consumers (procurement/receiving roles vs. PM/foreman/erection). Reusing the table would require a `direction` discriminator column threaded through every existing shipping query — not worth the coupling.
5. **Material Requirement formalization is Phase 2, not Phase 1.** The existing "create PO from not-started parts" flow (shipped 2026-07-04) already solves the 80% case (parts drive PO). Introducing a real `material_requirements` table is valuable for RFQ/multi-vendor-quote workflows but isn't a blocker for fixing the receiving/heat/lot gap, which is the more urgent structural problem.

---

## 5. Core UX principle — extending Global Project Context

Per the PDF, Procurement, Receiving, and Inventory must inherit project context automatically. Today:

- `purchase-orders` and `receiving` nav items: already `projectScoped: true` in `lib/nav-config.ts` ✅
- `inventory` and `heat-numbers`: currently **company-wide** (not project-scoped) — this is correct for the bulk `inventory` table (shared stock across projects) but wrong for the new traceable objects.

**Change required:**
- New pages (`receivings`, `bundles`, `material-lots`, `vendors`, `inbound-shipments`) → all `projectScoped: true`, gated by `ProjectGate` per `docs/compulsory-project-selection-plan.md`.
- `heat-numbers` page: heat numbers themselves are not strictly project-bound (a mill heat can supply multiple projects), but the **lots** cut from a heat for a given project are. Add project filtering to the Heat Numbers page via its linked lots, without forcing `heat_numbers` itself to carry a mandatory `project_id`.
- `vendors` (new, company-wide master data, like `gc_contacts`) stays **not** project-scoped — a vendor is reused across all projects.
- Every new object's list query defaults to `?project_id=<selectedProjectId>` exactly like `purchase_orders` does today (`app/(dashboard)/dashboard/purchase-orders/page.tsx` already does this pattern via `useResourceList`).

---

## 6. Data model — Phase 1 (full DDL)

New migration file: `supabase/migrations/20260728000001_procurement_traceability.sql`. Follows existing conventions: `company_id` on every tenant table, `gen_random_uuid()` PKs, `fn_set_updated_at()` trigger, indexes on `(company_id, ...)`, sequence numbers via the existing `next_sequence_number()` RPC.

### 6.1 New enums

```sql
create type vendor_status              as enum ('active','inactive','blacklisted');
create type po_confirmation_status     as enum ('pending','confirmed','delayed','rejected');
create type inbound_shipment_status    as enum ('scheduled','shipped','in_transit','arrived','received');
create type lot_status                 as enum ('available','reserved','released','consumed','scrapped');
create type heat_availability_status   as enum ('available','quarantine');
create type mtr_ocr_status             as enum ('pending','extracted','manual_review','verified');
```

*(`mtr_status` already exists — `pending/received/verified` — and is reused on `heat_numbers` unchanged. `heat_availability_status` is a new, separate column: `mtr_status` tracks the *document*, `heat_availability_status` tracks whether the *material* is releasable to fabrication.)*

### 6.2 `vendors`

```sql
create table vendors (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  name                text not null,
  contact_name        text,
  email               text,
  phone               text,
  address             text,
  payment_terms       text,
  status              vendor_status not null default 'active',
  preferred           boolean not null default false,
  notes               text,
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index vendors_company_name_idx on vendors(company_id, name);
create index vendors_company_idx on vendors(company_id);

create trigger set_updated_at before update on vendors
  for each row execute function fn_set_updated_at();
```

Vendor performance is a **read-only computed view**, not a stored column (avoids write-path complexity in Phase 1):

```sql
create view vendor_performance as
select
  v.id as vendor_id,
  v.company_id,
  count(r.id) as receivings_count,
  avg(case when po.expected_date is not null and r.received_date <= po.expected_date then 1 else 0 end)::numeric(5,2) as on_time_pct,
  count(*) filter (where r.qty_over_delivered > 0 or r.qty_backordered > 0) as exception_count
from vendors v
left join purchase_orders po on po.vendor_id = v.id
left join receivings r on r.po_id = po.id
group by v.id, v.company_id;
```

### 6.3 `purchase_orders` — alterations

```sql
alter table purchase_orders
  add column vendor_id           uuid references vendors(id) on delete set null,
  add column confirmation_status po_confirmation_status not null default 'pending',
  add column confirmed_qty       numeric(10,2),
  add column confirmed_date      date,
  add column mill_name           text,
  add column rolling_schedule    text;

create index po_vendor_idx on purchase_orders(vendor_id);
```

`purchase_orders.vendor` (free text) is **kept**, not dropped — it becomes a denormalized display cache populated from `vendors.name` on insert/update (mirrors the existing `activity_feed.user_name` denormalization pattern already used in this codebase). This means existing POs entered before a vendor master existed keep working; new POs get a real FK once the vendor picker ships in the UI. Backfill job (§10) matches existing `purchase_orders.vendor` strings to `vendors.name` where possible and flags the rest for manual reconciliation.

`rfq_id` / `vendor_quote_id` FKs on `purchase_orders` are added in **Phase 2** alongside the tables they reference — not added speculatively now.

### 6.4 `inbound_shipments` (Module 6 — vendor → shop; distinct from `shipping_tickets`)

```sql
create table inbound_shipments (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  po_id               uuid not null references purchase_orders(id) on delete cascade,
  shipment_number     text not null,
  truck_number        text,
  carrier             text,
  bill_of_lading      text,
  status              inbound_shipment_status not null default 'scheduled',
  scheduled_date      date,
  shipped_date        date,
  arrived_date        date,
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index inbound_shipments_company_num_idx on inbound_shipments(company_id, shipment_number);
create index inbound_shipments_po_idx on inbound_shipments(po_id);
create index inbound_shipments_status_idx on inbound_shipments(company_id, status);

create trigger set_updated_at before update on inbound_shipments
  for each row execute function fn_set_updated_at();
```

Packing list / BOL scans attach via the existing polymorphic `file_attachments` table (`entity_type='inbound_shipments'`) — no new storage bucket needed, reuse `mtrs` bucket policy shape or add a `shipping-docs` bucket if the team wants stricter separation (recommend reusing `mtrs` bucket with a path prefix, since both are receiving-adjacent documents and the bucket is already RLS-scoped by `company_id`).

### 6.5 `receivings` (Module 7 — the core gap fix)

```sql
create table receivings (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  project_id            uuid not null references projects(id) on delete cascade,
  po_id                 uuid not null references purchase_orders(id) on delete cascade,
  inbound_shipment_id   uuid references inbound_shipments(id) on delete set null,
  vendor_id             uuid references vendors(id) on delete set null,
  receiving_number      text not null,
  received_date         date not null default current_date,
  received_by           uuid references users(id) on delete set null,
  qty_received          numeric(10,2) not null,
  qty_remaining_on_po   numeric(10,2),
  qty_backordered       numeric(10,2) not null default 0,
  qty_over_delivered    numeric(10,2) not null default 0,
  exceptions            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index receivings_company_num_idx on receivings(company_id, receiving_number);
create index receivings_po_idx on receivings(po_id);
create index receivings_project_idx on receivings(project_id);

create trigger set_updated_at before update on receivings
  for each row execute function fn_set_updated_at();
```

`project_id` is **denormalized from the PO** at insert time (via trigger, not client-supplied) so receivings can be filtered by the Global Project Context without a join on every list query — matches the existing denormalization style (`activity_feed.entity_label`, `daily_production_log` fields).

**Rollup trigger** (replaces today's client-side `PATCH purchase_orders {qty_received, status}` in `app/(dashboard)/dashboard/receiving/page.tsx`):

```sql
create or replace function fn_recompute_po_receiving() returns trigger as $$
declare
  v_po purchase_orders%rowtype;
  v_total_received numeric;
begin
  select * into v_po from purchase_orders where id = coalesce(new.po_id, old.po_id);
  select coalesce(sum(qty_received), 0) into v_total_received
    from receivings where po_id = v_po.id;

  update purchase_orders set
    qty_received = v_total_received,
    status = case
      when v_po.qty_ordered is not null and v_total_received >= v_po.qty_ordered then 'received'
      when v_total_received > 0 then 'partial'
      else status
    end,
    received_date = case
      when v_po.qty_ordered is not null and v_total_received >= v_po.qty_ordered then current_date
      else received_date
    end
  where id = v_po.id;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger recompute_po_on_receiving
  after insert or update or delete on receivings
  for each row execute function fn_recompute_po_receiving();
```

Photos attach via `file_attachments` (`entity_type='receivings'`), matching the existing `AttachmentsDrawer` component already wired to the `receiving` page today.

### 6.6 `bundles` (Module 8)

```sql
create table bundles (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  receiving_id    uuid not null references receivings(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  bundle_number   text not null,
  quantity        numeric(10,2) not null,
  storage_location text,
  heat_number_id  uuid references heat_numbers(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index bundles_company_num_idx on bundles(company_id, bundle_number);
create index bundles_receiving_idx on bundles(receiving_id);
create index bundles_heat_idx on bundles(heat_number_id) where heat_number_id is not null;

create trigger set_updated_at before update on bundles
  for each row execute function fn_set_updated_at();
```

### 6.7 `heat_numbers` — alterations + `material_lots` (Modules 9 & 11)

```sql
alter table heat_numbers
  add column status heat_availability_status not null default 'available';
```

```sql
create table material_lots (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  project_id          uuid references projects(id) on delete set null,
  bundle_id           uuid references bundles(id) on delete set null,
  heat_number_id      uuid not null references heat_numbers(id) on delete restrict,
  lot_number          text not null,
  profile             text not null,
  grade               text not null,
  quantity            numeric(10,3) not null,
  original_quantity   numeric(10,3) not null,
  length              numeric(10,3),
  location            text,
  status              lot_status not null default 'available',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index lots_company_num_idx on material_lots(company_id, lot_number);
create index lots_status_idx on material_lots(company_id, status);
create index lots_profile_grade_idx on material_lots(company_id, profile, grade);
create index lots_bundle_idx on material_lots(bundle_id) where bundle_id is not null;

create trigger set_updated_at before update on material_lots
  for each row execute function fn_set_updated_at();
```

Why `material_lots` is a new table rather than repurposing `inventory` (Design Decision 2, §4): `inventory.status` is a **generated column** (`case when quantity <= 0 then 'out' ...`) computed purely from quantity vs. reorder point — it has no room for heat/lot semantics without breaking that generated-column contract, and every existing consumer (`inventory_adjustments`, dashboard low-stock widgets) assumes the flat shape. `material_lots` is additive; the Inventory page (§8) gets a second tab, not a rewrite.

**Heat assignment RPC** (Module 9's "Bundle → Heat → Lot" action), mirroring the existing `next_sequence_number()` RPC style:

```sql
create or replace function fn_assign_heat_to_bundle(
  p_bundle_id      uuid,
  p_heat_number_id uuid,
  p_project_id     uuid,
  p_length         numeric default null,
  p_location       text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_bundle bundles%rowtype;
  v_company_id uuid;
  v_lot_number text;
  v_lot_id uuid;
begin
  select * into v_bundle from bundles where id = p_bundle_id;
  v_company_id := v_bundle.company_id;

  update bundles set heat_number_id = p_heat_number_id where id = p_bundle_id;

  v_lot_number := next_sequence_number(v_company_id, 'material_lots', 'LOT', 4);

  insert into material_lots (
    company_id, project_id, bundle_id, heat_number_id, lot_number,
    profile, grade, quantity, original_quantity, length, location, status
  )
  select
    v_company_id, p_project_id, p_bundle_id, p_heat_number_id, v_lot_number,
    po.items->0->>'profile', po.items->0->>'grade', -- resolved server-side from PO line item, see note below
    v_bundle.quantity, v_bundle.quantity, p_length, p_location, 'available'
  from receivings r join purchase_orders po on po.id = r.po_id
  where r.id = v_bundle.receiving_id
  returning id into v_lot_id;

  update heat_numbers set parts_count = parts_count + 1 where id = p_heat_number_id;

  return v_lot_id;
end;
$$;
```

*(Implementer note: the `po.items->0->>'profile'` placeholder resolves the profile/grade from the PO's line items JSONB; the real implementation should pass `profile`/`grade` explicitly as RPC parameters from the UI's bundle-registration form rather than inferring from JSONB array index 0, since a PO can have multiple line items. Included above only to show the shape — see the Edge Function wrapper in §7.3 for the corrected explicit-parameter version.)*

### 6.8 `mtr_documents` (Module 10) + quarantine automation

```sql
create table mtr_documents (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  heat_number_id      uuid not null references heat_numbers(id) on delete cascade,
  file_attachment_id  uuid references file_attachments(id) on delete set null,
  yield_strength      numeric(10,2),
  tensile_strength    numeric(10,2),
  chemistry           jsonb,
  mill_name           text,
  ocr_status          mtr_ocr_status not null default 'pending',
  extracted_by        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index mtr_docs_heat_idx on mtr_documents(heat_number_id);
create index mtr_docs_company_idx on mtr_documents(company_id);

create trigger set_updated_at before update on mtr_documents
  for each row execute function fn_set_updated_at();
```

**Quarantine trigger** (formalizes the rule already narrated in `docs/backend-requirements.md` §6.5 M-5: *"if mtr_status='Awaiting' → heat_numbers.status='Quarantine' (blocks fabrication)"*):

```sql
create or replace function fn_sync_heat_quarantine() returns trigger as $$
begin
  update heat_numbers set
    status = case
      when exists (
        select 1 from mtr_documents
        where heat_number_id = coalesce(new.heat_number_id, old.heat_number_id)
          and ocr_status = 'verified'
      ) then 'available'::heat_availability_status
      else 'quarantine'::heat_availability_status
    end,
    mtr_status = case
      when exists (select 1 from mtr_documents where heat_number_id = coalesce(new.heat_number_id, old.heat_number_id) and ocr_status = 'verified')
        then 'verified'::mtr_status
      when exists (select 1 from mtr_documents where heat_number_id = coalesce(new.heat_number_id, old.heat_number_id))
        then 'received'::mtr_status
      else 'pending'::mtr_status
    end
  where id = coalesce(new.heat_number_id, old.heat_number_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger sync_heat_quarantine
  after insert or update or delete on mtr_documents
  for each row execute function fn_sync_heat_quarantine();
```

**OCR extraction — Phase 1, per owner decision (§13, D5).** Rather than adding a new vendor dependency (Textract/Document AI), reuse the model access the app already has: `OPENAI_API_KEY`/`OPENAI_MODEL` are already configured as Supabase Edge Function secrets for the AI Copilot (`controllers/copilot.ts`, `README.md` §"Wire env vars"). MTR extraction is a vision + structured-output task a multimodal chat-completions call handles well, so it doesn't need its own OCR pipeline.

New endpoint: `POST /mtr-documents/:id/extract`

1. Role check (`owner, qc, foreman` — matches `mtr_documents.insertable`).
2. Load the `file_attachments` row via `file_attachment_id`, generate a short-lived signed URL from the `mtrs` bucket.
3. Call the configured OpenAI-compatible model with the signed URL as an image/PDF input and a strict JSON-schema response format:
   ```ts
   const MtrExtractionSchema = z.object({
     heat_number: z.string().nullable(),
     yield_strength: z.number().nullable(),
     tensile_strength: z.number().nullable(),
     chemistry: z.record(z.string(), z.number()).nullable(), // {"C": 0.18, "Mn": 1.2, ...}
     mill_name: z.string().nullable(),
   });
   ```
4. On success: `update mtr_documents set yield_strength=..., tensile_strength=..., chemistry=..., mill_name=..., ocr_status='extracted', extracted_by='ocr:<model_name>'`.
5. On failure (model error, unparseable response, low-confidence/empty fields): leave `ocr_status='pending'` and surface the error to the UI — never silently write partial/guessed values.

**Extraction is advisory, not authoritative.** The quarantine trigger (`fn_sync_heat_quarantine`) only reads `verified`, not `extracted` — a QC user must open the MTR record, review the OCR-populated fields against the actual document, correct anything wrong, and explicitly flip `ocr_status` to `'verified'` (a `PATCH /mtr_documents/:id { ocr_status: 'verified' }` through the generic CRUD route, restricted to `qc`/`owner` per §7.1). This keeps a wrong OCR read from ever releasing quarantined material into fabrication — the model pre-fills the form, it doesn't approve the heat.

Frontend: the "New MTR" flow in the Heat Numbers page uploads the file (existing `AttachmentsDrawer`/`FileUploader` pattern), then calls `extract` automatically and shows the returned fields in an editable form pre-filled from the OCR result, with a required "Verified by QC" confirmation step before submit.

### 6.9 `parts` — traceability FK

```sql
alter table parts add column material_lot_id uuid references material_lots(id) on delete set null;
create index parts_lot_idx on parts(material_lot_id) where material_lot_id is not null;
```

`parts.heat_number` (existing free-text column) is kept as a denormalized display cache, synced from `material_lots.heat_number_id → heat_numbers.heat_number` by trigger when `material_lot_id` is set — so existing UI reading `parts.heat_number` keeps working unmodified.

---

## 7. API surface — Phase 1

Following the existing convention: simple CRUD tables register in `permissions.ts` + `crud.ts` generic handler + a thin `hooks/useResource.ts` call; anything with multi-table side effects gets a dedicated controller under `supabase/functions/api/controllers/`, registered in `index.ts` **before** the generic `/{table}/{id}` route (same pattern as `purchaseOrder.ts` today).

### 7.1 Generic CRUD registrations (`permissions.ts` additions)

```ts
vendors: {
  table: "vendors",
  insertable: ["owner", "pm", "accounting"],
  updatable: ["owner", "pm", "accounting"],
  deletable: ["owner"],
  readable: [...ALL_NON_WORKER],
  hasCompanyId: true,
  activity: { entity_type: "vendors", label_field: "name" },
},
inbound_shipments: {
  table: "inbound_shipments",
  insertable: ["owner", "pm", "foreman", "accounting"],
  updatable: ["owner", "pm", "foreman", "accounting"],
  deletable: ["owner"],
  readable: ["owner", "pm", "foreman", "accounting"],
  hasCompanyId: true,
  sequence: { prefix: "SHP", field: "shipment_number" },
  activity: { entity_type: "inbound_shipments", label_field: "shipment_number" },
},
receivings: {
  table: "receivings",
  insertable: ["owner", "pm", "foreman"],
  updatable: ["owner", "pm"], // append-only in spirit; foreman creates, doesn't edit history
  deletable: ["owner"],
  readable: ["owner", "pm", "foreman", "accounting"],
  hasCompanyId: true,
  sequence: { prefix: "REC", field: "receiving_number" },
  activity: { entity_type: "receivings", label_field: "receiving_number" },
},
bundles: {
  table: "bundles",
  insertable: ["owner", "pm", "foreman"],
  updatable: ["owner", "pm", "foreman"],
  deletable: ["owner"],
  readable: ["owner", "pm", "foreman", "qc"],
  hasCompanyId: true,
  sequence: { prefix: "BND", field: "bundle_number" },
  activity: { entity_type: "bundles", label_field: "bundle_number" },
},
material_lots: {
  table: "material_lots",
  insertable: ["owner", "pm", "foreman", "qc"], // heat assignment happens via RPC, but direct edits (location, status) go through here
  updatable: ["owner", "pm", "foreman", "qc"],
  deletable: ["owner"],
  readable: ["owner", "estimator", "pm", "foreman", "qc"],
  hasCompanyId: true,
  sequence: { prefix: "LOT", field: "lot_number" },
  activity: { entity_type: "material_lots", label_field: "lot_number" },
},
mtr_documents: {
  table: "mtr_documents",
  insertable: ["owner", "qc", "foreman"],
  updatable: ["owner", "qc"], // only QC verifies
  deletable: ["owner"],
  readable: ["owner", "pm", "qc", "foreman"],
  hasCompanyId: true,
},
```

### 7.2 `heat_numbers` RBAC — widen slightly

Current config restricts `insertable`/`updatable` to `owner, qc` only. Since bundles are registered by receiving clerks (foreman role) who need to assign heat numbers on the shop floor, add `foreman` to `insertable`/`updatable` for `heat_numbers`, matching the PDF's Receiving Clerk persona ("Missing Heat Assignments" is explicitly one of their dashboard tiles).

### 7.3 Dedicated endpoint: `POST /bundles/:id/assign-heat`

New controller `supabase/functions/api/controllers/heatAssignment.ts`:

```ts
const AssignHeatSchema = z.object({
  heat_number_id: z.string().uuid(),
  project_id: z.string().uuid(),
  profile: z.string().min(1),
  grade: z.string().min(1),
  length: z.number().positive().optional(),
  location: z.string().max(120).optional(),
});
```

Steps: role check (`owner|pm|foreman|qc`) → validate → verify bundle belongs to caller's company → call `fn_assign_heat_to_bundle` RPC (explicit `profile`/`grade` params, not JSONB inference — see §6.7 implementer note) → `writeAudit` + `writeActivity` → return `{ material_lot }`.

### 7.4 Dedicated endpoint: `GET /material-lots/recommend`

Phase 3 (Production Allocation, Module 12), specified now so the schema above supports it without rework:

```
GET /material-lots/recommend?profile=W14x82&grade=A992&min_length=240&project_id=<uuid>
```

Query: `material_lots` where `status='available' AND profile=? AND grade=? AND length >= min_length`, ordered by `length ASC, created_at ASC` (closest length first, then oldest — matches the PDF's "Closest length, Lowest waste, Oldest inventory first"). Read-only, no Edge Function business logic beyond the query — implement as a bespoke read since the generic CRUD handler doesn't support this ordering/filtering combination.

### 7.5 Dedicated endpoint: `POST /mtr-documents/:id/extract`

Phase 1 (per §13 D5). New controller `supabase/functions/api/controllers/mtrExtraction.ts`. Role check `owner, qc, foreman` (matches `mtr_documents.insertable`). Full request/response shape, the JSON-schema contract with the model, and the advisory-only/human-verification guarantee are specified in §6.8 — not duplicated here.

---

## 8. Frontend — Phase 1

New pages under `app/(dashboard)/dashboard/`:

| Route | Purpose | `projectScoped` |
|---|---|---|
| `vendors` | Vendor master CRUD (list + modal), company-wide like `gc-contacts` | No |
| `inbound-shipments` | Track vendor shipments per PO | Yes |
| `receivings` | Replaces the "Receive" modal flow in the current `receiving` page — becomes a real list of receiving records with a "New receiving" action per open PO | Yes |
| `bundles` | List bundles from a receiving; "Assign Heat" action per bundle | Yes |
| `material-lots` | New tab on the existing Inventory page (`inventory/page.tsx`) rather than a separate nav item — "Bulk Stock" vs "Traceable Lots" tabs, per Design Decision 2 | Yes (lots tab only) |

Nav config changes (`lib/nav-config.ts`):
- Add `vendors` under **Procurement** section, company-wide.
- Add `inbound-shipments`, `receivings`, `bundles` under **Procurement**, all `projectScoped: true`.
- Update `heat-numbers` and `inventory` entries: keep company-wide for the bulk view; the lots tab inside Inventory reads `selectedProjectId` internally rather than gating the whole page (avoids forcing a project selection just to see bulk stock levels).
- `ROUTE_ACCESS` gets matching entries for middleware enforcement.

**Existing `receiving` page** (`app/(dashboard)/dashboard/receiving/page.tsx`) changes from directly `PATCH`-ing `purchase_orders.qty_received` to `POST`-ing a new `receivings` row; the trigger in §6.5 handles the PO rollup that the page currently computes client-side (the `Math.min(prev + qtyThisDelivery, ord)` logic in `ReceiveModal` moves server-side). The "Receive" button flow becomes: open modal → enter qty + exceptions/photos → creates a `receivings` row → success toast shows the new receiving number → optionally jump straight into "Register bundles" for that receiving.

### 8.1 Universal Object Pattern component (Phase 4, specced now for forward-compatibility)

New shared component `components/ui/ObjectDetailPanel.tsx`, config-driven:

```ts
interface ObjectDetailConfig<T> {
  header: (record: T) => { title: string; subtitle?: string };
  status: (record: T) => { label: string; tone: "neutral"|"success"|"warn"|"error" };
  timeline: (record: T) => { label: string; at: string | null; done: boolean }[];
  relationships: { label: string; href: string }[];
  suggestedActions: (record: T) => { label: string; onClick: () => void }[];
}
```

Rendered as a slide-over or dedicated `/dashboard/<module>/[id]` route reusing the existing `AttachmentsDrawer` for the attachments block and `activity_feed` (already populated by every `writeActivity` call) for the activity feed block. This is the reusable scaffold for the PO detail view, Receiving detail, Bundle detail, and Lot detail — build once, configure four times, rather than four bespoke detail pages.

---

## 9. RBAC mapping and role-based dashboard tiles

### 9.1 PDF persona → existing role mapping

| PDF persona | FabSimple role | Notes |
|---|---|---|
| Purchasing Manager | `pm` + `accounting` (PO write is already shared between these two) | No new "purchasing" role — avoids RBAC matrix growth for a thin slice of users |
| Receiving Clerk | `foreman` | Foreman already has shop-floor write access; gains `receivings`/`bundles`/`heat_numbers` insert |
| Production Manager | `foreman` (shop-floor) + `pm` (oversight) | Matches existing split between these two roles elsewhere in the app |
| Project Manager | `pm` | Unchanged |
| CEO / Owner | `owner` | Unchanged |

### 9.2 New dashboard tiles (`controllers/dashboard.ts`, Phase 4)

Per the PDF's role-based experience section:
- **PM tile:** "Missing MTRs" — count of `heat_numbers where status='quarantine'` for the active project's lots.
- **Foreman tile:** "Open Receivings" (POs with `status in ('issued','partial')`), "Missing Heat Assignments" (`bundles where heat_number_id is null`).
- **Owner tile:** "Vendor Performance" from the `vendor_performance` view (§6.2), "Procurement Risk" (overdue `expected_date` on open POs — already partially computed client-side in `receiving/page.tsx`'s `totals.overdue`, promote to a server aggregate).

---

## 10. Migration & rollout plan

1. **`20260728000001_procurement_traceability.sql`** — all DDL from §6, in dependency order: enums → `vendors` → `purchase_orders` alterations → `inbound_shipments` → `receivings` → trigger → `bundles` → `heat_numbers` alterations → `material_lots` → RPC → `mtr_documents` → quarantine trigger → `parts` alteration.
2. **Backfill migration `20260728000002_procurement_backfill.sql`:**
   - For each distinct `purchase_orders.vendor` string, `insert into vendors (company_id, name) select distinct company_id, vendor from purchase_orders on conflict do nothing`, then `update purchase_orders set vendor_id = vendors.id where vendors.name = purchase_orders.vendor and vendors.company_id = purchase_orders.company_id`.
   - Existing `heat_numbers` rows get `status='available'` by default (already the column default) — no data implies no quarantine, which is the safe default (avoids retroactively blocking fabrication on historical demo data).
   - No backfill possible for `receivings` from history, since the old flow never recorded discrete receiving events — existing PO `qty_received` values are left as-is (now just no longer trigger-maintained until the next new `receivings` row is inserted against that PO).
3. **RLS:** every new table gets the standard two policies (`org_isolation` via `get_user_company_id()`, `force row level security`) — copy the exact pattern from `20260524000003_rls.sql` for the newest existing table (`heat_numbers`) rather than hand-rolling.
4. **Deploy order:** DB migration → Edge Function deploy (new controllers + `permissions.ts` entries) → frontend deploy. Matches the existing deployment order documented in the 2026-07-04 PO design doc.
5. **Feature flag:** none needed — Phase 1 is purely additive (new tables, new optional FKs with `on delete set null`), so it can ship without a flag; the old receiving flow is swapped in the same release since the trigger makes the transition transparent to any code still reading `purchase_orders.qty_received`.

---

## 11. Testing plan

- **Migration test:** run `supabase db reset` against a copy of the demo seed; verify no FK violations, verify `vendor_performance` view returns rows.
- **Trigger unit tests** (new `tests/` specs, matching existing Vitest conventions):
  - `fn_recompute_po_receiving`: two partial receivings sum correctly; PO flips to `received` only when `qty_received >= qty_ordered`; a receiving delete recomputes correctly (handles the `on delete cascade` path).
  - `fn_sync_heat_quarantine`: heat starts `quarantine` by default when a bundle is assigned but no MTR exists; flips to `available` only when a `mtr_documents` row reaches `ocr_status='verified'`; flips back to `quarantine` if the verified doc is deleted.
  - `fn_assign_heat_to_bundle`: creates exactly one `material_lots` row per call; `heat_numbers.parts_count` increments; idempotency is **not** guaranteed by design (calling twice creates two lots) — document this as expected (a bundle split across two heats is a real scenario).
- **Integration tests** (`tests-integration/`): `POST /bundles/:id/assign-heat` — role check (403 for `worker`/`accounting`), 404 for cross-company bundle, happy path returns a `material_lot` with correct `profile`/`grade` inherited.
- **RLS tests:** confirm `worker` role cannot read `vendors`, `receivings`, `material_lots` (not in any `readable` list) — mirrors the existing RLS test pattern for other tables.
- **UI/E2E** (Playwright, matching `e2e/project-flow.spec.ts` conventions): create PO → create inbound shipment → create receiving → register bundle → assign heat → verify lot appears in Inventory's "Traceable Lots" tab with `status='available'` once an MTR is verified, `quarantine` before.

---

## 12. Realtime

New channels, following the existing `company:<companyId>:<domain>` pattern used for `inventory`/`shipments`/`qc`:

| Channel | Fires on | Consumers |
|---|---|---|
| `company:<id>:receivings` | INSERT/UPDATE on `receivings` | Receiving page, PO detail |
| `company:<id>:heat-quarantine` | UPDATE on `heat_numbers.status` | Production Manager dashboard tile, Parts page (blocks cutting quarantined lots) |
| `company:<id>:material-lots` | UPDATE on `material_lots.status` | Inventory lots tab, cut-plan/production allocation UI |

---

## 13. Decisions — resolved with owner (2026-07-27)

All decisions below were reviewed and confirmed directly with the owner before implementation. Kept here as the historical record of *why* the spec is shaped the way it is — not open questions anymore.

| # | Decision | Resolution | Notes |
|---|---|---|---|
| D1 | Material Requirement timing | **Deferred to Phase 2** | Existing "create PO from not-started parts" flow stays as-is through Phase 1; no `material_requirements` table until Phase 2. |
| D2 | Inventory split UX | **Two tabs on the existing Inventory page** ("Bulk Stock" / "Traceable Lots") | Per §6.6/§8. No new nav item, no retirement of the bulk `inventory` table. |
| D3 | PO approval gate | **Deferred — out of scope for this module** | `Pending Approval`/`Approved` states are not added to `po_status` in this spec. Tracked as a separate future spec if/when needed. |
| D4 | Inbound shipping storage bucket | **Reuse the existing `mtrs` bucket** with a path-prefix convention | No new Storage bucket/RLS policy to provision. |
| D5 | MTR OCR extraction | **In scope for Phase 1** — reversing the original recommendation | Implemented via the existing OpenAI-backed Copilot infrastructure (no new OCR vendor), advisory-only until a QC user explicitly verifies. Full design in §6.8. |
| D6 | Heat Numbers RBAC widening | **`foreman` added to `insertable`/`updatable`** | Per §7.2 — unchanged from the original recommendation. |
| D7 | New procurement-specific role? | **No new role** — map PDF personas onto the existing 7 roles | Per §9.1. Purchasing Manager → `pm`+`accounting`, Receiving Clerk → `foreman`, Production Manager → `foreman`+`pm`. |
| D8 | Material Lot ↔ Project binding | **Lot inherits `project_id` from the originating PO; cross-project moves are a manual FK edit**, not a first-class transfer workflow | See detail note below. No separate `lot_reservations` table in Phase 1. |
| D9 | `receivings` mutability | **Editable by `owner`/`pm`** after creation (not strictly append-only) | Per §6.5/§7.1. Corrections happen in place; there is no reversing-entry requirement. Revisit if audit requirements tighten later. |

**D8 detail**, spelled out since §6.7's DDL only shows the column, not the policy: `material_lots.project_id` is set once, at creation time (inside `fn_assign_heat_to_bundle`, from the `p_project_id` parameter the UI passes from the active Global Project Context). There is no dedicated "transfer lot to another project" endpoint in Phase 1 — moving a lot means an `owner`/`pm` directly edits the `material_lots` row via the generic CRUD update route (`project_id` is a normal, updatable column, not locked). This is intentionally the cheapest option: it satisfies the real but rare "leftover material from a cancelled project" case without building a reservation/transfer subsystem. If cross-project material sharing turns out to be routine rather than rare, promote this to a real `lot_transfers` audit table in a later phase.

---

## 14. Summary of net-new surface area (Phase 1 only)

- **6 new tables:** `vendors`, `inbound_shipments`, `receivings`, `bundles`, `material_lots`, `mtr_documents` (+ 1 view: `vendor_performance`)
- **3 altered tables:** `purchase_orders` (+6 columns), `heat_numbers` (+1 column), `parts` (+1 column)
- **6 new enums:** `vendor_status`, `po_confirmation_status`, `inbound_shipment_status`, `lot_status`, `heat_availability_status`, `mtr_ocr_status`
- **3 triggers:** PO receiving rollup, heat quarantine sync, `updated_at` (×6 new tables, reusing existing `fn_set_updated_at`)
- **1 RPC:** `fn_assign_heat_to_bundle`
- **2 new Edge Function controllers:** `heatAssignment.ts` (bundle→heat assignment), `mtrExtraction.ts` (OCR extraction via the existing OpenAI-backed model) — plus 6 generic CRUD table registrations needing no bespoke controller code
- **5 new/changed frontend pages**, 1 new reusable component (`ObjectDetailPanel`, Phase 4)

---

## 15. Phase 2 — Sourcing Workflow (full design)

**Status:** ✅ Deployed to production (2026-08-02). Schema, RLS, Edge Function, and frontend all live and verified. Two corrections were made during implementation planning, not reflected in the DDL below as originally drafted — see §15.18.

Phase 1 covers everything *after* a PO exists. Phase 2 covers everything *before* one does: raising a Material Requirement, shopping it to multiple vendors via RFQ, comparing quotes, and awarding — which auto-creates the PO that Phase 1's chain (Shipment → Receiving → Bundle → Heat → Lot) already knows how to consume.

### 15.1 Decisions this section encodes

| # | Decision | Resolution |
|---|---|---|
| D10 | Material Requirement ↔ Parts linkage | **No linkage.** MR is a standalone quantity/grade/profile record (matches the PDF's flat MR fields exactly). Awarding a PO from an MR does **not** flip any `parts.status` — that stays specific to the existing not-started-parts flow. |
| D11 | RFQ vendor outreach | **Downloadable PDF only.** No auto-email, no response-tracking automation (that's Phase 5). PM downloads the RFQ PDF and sends it however they already do; quotes are then manually keyed in when vendors respond. |
| D12 | Award behavior | **Auto-create PO draft immediately.** Awarding a quote runs an atomic RPC (`fn_award_vendor_quote`, mirrors `fn_assign_heat_to_bundle`'s pattern) that creates a `purchase_orders` row in `draft` status, fully pre-filled — zero re-entry. Owner/PM still reviews and issues it from the PO page like any other draft. |
| D13 | Multi-project POs | **Per-line-item project tagging.** A single PO's `items` array can contain lines for different projects (`{ profile, grade, qty, unit_price, project_id, material_requirement_id }` per line). One vendor order can cover two jobs at once. |
| D14 | RFQ/MR project scope | **RFQ can bundle Material Requirements from multiple projects upfront.** This is the one deliberate exception to the Global Project Context principle — building an RFQ is an explicit cross-project action, not an inherited-context page. `rfqs` itself carries no `project_id` column; project attribution lives on each `rfq_line` via its source MR. |
| D15 | Existing "Create PO from not-started parts" flow | **Open — owner to decide separately (see §15.12).** Everything else in this section ships regardless of this call; it only affects whether that one existing endpoint is touched. |

### 15.2 New enums

```sql
create type material_requirement_status as enum ('open', 'rfq_created', 'awarded', 'fulfilled', 'cancelled');
create type rfq_status                  as enum ('draft', 'sent', 'quotes_received', 'awarded', 'cancelled');
create type quote_status                as enum ('pending', 'submitted', 'awarded', 'rejected', 'expired');
```

### 15.3 `material_requirements` (Module 1)

```sql
create table material_requirements (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  mr_number       text not null,
  profile         text not null,
  grade           text,
  quantity        numeric(10,2) not null,
  length          numeric(10,3),
  weight          numeric(10,2),
  required_date   date,
  status          material_requirement_status not null default 'open',
  notes           text,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index mr_company_num_idx on material_requirements(company_id, mr_number);
create index mr_project_idx on material_requirements(project_id);
create index mr_status_idx on material_requirements(company_id, status);

create trigger set_updated_at before update on material_requirements
  for each row execute function fn_set_updated_at();
```

Project-scoped (`projectScoped: true` in nav config, like `purchase_orders`/`receiving`) — always created inside the active Global Project Context. Input is **manual entry only** in Phase 2; CSV import (the PDF's Module 1 also lists Tekla/SDS2/ERP import) is explicitly out of scope here — it's Phase 5 per the existing non-goals list, and even CSV-only would just reuse the app's existing generic importer as a fast-follow, not core Phase 2 work.

`status` transitions: `open` → `rfq_created` (once any `rfq_line` references it) → `awarded` (once its RFQ is awarded) → `fulfilled` (manual, once the resulting PO is fully received — no automatic trigger for this in Phase 2, since a PO can span requirements from other projects too; owner/PM marks it manually) or `cancelled` at any point before `awarded`.

### 15.4 `rfqs` (Module 2)

```sql
create table rfqs (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  rfq_number            text not null,
  status                rfq_status not null default 'draft',
  delivery_requirement  text,
  notes                 text,
  created_by            uuid references users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index rfq_company_num_idx on rfqs(company_id, rfq_number);

create trigger set_updated_at before update on rfqs
  for each row execute function fn_set_updated_at();
```

**Deliberately no `project_id` column** (§15.1 D14) — this is the one table in the whole module that doesn't inherit the Global Project Context, because its entire purpose is to let a PM shop requirements from several projects to the same vendor in one ask. The RFQ list page is therefore **not** gated by `ProjectGate` (unlike every other Phase 1/2 page) — it shows all RFQs company-wide regardless of the currently-selected project.

### 15.5 `rfq_lines` (RFQ ↔ Material Requirement, many-to-many with a quantity snapshot)

```sql
create table rfq_lines (
  id                        uuid primary key default gen_random_uuid(),
  rfq_id                    uuid not null references rfqs(id) on delete cascade,
  material_requirement_id   uuid not null references material_requirements(id) on delete restrict,
  quantity                  numeric(10,2) not null,
  created_at                timestamptz not null default now()
);
create unique index rfq_lines_unique_idx on rfq_lines(rfq_id, material_requirement_id);
create index rfq_lines_mr_idx on rfq_lines(material_requirement_id);
```

`quantity` is a snapshot, not always equal to the MR's full quantity — an MR can in principle be split across two RFQs (e.g., half sourced from an incumbent vendor directly, half shopped competitively). `on delete restrict` on `material_requirement_id`: you can't delete an MR that's already on an RFQ; cancel it instead.

A trigger (`fn_rfq_lines_after_insert`) flips the referenced `material_requirements.status` to `'rfq_created'` when the first line referencing it is inserted — mirrors Phase 1's rollup-trigger philosophy rather than requiring the client to update MR status itself.

### 15.6 `rfq_vendors` (which vendors this RFQ was sent to)

```sql
create table rfq_vendors (
  id          uuid primary key default gen_random_uuid(),
  rfq_id      uuid not null references rfqs(id) on delete cascade,
  vendor_id   uuid not null references vendors(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create unique index rfq_vendors_unique_idx on rfq_vendors(rfq_id, vendor_id);
```

Needed even without email automation (§15.1 D11) — this is what "Track Vendor Responses" (PDF Module 2) means in Phase 2: the RFQ detail page shows which vendors were asked and which have (and haven't) submitted a quote yet.

### 15.7 `vendor_quotes` (Module 3 — one per vendor per RFQ)

```sql
create table vendor_quotes (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  rfq_id           uuid not null references rfqs(id) on delete cascade,
  vendor_id        uuid not null references vendors(id) on delete restrict,
  status           quote_status not null default 'pending',
  lead_time_days   integer,
  freight_cost     numeric(10,2),
  validity_date    date,
  notes            text,
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index vendor_quotes_unique_idx on vendor_quotes(rfq_id, vendor_id);

create trigger set_updated_at before update on vendor_quotes
  for each row execute function fn_set_updated_at();
```

### 15.8 `vendor_quote_lines` (per-material-line pricing)

```sql
create table vendor_quote_lines (
  id                 uuid primary key default gen_random_uuid(),
  vendor_quote_id    uuid not null references vendor_quotes(id) on delete cascade,
  rfq_line_id        uuid not null references rfq_lines(id) on delete cascade,
  unit_price         numeric(10,2) not null,
  mill_name          text,
  rolling_schedule   text,
  created_at         timestamptz not null default now()
);
create unique index vendor_quote_lines_unique_idx on vendor_quote_lines(vendor_quote_id, rfq_line_id);
```

A vendor prices each material line separately (a mill quotes W14x82 and W24x68 at different $/lb) — this is why quotes need a header + lines shape rather than a single flat price, unlike Phase 1's simpler objects.

### 15.9 `purchase_orders` — further alterations

```sql
alter table purchase_orders
  add column rfq_id uuid references rfqs(id) on delete set null;

create index po_rfq_idx on purchase_orders(rfq_id);
```

(This is exactly the FK §6.3 flagged as "added in Phase 2 alongside the tables they reference.")

**`items` JSONB shape gains two optional fields per line** — additive, backward-compatible with every existing PO (manual entry, CSV import, and the from-parts flow all keep working untouched, since they simply never populate these two fields):

```ts
interface LineItem {
  profile: string;
  grade: string | null;
  qty: number;
  piece_count: number;
  total_weight_lb: number;
  unit_price?: number;                    // new — from the awarded quote line
  project_id?: string | null;             // new — per-line project attribution (§15.1 D13)
  material_requirement_id?: string | null; // new — traceability back to the MR that drove this line
}
```

### 15.10 `fn_award_vendor_quote` RPC (Module 3's "Award Vendor" action)

Atomic, mirrors `fn_assign_heat_to_bundle`'s security-definer RPC pattern:

```sql
create or replace function fn_award_vendor_quote(p_vendor_quote_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_quote vendor_quotes%rowtype;
  v_company_id uuid;
  v_po_number text;
  v_items jsonb;
  v_total_qty numeric;
  v_po_id uuid;
begin
  select * into v_quote from vendor_quotes where id = p_vendor_quote_id;
  if v_quote.status not in ('pending', 'submitted') then
    raise exception 'quote % is not awardable (status=%)', p_vendor_quote_id, v_quote.status;
  end if;
  v_company_id := v_quote.company_id;

  select
    jsonb_agg(jsonb_build_object(
      'profile', mr.profile, 'grade', mr.grade, 'qty', rl.quantity,
      'piece_count', rl.quantity, 'total_weight_lb', 0,
      'unit_price', vql.unit_price,
      'project_id', mr.project_id,
      'material_requirement_id', mr.id
    )),
    sum(rl.quantity)
  into v_items, v_total_qty
  from vendor_quote_lines vql
  join rfq_lines rl on rl.id = vql.rfq_line_id
  join material_requirements mr on mr.id = rl.material_requirement_id
  where vql.vendor_quote_id = p_vendor_quote_id;

  v_po_number := next_sequence_number(v_company_id, 'purchase_orders', 'PO', 4);

  insert into purchase_orders (
    company_id, po_number, vendor, vendor_id, rfq_id, items,
    qty_ordered, status, expected_date
  ) values (
    v_company_id, v_po_number,
    (select name from vendors where id = v_quote.vendor_id), v_quote.vendor_id,
    v_quote.rfq_id, v_items, v_total_qty, 'draft',
    current_date + coalesce(v_quote.lead_time_days, 0)
  ) returning id into v_po_id;

  update vendor_quotes set status = 'awarded' where id = p_vendor_quote_id;
  update vendor_quotes set status = 'rejected'
    where rfq_id = v_quote.rfq_id and id <> p_vendor_quote_id and status in ('pending', 'submitted');
  update rfqs set status = 'awarded' where id = v_quote.rfq_id;
  update material_requirements set status = 'awarded'
    where id in (
      select rl.material_requirement_id from rfq_lines rl
      join vendor_quote_lines vql on vql.rfq_line_id = rl.id
      where vql.vendor_quote_id = p_vendor_quote_id
    );

  return v_po_id;
end;
$$;
```

Note this is a **read-then-write across many tables in one transaction**, same shape as Phase 1's RPCs — no client-side multi-step orchestration, no partial-award race condition.

### 15.11 Receiving rework for multi-project POs

Phase 1's `fn_receivings_before_insert` (§6.5) silently copies `receivings.project_id` from `purchase_orders.project_id`. With D13, a PO's line items can now span projects, so that single-field copy is no longer always correct.

**Scope decision for Phase 2** (recommended, not yet asked as a separate question — flagging here for your review): rather than building full per-line-item receiving allocation (splitting one delivery's quantity across multiple projects' lines, which would require reworking `qty_remaining_on_po`/`qty_backordered` math to be per-line instead of per-PO), keep receivings as **one project per receiving event**:

- If every item on the PO shares the same `project_id` (or none do — the common case, including every Phase-1-era PO), `project_id` keeps auto-deriving exactly as today. **Zero behavior change for existing/single-project POs.**
- If the PO's items span more than one distinct `project_id`, the trigger now requires the client to pass `project_id` explicitly (raises an error otherwise) — the receiving clerk picks which project this particular delivery is for.
- A truck that genuinely carries a mixed load for two projects is logged as **two receiving records** against the same PO (one per project), reusing the append-only, multiple-receivings-per-PO model Phase 1 already built — not a new capability, just applying the existing pattern.

This keeps the rework contained to `fn_receivings_before_insert`'s validation branch and the Receiving page's "New receiving" modal (add a project picker, only shown/required when the selected PO is multi-project). `fn_bundles_set_project_id` needs no change — it already derives from the receiving's `project_id`, which is now guaranteed correct either way.

### 15.12 Open item: existing "Create PO from not-started parts" flow

Per §15.1 D15, this is still your call. Recap of the two options (unchanged from the earlier discussion):

- **Option A (recommended):** leave `purchaseOrder.ts`'s `previewPoFromParts`/`createPoFromParts` completely untouched. The fast lane and the new MR→RFQ→Quote→Award lane run side by side, with no shared code. Zero risk to shipped functionality; the tradeoff is that a "Material Requirements" list will never show parts-driven POs.
- **Option B:** the existing endpoint first creates a `material_requirements` row (auto-populated from the aggregated parts, immediately marked `awarded` — no RFQ step) before creating the PO, so every PO has a traceable MR origin. More architecturally complete, but changes a working, shipped code path.

Nothing else in this section depends on this decision — it can be made and implemented independently, at any point, without blocking §15.2–§15.11.

### 15.13 API surface

**Generic CRUD registrations** (`permissions.ts`):

```ts
material_requirements: {
  table: "material_requirements",
  insertable: ["owner", "pm", "estimator"],
  updatable: ["owner", "pm", "estimator"],
  deletable: ["owner", "pm"],
  readable: ["owner", "pm", "estimator", "foreman", "accounting"],
  hasCompanyId: true,
  sequence: { prefix: "MR", field: "mr_number" },
  activity: { entity_type: "material_requirements", label_field: "mr_number" },
},
rfqs: {
  table: "rfqs",
  insertable: ["owner", "pm", "accounting"],
  updatable: ["owner", "pm", "accounting"],
  deletable: ["owner"],
  readable: ["owner", "pm", "accounting", "estimator"],
  hasCompanyId: true,
  sequence: { prefix: "RFQ", field: "rfq_number" },
  activity: { entity_type: "rfqs", label_field: "rfq_number" },
},
vendor_quotes: {
  table: "vendor_quotes",
  insertable: ["owner", "pm", "accounting"],
  updatable: ["owner", "pm", "accounting"],
  deletable: ["owner"],
  readable: ["owner", "pm", "accounting", "estimator"],
  hasCompanyId: true,
},
```

`rfq_lines`, `rfq_vendors`, `vendor_quote_lines` are child rows managed through their parent's dedicated controller (below), not exposed as standalone generic-CRUD tables — same reasoning as Phase 1 keeping `rfq_lines`-style join rows out of the generic registry.

**Dedicated controllers** (`supabase/functions/api/controllers/rfq.ts`):

- `POST /rfqs` — compound create: RFQ header + `rfq_lines` (from selected MRs, possibly cross-project) + `rfq_vendors` (selected vendors) in one atomic call, mirroring how `heatAssignment.ts` wraps multi-table writes.
- `GET /rfqs/:id/pdf` — generates the downloadable RFQ PDF (§15.1 D11): project(s), material lines, required date, delivery requirement. Reuses whichever PDF-generation approach `billing_applications` already uses in this codebase, rather than introducing a new library.
- `POST /vendor-quotes` — compound create: quote header + `vendor_quote_lines` (one per `rfq_line`) in one call.
- `POST /vendor-quotes/:id/award` — thin wrapper around `fn_award_vendor_quote`, same shape as `heatAssignment.ts`'s `assignHeatToBundle`: role check (`owner|pm|accounting`) → RPC call → `writeAudit` + `writeActivity` → return `{ purchase_order }`.

### 15.14 RBAC mapping

| Role | Material Requirements | RFQ / Quotes | Award |
|---|---|---|---|
| owner | Full | Full | ✅ |
| pm | Full | Full | ✅ |
| estimator | Create/Read (raises requirements during takeoff) | Read only | ❌ |
| accounting | Read | Full (Purchasing Manager persona = pm+accounting, per §9.1) | ✅ |
| foreman | Read | ❌ | ❌ |
| qc, worker | ❌ | ❌ | ❌ |

### 15.15 Frontend pages

- **Material Requirements** (`app/(dashboard)/dashboard/material-requirements/page.tsx`) — project-scoped list + create modal, same shape as Phase 1's `vendors`/`inbound-shipments` pages.
- **RFQ** (`app/(dashboard)/dashboard/rfqs/page.tsx`) — **not** project-scoped (§15.4). List view + a "New RFQ" flow: multi-select Material Requirements across any project, multi-select vendors, delivery requirement text, "Download PDF" once created.
- **RFQ detail** — shows vendors invited vs. responded, an "Enter Quote" action per vendor (opens a modal to key in price-per-line/lead-time/freight/validity), and once ≥1 quote exists, a **comparison table**: vendors as columns, RFQ lines as rows, unit prices, computed total, lead time, freight, and the existing `vendor_performance` view's `on_time_pct`/`exception_count` surfaced read-only (§15.1 — no new scoring formula invented; Phase 1's view is reused as-is per your earlier "keep it simple" pattern). "Award" button per vendor column.
- **Purchase Orders page** — small addition: if `po.rfq_id` is set, show an "via RFQ-0001" badge/link; the items table renders the (now-optional) per-line project name when present.

### 15.16 Testing plan

Mirrors §11's structure:

- **Trigger tests:** `fn_award_vendor_quote` — awarding rejects all sibling quotes on the same RFQ; awarding an already-awarded/rejected quote raises; the resulting PO's `items` correctly carries `project_id` per line for a 2-project RFQ.
- **Integration test:** `POST /vendor-quotes/:id/award` — 403 for `foreman`/`qc`/`worker`; happy path returns a `draft` PO with correct `qty_ordered` sum.
- **Multi-project E2E:** create MR in Project A, MR in Project B → one RFQ bundling both → 2 vendor quotes → award the cheaper → verify PO items carry correct `project_id` per line → receive against Project A only (single receiving) → verify a same-PO receiving attempt without `project_id` is rejected → receive again with `project_id` for Project B → verify each resulting bundle/lot lands in the correct project's Traceable Lots tab.
- **RLS:** `estimator` can create `material_requirements` and read `rfqs`/`vendor_quotes` but cannot insert either; `foreman` can't read any Phase 2 table.

### 15.17 Rollout plan

Note: §16 below consumed the `20260802000001`/`20260802000002` migration slots for the project-decoupling fix before Phase 2 implementation started. Use the next free timestamps when this phase actually ships.

1. `20260802000003_phase2_sourcing.sql` — enums, `material_requirements`, `rfqs`, `rfq_lines`, `rfq_vendors`, `vendor_quotes`, `vendor_quote_lines`, `purchase_orders.rfq_id`, `fn_award_vendor_quote`. (§15.11's receiving rework is superseded — receivings no longer carry `project_id` at all per §16, so there's nothing left to rework there.)
2. `20260802000004_phase2_rls.sql` — standard two-policy RLS on all 6 new tables.
3. No backfill needed — every new table starts empty; `purchase_orders.rfq_id` defaults to `null` for all existing rows.
4. Deploy order matches §10.4: DB migration → Edge Function deploy (`rfq.ts` + `permissions.ts` additions) → frontend deploy.
5. No feature flag needed — purely additive, same reasoning as Phase 1 (§10.5).

### 15.18 Corrections made during implementation (2026-08-02)

Two things changed from the draft above during the implementation planning pass, both discovered by checking actual codebase state rather than assuming:

1. **No `GET /rfqs/:id/pdf` backend endpoint.** §15.13 assumed server-side PDF generation "reusing whichever approach billing_applications uses." That approach turned out to be 100% client-side (`lib/pdf.ts`, jsPDF + jspdf-autotable — see `generateAiaG702`/`generateQcReport`). RFQ PDF generation follows the same pattern: `generateRfqPdf()` in `lib/pdf.ts`, called from the RFQ detail page with data it already has loaded, `.save()`d directly in the browser. No backend route exists or is needed for this.
2. **`rfq_lines`, `rfq_vendors`, `vendor_quote_lines` carry their own `company_id`.** The original draft (§15.5/§15.6/§15.8) left these child tables without `company_id`, which would have required EXISTS-subquery RLS policies against the parent table — a pattern not used anywhere else in this schema. Every other table, including Phase 1's own join-like tables, carries `company_id` directly. Adding it to these three keeps every RLS policy in this module the same simple `company_id = get_user_company_id()` shape.

**D15 resolution:** Option A — `purchaseOrder.ts`'s `previewPoFromParts`/`createPoFromParts` flow was left completely untouched. It runs alongside the new MR→RFQ→Quote→Award lane with zero shared code, as originally recommended.

**Also completed as part of this pass, not previously spec'd:**
- `fn_vendor_quotes_after_insert` trigger — flips `rfqs.status` to `'quotes_received'` on the first quote insert (only advancing `draft`/`sent`, never overwriting a terminal status). §15.4's status lifecycle didn't previously specify how this transition happens; "sent" itself remains a manual PATCH from the RFQ detail page's "Mark as sent" button.
- `fn_create_rfq` / `fn_create_vendor_quote` RPCs — the spec's "compound create" language for `POST /rfqs`/`POST /vendor-quotes` implied atomicity but hadn't spec'd the actual security-definer function; both now exist, mirroring `fn_assign_heat_to_bundle`'s pattern.
- `vendor_performance` (the read-only view from Phase 1, §11) was never actually registered in `permissions.ts` — the RFQ comparison table is the first thing to read it, so it's now registered read-only for `owner`/`pm`/`accounting`/`estimator`.
- A stale `project_id: uuid.optional()` field was found in `material_lots`'s Zod validation schema, left over from §16 dropping that column — removed as a drive-by fix (it was dead/unreachable in practice, but would have produced a confusing Postgres error if a client ever sent it).

### 15.19 Material Requirements bulk sheet import (2026-08-02)

**Status:** ✅ Deployed to production.

**Trigger:** shops raise Material Requirements from existing KISS/EJE/Tekla/SDS2-style material-list spreadsheets, not from scratch — manual one-row-at-a-time entry (the only path Phase 2 originally shipped with) doesn't match that workflow. Validated end-to-end against a real shop sample file (`CSF New Shop part list.xlsx`, 77 piece-level rows).

**Key design point — Material Requirements are a per-(profile, name, grade, length) *aggregate*, not a per-piece record.** Unlike the existing Tekla/SDS2 `parts` importer (`controllers/import.ts`, one row in → one part row out), a material-list sheet's piece-level rows (one per Part Mark) are folded together client-side before the API ever sees them: rows sharing the same profile + name + grade + length collapse into one requirement with quantity summed across them. This is a deliberate difference from Phase 1's parts import, not an oversight.

**Schema:**
- `material_requirements.length` changed from `numeric(10,3)` to `text` (migration `20260802000005`) — exact same reasoning as `20260717000001_parts_length_text`: these sheets export length as mixed feet-inches-fraction strings (e.g. `26'-9 9/16"`), stored verbatim rather than parsed.
- **New `material_requirements.name` column** — the structural member descriptor (e.g. "COLUMN", "CRANE_BEAM"), same role as `parts.name`. Promoted to its own first-class, required-for-import field rather than folded into `notes` — confirmed with the owner that this is important classification data, not incidental metadata, after an initial draft under-weighted it.

**Column mapping** (`app/(dashboard)/dashboard/material-requirements/page.tsx`, `MR_FIELDS`), disambiguating two commonly-confused sheet columns:
- "Profile Size" → `profile` (the actual section)
- "Profile Name" → `name` (required; the category label)
- "Part Mark" → `notes` — a piece-level identifier with no purchasing-level meaning on an aggregate requirement, but preserved as a comma-joined list of the marks that rolled into each group, purely for traceability back to the source sheet.
- "QTY" → `quantity` (summed per group), "Grade" → `grade`, "Cut Length" → `length`.

On the sample file, this maps all 6 sheet columns with zero left unaccounted for.

**Shared infrastructure:** the CSV/XLSX parsing, header-row auto-detection, and alias-based column-mapping logic were extracted from the Tekla/SDS2 importer into `lib/sheet-import.ts` so both importers share identical behavior rather than drifting apart (DRY) — `import/page.tsx` was refactored to use the shared module with no behavior change.

**API:** `POST /material-requirements/import` (`controllers/materialRequirementImport.ts`) — client sends already-mapped, already-aggregated rows; server validates project ownership and bulk-inserts, auto-generating an `mr_number` per row via the same `next_sequence_number` RPC every other path uses. No upsert logic needed (every row is a fresh requirement, unlike parts' upsert-by-mark).

**Verification:** the full parse → map → aggregate pipeline was simulated in Node against the actual sample file before deploy — 77 rows → 27 aggregated requirements, 0 rows skipped, quantity-conservation checked (600 units in, 600 out), confirmed after the Name/Notes redesign that every one of the file's 6 columns maps to a destination.

---

## 16. Decoupling procurement from projects (2026-08-02)

**Status:** ✅ Deployed to production. Schema verified live, Edge Function deployed, frontend pages live and decoupled from Global Project Context gating.

**Trigger:** a post-launch audit of Phase 1 found that `receivings` and `bundles` had `project_id NOT NULL`, which made the entire Receive → Bundle → Heat → Lot chain impossible to use without an active Global Project Context — directly contradicting the owner's intent that procured material should be a shared company-wide pool, not something that gets locked to whichever project happened to be active when it was received.

**Resolution — material lots are never owned by a project; a project only ever holds a partial, releasable *reservation* against one:**

- `receivings.project_id`, `bundles.project_id`, `material_lots.project_id` — **dropped entirely** (not just made nullable). None of the three ever needs a project again. `purchase_orders.project_id` is untouched — it stays optional and purely informational for job-costing, and never restricted material availability in the first place.
- **New `lot_reservations` table** — `material_lot_id`, `project_id`, `quantity`, `status` (`active`/`released`/`consumed`). A single lot can carry active reservations for several projects simultaneously; "available to reserve" = `material_lots.quantity − sum(active reservations)`. Enforced at the DB layer too (`fn_lot_reservations_before_insert` raises rather than allowing over-reservation), not just in the API.
- `fn_assign_heat_to_bundle` RPC — dropped the `p_project_id` parameter. Heat assignment (and therefore lot creation) never touches a project.
- **Dedicated endpoints** (`supabase/functions/api/controllers/lotReservation.ts`): `POST /material-lots/:id/reserve`, `POST /lot-reservations/:id/release`. Both are blocked in the generic CRUD registry (`insertable: []`) since reserving requires an availability check the generic handler can't express.
- **Inventory → Traceable Lots tab**: no longer filtered by the Global Project Context. "Reserve" opens a modal (project + quantity, capped at what's available). Each lot shows its active reservations as removable chips; releasing one hands the quantity back to the shared pool.
- **Nav gating removed**: `purchase-orders`, `inbound-shipments`, `receiving`, `bundles` are no longer `projectScoped: true` — none of them have anything left to gate on. `vendors`, `inventory`, `heat-numbers` were already company-wide.
- **List queries decoupled**: Receiving's open-PO queue, Inbound Shipments' PO picker, and the Bundles list no longer filter by `selectedProjectId` — a company-wide (or any-project) PO is always visible regardless of which project happens to be selected in the sidebar.

**Migrations:** `20260802000001_procurement_decouple_projects.sql` (schema + trigger/RPC rewrites + `lot_reservations`), `20260802000002_procurement_decouple_rls.sql` (RLS on the new table). Safe to apply directly — no data existed yet in `receivings`, `bundles`, or `material_lots` at the time of this change (confirmed with the owner before writing the migration), so there was nothing to backfill into `lot_reservations`.

**Interaction with Phase 2 (§15):** §15.9's per-line-item `project_id` tagging on `purchase_orders.items` is unaffected — that's about PO cost attribution across projects, a different concern from lot ownership. §15.11 (the multi-project receiving rework) is superseded and no longer needed, since receivings carry no project at all now.
