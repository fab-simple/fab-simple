-- ============================================================================
-- FabSimple — Procurement & Material Traceability, Phase 1
-- Adds: vendors, inbound_shipments, receivings, bundles, material_lots,
--       mtr_documents. Alters: purchase_orders, heat_numbers, parts.
-- Spec: docs/procurement-material-traceability-spec.md §6
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type vendor_status            as enum ('active','inactive','blacklisted');
create type po_confirmation_status   as enum ('pending','confirmed','delayed','rejected');
create type inbound_shipment_status  as enum ('scheduled','shipped','in_transit','arrived','received');
create type lot_status               as enum ('available','reserved','released','consumed','scrapped');
create type heat_availability_status as enum ('available','quarantine');
create type mtr_ocr_status           as enum ('pending','extracted','manual_review','verified');

-- ----------------------------------------------------------------------------
-- vendors — new master table (§6.2)
-- ----------------------------------------------------------------------------
create table vendors (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  name            text not null,
  contact_name    text,
  email           text,
  phone           text,
  address         text,
  payment_terms   text,
  status          vendor_status not null default 'active',
  preferred       boolean not null default false,
  notes           text,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index vendors_company_name_idx on vendors(company_id, name);
create index vendors_company_idx on vendors(company_id);

create trigger set_updated_at before update on vendors
  for each row execute function fn_set_updated_at();

-- Note: vendor_performance view is defined further below, after both
-- purchase_orders.vendor_id and the receivings table exist — it depends on
-- both. (An earlier draft of this migration declared it here, before either
-- dependency existed, and failed on first deploy; fixed by moving it.)

-- ----------------------------------------------------------------------------
-- purchase_orders — alterations (§6.3)
-- ----------------------------------------------------------------------------
alter table purchase_orders
  add column vendor_id           uuid references vendors(id) on delete set null,
  add column confirmation_status po_confirmation_status not null default 'pending',
  add column confirmed_qty       numeric(10,2),
  add column confirmed_date      date,
  add column mill_name           text,
  add column rolling_schedule    text;

create index po_vendor_idx on purchase_orders(vendor_id);

-- ----------------------------------------------------------------------------
-- inbound_shipments — vendor -> shop (§6.4). Distinct from shipping_tickets,
-- which is shop -> jobsite (outbound).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- receivings — discrete, auditable delivery events (§6.5). Replaces the old
-- pattern of PATCHing purchase_orders.qty_received directly.
-- ----------------------------------------------------------------------------
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

-- Read-only vendor rollup, not a write path (§6.2). Placed here — the first
-- point in the file where both purchase_orders.vendor_id and receivings exist.
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

-- BEFORE INSERT prep: (1) denormalize project_id from the PO so receivings
-- can be filtered by the Global Project Context without a join on every list
-- query, and (2) compute remaining/backordered/over-delivered quantities
-- server-side (Module 7: "System calculates...") so the client can't drift
-- from the PO's actual qty_ordered.
create or replace function fn_receivings_before_insert() returns trigger as $$
declare
  v_po purchase_orders%rowtype;
  v_already_received numeric;
  v_ordered numeric;
  v_would_be_total numeric;
begin
  select * into v_po from purchase_orders where id = new.po_id;
  if not found then
    raise exception 'purchase_order % not found', new.po_id;
  end if;

  if new.project_id is null then
    new.project_id := v_po.project_id;
  end if;
  if new.project_id is null then
    raise exception 'Cannot create a receiving for a purchase order with no project_id — set the PO''s project first';
  end if;

  select coalesce(sum(qty_received), 0) into v_already_received
    from receivings where po_id = new.po_id;

  v_ordered := coalesce(v_po.qty_ordered, 0);
  v_would_be_total := v_already_received + new.qty_received;

  new.qty_remaining_on_po := greatest(v_ordered - v_would_be_total, 0);
  new.qty_backordered := greatest(v_ordered - v_would_be_total, 0);
  new.qty_over_delivered := greatest(v_would_be_total - v_ordered, 0);

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger receivings_before_insert before insert on receivings
  for each row execute function fn_receivings_before_insert();

-- Rollup trigger: recompute purchase_orders.qty_received/status from the sum
-- of receivings whenever a receiving is inserted, corrected, or removed.
-- Reverts to 'issued' if every receiving against a PO is deleted so the
-- status can't get stuck on 'partial' with zero material actually received.
create or replace function fn_recompute_po_receiving() returns trigger as $$
declare
  v_po purchase_orders%rowtype;
  v_total_received numeric;
begin
  select * into v_po from purchase_orders where id = coalesce(new.po_id, old.po_id);
  if not found then
    return coalesce(new, old);
  end if;

  select coalesce(sum(qty_received), 0) into v_total_received
    from receivings where po_id = v_po.id;

  update purchase_orders set
    qty_received = v_total_received,
    status = case
      when v_po.qty_ordered is not null and v_total_received >= v_po.qty_ordered then 'received'::po_status
      when v_total_received > 0 then 'partial'::po_status
      when v_po.status in ('partial','received') then 'issued'::po_status
      else v_po.status
    end,
    received_date = case
      when v_po.qty_ordered is not null and v_total_received >= v_po.qty_ordered then current_date
      else received_date
    end
  where id = v_po.id;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create trigger recompute_po_on_receiving
  after insert or update or delete on receivings
  for each row execute function fn_recompute_po_receiving();

-- ----------------------------------------------------------------------------
-- bundles (§6.6)
-- ----------------------------------------------------------------------------
create table bundles (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  receiving_id      uuid not null references receivings(id) on delete cascade,
  project_id        uuid not null references projects(id) on delete cascade,
  bundle_number     text not null,
  quantity          numeric(10,2) not null,
  storage_location  text,
  heat_number_id    uuid references heat_numbers(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index bundles_company_num_idx on bundles(company_id, bundle_number);
create index bundles_receiving_idx on bundles(receiving_id);
create index bundles_heat_idx on bundles(heat_number_id) where heat_number_id is not null;

create trigger set_updated_at before update on bundles
  for each row execute function fn_set_updated_at();

create or replace function fn_bundles_set_project_id() returns trigger as $$
begin
  if new.project_id is null then
    select project_id into new.project_id from receivings where id = new.receiving_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger bundles_set_project_id before insert on bundles
  for each row execute function fn_bundles_set_project_id();

-- ----------------------------------------------------------------------------
-- heat_numbers — alterations (§6.7). Tracks material *availability*
-- (available/quarantine), separate from mtr_status which tracks the document.
-- ----------------------------------------------------------------------------
alter table heat_numbers
  add column status heat_availability_status not null default 'available';

-- ----------------------------------------------------------------------------
-- material_lots — the Material + Grade + Heat + Lot inventory unit (§6.7).
-- Additive to the existing bulk `inventory` table, not a replacement — see
-- Design Decision 2 in the spec.
-- ----------------------------------------------------------------------------
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

-- Heat assignment RPC (Module 9's "Bundle -> Heat -> Lot" action). Mirrors
-- the existing next_sequence_number() RPC style. Takes profile/grade as
-- explicit parameters (from the bundle-registration form) rather than
-- inferring them from the PO's JSONB line items, since a PO can carry
-- multiple line items.
create or replace function fn_assign_heat_to_bundle(
  p_bundle_id      uuid,
  p_heat_number_id uuid,
  p_project_id     uuid,
  p_profile        text,
  p_grade          text,
  p_length         numeric default null,
  p_location       text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_bundle bundles%rowtype;
  v_lot_number text;
  v_lot_id uuid;
begin
  select * into v_bundle from bundles where id = p_bundle_id;
  if not found then
    raise exception 'bundle % not found', p_bundle_id;
  end if;

  update bundles set heat_number_id = p_heat_number_id where id = p_bundle_id;

  v_lot_number := next_sequence_number(v_bundle.company_id, 'material_lots', 'LOT', 4);

  insert into material_lots (
    company_id, project_id, bundle_id, heat_number_id, lot_number,
    profile, grade, quantity, original_quantity, length, location, status
  ) values (
    v_bundle.company_id, p_project_id, p_bundle_id, p_heat_number_id, v_lot_number,
    p_profile, p_grade, v_bundle.quantity, v_bundle.quantity, p_length, p_location, 'available'
  )
  returning id into v_lot_id;

  update heat_numbers set parts_count = parts_count + 1 where id = p_heat_number_id;

  return v_lot_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- mtr_documents (§6.8) + quarantine automation
-- ----------------------------------------------------------------------------
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

-- Quarantine trigger. A heat is 'available' only once at least one of its
-- MTR documents has been human-verified (ocr_status='verified'); an
-- 'extracted' (OCR-only, unverified) document does NOT lift quarantine.
-- This is what keeps a wrong OCR read from ever releasing material into
-- fabrication on its own.
create or replace function fn_sync_heat_quarantine() returns trigger as $$
declare
  v_heat_id uuid := coalesce(new.heat_number_id, old.heat_number_id);
  v_has_verified boolean;
  v_has_any boolean;
begin
  select exists(select 1 from mtr_documents where heat_number_id = v_heat_id and ocr_status = 'verified')
    into v_has_verified;
  select exists(select 1 from mtr_documents where heat_number_id = v_heat_id)
    into v_has_any;

  update heat_numbers set
    status = case when v_has_verified then 'available'::heat_availability_status
                  else 'quarantine'::heat_availability_status end,
    mtr_status = case
      when v_has_verified then 'verified'::mtr_status
      when v_has_any then 'received'::mtr_status
      else 'pending'::mtr_status
    end
  where id = v_heat_id;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create trigger sync_heat_quarantine
  after insert or update or delete on mtr_documents
  for each row execute function fn_sync_heat_quarantine();

-- ----------------------------------------------------------------------------
-- parts — traceability FK (§6.9)
-- ----------------------------------------------------------------------------
alter table parts add column material_lot_id uuid references material_lots(id) on delete set null;
create index parts_lot_idx on parts(material_lot_id) where material_lot_id is not null;

-- Keep the existing free-text parts.heat_number column working as a
-- denormalized display cache so no existing UI/query needs to change.
create or replace function fn_sync_part_heat_number() returns trigger as $$
begin
  if new.material_lot_id is distinct from old.material_lot_id and new.material_lot_id is not null then
    select h.heat_number into new.heat_number
    from material_lots l join heat_numbers h on h.id = l.heat_number_id
    where l.id = new.material_lot_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger parts_sync_heat_number before update of material_lot_id on parts
  for each row execute function fn_sync_part_heat_number();
