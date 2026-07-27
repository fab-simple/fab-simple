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
