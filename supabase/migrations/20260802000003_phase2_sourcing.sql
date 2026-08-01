-- ============================================================================
-- FabSimple — Procurement & Material Traceability, Phase 2 — Sourcing Workflow
-- Adds: material_requirements, rfqs, rfq_lines, rfq_vendors, vendor_quotes,
--       vendor_quote_lines. Alters: purchase_orders (rfq_id).
-- Spec: docs/procurement-material-traceability-spec.md §15
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type material_requirement_status as enum ('open', 'rfq_created', 'awarded', 'fulfilled', 'cancelled');
create type rfq_status                  as enum ('draft', 'sent', 'quotes_received', 'awarded', 'cancelled');
create type quote_status                as enum ('pending', 'submitted', 'awarded', 'rejected', 'expired');

-- ----------------------------------------------------------------------------
-- material_requirements (Module 1) — project-scoped. No linkage to `parts`
-- (§15.1 D10): a standalone quantity/grade/profile record.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- rfqs (Module 2) — deliberately NO project_id (§15.1 D14). This is the one
-- table in the whole module that doesn't inherit a single project: its entire
-- purpose is letting a PM shop requirements from several projects to the same
-- vendor in one ask. Project attribution lives on each rfq_line via its MR.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- rfq_lines — RFQ <-> Material Requirement, many-to-many with a quantity
-- snapshot (an MR can in principle be split across two RFQs). Carries its own
-- company_id (deviation from the original draft) so RLS stays the same
-- simple `company_id = get_user_company_id()` shape used everywhere else in
-- this schema, instead of an EXISTS-subquery policy against the parent RFQ.
-- ----------------------------------------------------------------------------
create table rfq_lines (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null references companies(id) on delete cascade,
  rfq_id                    uuid not null references rfqs(id) on delete cascade,
  material_requirement_id   uuid not null references material_requirements(id) on delete restrict,
  quantity                  numeric(10,2) not null,
  created_at                timestamptz not null default now()
);
create unique index rfq_lines_unique_idx on rfq_lines(rfq_id, material_requirement_id);
create index rfq_lines_mr_idx on rfq_lines(material_requirement_id);

-- Flips the referenced MR to 'rfq_created' the moment it's put on an RFQ —
-- rollup-trigger philosophy, same as Phase 1's fn_recompute_po_receiving.
create or replace function fn_rfq_lines_after_insert() returns trigger as $$
begin
  update material_requirements
    set status = 'rfq_created'
    where id = new.material_requirement_id and status = 'open';
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger rfq_lines_after_insert after insert on rfq_lines
  for each row execute function fn_rfq_lines_after_insert();

-- ----------------------------------------------------------------------------
-- rfq_vendors — which vendors this RFQ was sent to. Needed even without email
-- automation (§15.1 D11): this is what "track vendor responses" means here —
-- the RFQ detail page shows invited-vs-responded.
-- ----------------------------------------------------------------------------
create table rfq_vendors (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  rfq_id      uuid not null references rfqs(id) on delete cascade,
  vendor_id   uuid not null references vendors(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create unique index rfq_vendors_unique_idx on rfq_vendors(rfq_id, vendor_id);

-- ----------------------------------------------------------------------------
-- vendor_quotes (Module 3) — one per vendor per RFQ.
-- ----------------------------------------------------------------------------
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

-- Flips the RFQ to 'quotes_received' the moment its first quote arrives.
-- Never overwrites a terminal status (awarded/cancelled) — only advances
-- draft/sent forward, matching the append-only rollup philosophy elsewhere.
create or replace function fn_vendor_quotes_after_insert() returns trigger as $$
begin
  update rfqs
    set status = 'quotes_received'
    where id = new.rfq_id and status in ('draft', 'sent');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger vendor_quotes_after_insert after insert on vendor_quotes
  for each row execute function fn_vendor_quotes_after_insert();

-- ----------------------------------------------------------------------------
-- vendor_quote_lines — per-material-line pricing. A vendor prices each
-- material line separately (a mill quotes W14x82 and W24x68 at different
-- $/lb), hence header + lines rather than one flat price.
-- ----------------------------------------------------------------------------
create table vendor_quote_lines (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id) on delete cascade,
  vendor_quote_id    uuid not null references vendor_quotes(id) on delete cascade,
  rfq_line_id        uuid not null references rfq_lines(id) on delete cascade,
  unit_price         numeric(10,2) not null,
  mill_name          text,
  rolling_schedule   text,
  created_at         timestamptz not null default now()
);
create unique index vendor_quote_lines_unique_idx on vendor_quote_lines(vendor_quote_id, rfq_line_id);

-- ----------------------------------------------------------------------------
-- purchase_orders — further alteration for Phase 2. `items` JSONB gains
-- optional unit_price/project_id/material_requirement_id per line — additive,
-- backward-compatible (existing rows simply never populate them), so no data
-- migration is needed for the JSONB shape itself.
-- ----------------------------------------------------------------------------
alter table purchase_orders
  add column rfq_id uuid references rfqs(id) on delete set null;

create index po_rfq_idx on purchase_orders(rfq_id);

-- ----------------------------------------------------------------------------
-- fn_create_rfq — atomic compound create (header + lines + vendors). Mirrors
-- fn_assign_heat_to_bundle's security-definer, multi-table-in-one-transaction
-- pattern so POST /rfqs is genuinely atomic rather than a sequence of client
-- round-trips that could leave an orphaned header on partial failure.
-- p_lines is a jsonb array of { material_requirement_id, quantity }.
-- ----------------------------------------------------------------------------
create or replace function fn_create_rfq(
  p_company_id            uuid,
  p_rfq_number            text,
  p_delivery_requirement  text,
  p_notes                 text,
  p_lines                 jsonb,
  p_vendor_ids            uuid[],
  p_created_by            uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_rfq_id uuid;
begin
  insert into rfqs (company_id, rfq_number, delivery_requirement, notes, created_by)
  values (p_company_id, p_rfq_number, p_delivery_requirement, p_notes, p_created_by)
  returning id into v_rfq_id;

  insert into rfq_lines (company_id, rfq_id, material_requirement_id, quantity)
  select p_company_id, v_rfq_id, (l->>'material_requirement_id')::uuid, (l->>'quantity')::numeric
  from jsonb_array_elements(p_lines) l;

  insert into rfq_vendors (company_id, rfq_id, vendor_id)
  select p_company_id, v_rfq_id, vid from unnest(p_vendor_ids) as vid;

  return v_rfq_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_create_vendor_quote — same atomic-compound-create shape for a quote
-- header + its per-line pricing. p_lines is a jsonb array of
-- { rfq_line_id, unit_price, mill_name, rolling_schedule }.
-- ----------------------------------------------------------------------------
create or replace function fn_create_vendor_quote(
  p_company_id       uuid,
  p_rfq_id           uuid,
  p_vendor_id        uuid,
  p_lead_time_days   integer,
  p_freight_cost     numeric,
  p_validity_date    date,
  p_notes            text,
  p_lines            jsonb,
  p_created_by       uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_quote_id uuid;
begin
  insert into vendor_quotes (
    company_id, rfq_id, vendor_id, status, lead_time_days, freight_cost, validity_date, notes, created_by
  ) values (
    p_company_id, p_rfq_id, p_vendor_id, 'submitted', p_lead_time_days, p_freight_cost, p_validity_date, p_notes, p_created_by
  ) returning id into v_quote_id;

  insert into vendor_quote_lines (company_id, vendor_quote_id, rfq_line_id, unit_price, mill_name, rolling_schedule)
  select
    p_company_id, v_quote_id, (l->>'rfq_line_id')::uuid, (l->>'unit_price')::numeric,
    l->>'mill_name', l->>'rolling_schedule'
  from jsonb_array_elements(p_lines) l;

  return v_quote_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- fn_award_vendor_quote (Module 3's "Award Vendor" action) — atomic,
-- read-then-write across many tables in one transaction, same shape as
-- fn_assign_heat_to_bundle. Creates a draft PO fully pre-filled from the
-- winning quote's lines, rejects sibling quotes, and marks the RFQ/MRs
-- awarded — no client-side multi-step orchestration, no partial-award race.
-- ----------------------------------------------------------------------------
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
  if not found then
    raise exception 'vendor_quote % not found', p_vendor_quote_id;
  end if;
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
