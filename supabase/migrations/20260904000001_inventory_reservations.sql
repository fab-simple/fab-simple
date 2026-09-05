-- ============================================================================
-- FabSimple — Bulk Inventory Reservation
--
-- Mirrors the lot_reservations system (20260802000001) for traceable lots,
-- but applies to the bulk `inventory` table (non-traceable stock).
--
-- Problem solved: two PMs from different projects creating RFQs against the
-- same bulk stock both see the same raw `quantity` and double-count it.
--
-- Solution: inventory_reservations tracks how much of each inventory row is
-- "spoken for" by open RFQs.
--   available = inventory.quantity − Σ active inventory_reservations.quantity
--
-- Lifecycle:
--   RFQ created  → reservations inserted (status = 'active')
--   RFQ awarded  → reservations → 'consumed'  (PO takes over)
--   RFQ cancelled→ reservations → 'released'  (auto-trigger on rfqs.status)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. inventory_reservations table
--    Reuses the existing reservation_status enum ('active','released','consumed')
--    defined in 20260802000001_procurement_decouple_projects.sql.
-- ----------------------------------------------------------------------------
create table inventory_reservations (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  inventory_id    uuid not null references inventory(id) on delete cascade,
  -- rfq_id is nullable so ON DELETE SET NULL keeps the row when an RFQ is
  -- hard-deleted (instead of orphaning it). The trigger below also releases
  -- when rfq status flips to 'cancelled'.
  rfq_id          uuid references rfqs(id) on delete set null,
  -- project_id denormalised from the MR attached to the rfq_line so the
  -- Inventory page can show "reserved by Project X via RFQ-042" without a
  -- multi-join on every read.
  project_id      uuid references projects(id) on delete set null,
  quantity        numeric(10,2) not null check (quantity > 0),
  status          reservation_status not null default 'active',
  reserved_by     uuid references users(id) on delete set null,
  reserved_at     timestamptz not null default now(),
  released_at     timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Partial index: only active reservations matter for availability math
create index inventory_reservations_inv_active_idx
  on inventory_reservations(inventory_id)
  where status = 'active';

create index inventory_reservations_rfq_idx  on inventory_reservations(rfq_id);
create index inventory_reservations_co_idx   on inventory_reservations(company_id);
create index inventory_reservations_proj_idx on inventory_reservations(project_id);

create trigger set_updated_at before update on inventory_reservations
  for each row execute function fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Defense-in-depth trigger: refuse a reservation that would exceed what's
--    physically in stock. Mirrors fn_lot_reservations_before_insert exactly.
-- ----------------------------------------------------------------------------
create or replace function fn_inventory_reservations_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_inv_qty        numeric;
  v_already_reserved numeric;
begin
  -- Only enforce on new active reservations; releasing never needs this check.
  if new.status <> 'active' then
    return new;
  end if;

  select quantity into v_inv_qty from inventory where id = new.inventory_id;
  if not found then
    raise exception 'inventory row % not found', new.inventory_id;
  end if;

  select coalesce(sum(quantity), 0) into v_already_reserved
    from inventory_reservations
   where inventory_id = new.inventory_id and status = 'active';

  if v_already_reserved + new.quantity > v_inv_qty then
    raise exception
      'Cannot reserve % — only % of % is unreserved on this inventory row',
      new.quantity, (v_inv_qty - v_already_reserved), v_inv_qty;
  end if;

  return new;
end;
$$;

create trigger inventory_reservations_before_insert
  before insert on inventory_reservations
  for each row execute function fn_inventory_reservations_before_insert();

-- ----------------------------------------------------------------------------
-- 3. Auto-release trigger: when an RFQ is cancelled, release all its active
--    inventory reservations in the same transaction. Mirrors how
--    fn_rfq_lines_after_insert auto-flips MR status when a line lands.
-- ----------------------------------------------------------------------------
create or replace function fn_rfq_release_inventory_reservations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only fires when status transitions TO 'cancelled'
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update inventory_reservations
       set status      = 'released',
           released_at = now()
     where rfq_id = new.id
       and status  = 'active';
  end if;
  return new;
end;
$$;

create trigger rfq_release_inventory_on_cancel
  after update of status on rfqs
  for each row execute function fn_rfq_release_inventory_reservations();

-- ----------------------------------------------------------------------------
-- 4. fn_create_rfq — replace to include inventory reservation creation.
--    Still one atomic transaction: header + lines + vendors + reservations.
--
--    For each rfq_line:
--      a) Find the inventory row matching (profile, name, grade, length) from
--         the referenced material_requirement.
--      b) Compute how much of that is still unreserved.
--      c) Reserve min(unreserved, rfq_line.quantity) — partial coverage is
--         fine; zero coverage means no reservation row (no error).
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
  v_rfq_id      uuid;
  v_line        jsonb;
  v_mr          record;
  v_inv         record;
  v_already_res numeric;
  v_available   numeric;
  v_to_reserve  numeric;
begin
  -- ── RFQ header ────────────────────────────────────────────────────────────
  insert into rfqs (company_id, rfq_number, delivery_requirement, notes, created_by)
  values (p_company_id, p_rfq_number, p_delivery_requirement, p_notes, p_created_by)
  returning id into v_rfq_id;

  -- ── Lines ─────────────────────────────────────────────────────────────────
  insert into rfq_lines (company_id, rfq_id, material_requirement_id, quantity)
  select p_company_id, v_rfq_id, (l->>'material_requirement_id')::uuid, (l->>'quantity')::numeric
  from jsonb_array_elements(p_lines) l;

  -- ── Vendors ───────────────────────────────────────────────────────────────
  insert into rfq_vendors (company_id, rfq_id, vendor_id)
  select p_company_id, v_rfq_id, vid from unnest(p_vendor_ids) as vid;

  -- ── Inventory reservations ────────────────────────────────────────────────
  -- For each line, look up the MR to get profile/name/grade/length, then
  -- find the matching inventory row and reserve as much as is available.
  for v_line in select * from jsonb_array_elements(p_lines) loop

    -- Fetch the MR
    select profile, name, grade, length, project_id
      into v_mr
      from material_requirements
     where id = (v_line->>'material_requirement_id')::uuid;

    if not found then
      continue; -- safety; the API already validated mr IDs exist
    end if;

    -- Find matching inventory row.
    -- Match key: profile + name + length — exactly the same triple the
    -- frontend's invKey() uses. Grade is intentionally excluded: MRs and
    -- inventory rows are often imported from different source systems that
    -- format grade differently (e.g. "A992" vs "A-992"). The frontend groups
    -- all grade variants for the same profile+name+length together, so the
    -- SQL must do the same or reservations will be silently skipped.
    -- Take the row with the most unreserved quantity (best-bin-first heuristic).
    select inv.id, inv.quantity
      into v_inv
      from inventory inv
     where inv.company_id = p_company_id
       and lower(trim(inv.profile))                  = lower(trim(coalesce(v_mr.profile, '')))
       and lower(trim(coalesce(inv.name,   ''))) = lower(trim(coalesce(v_mr.name,   '')))
       and lower(trim(coalesce(inv.length, ''))) = lower(trim(coalesce(v_mr.length, '')))
       and inv.quantity > 0
     order by inv.quantity desc
     limit 1;

    if not found then
      continue; -- no stock for this material — nothing to reserve
    end if;

    -- How much is already reserved on this inventory row?
    select coalesce(sum(quantity), 0) into v_already_res
      from inventory_reservations
     where inventory_id = v_inv.id and status = 'active';

    v_available  := greatest(v_inv.quantity - v_already_res, 0);
    v_to_reserve := least(v_available, (v_line->>'quantity')::numeric);

    if v_to_reserve <= 0 then
      continue; -- fully reserved by prior RFQs — nothing left to claim
    end if;

    insert into inventory_reservations (
      company_id, inventory_id, rfq_id, project_id,
      quantity, reserved_by, notes
    ) values (
      p_company_id, v_inv.id, v_rfq_id, v_mr.project_id,
      v_to_reserve, p_created_by,
      'Auto-reserved when RFQ ' || p_rfq_number || ' was created'
    );

  end loop;

  return v_rfq_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. fn_award_vendor_quote — replace to consume inventory reservations.
--    On award, mark every active inventory_reservation for this RFQ as
--    'consumed'. The PO + receiving flow tracks the inbound delivery from
--    this point; the reservation has served its purpose.
-- ----------------------------------------------------------------------------
create or replace function fn_award_vendor_quote(p_vendor_quote_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_quote      vendor_quotes%rowtype;
  v_company_id uuid;
  v_po_number  text;
  v_items      jsonb;
  v_total_qty  numeric;
  v_po_id      uuid;
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

  -- Consume all active inventory reservations for this RFQ.
  -- The PO + receiving workflow now owns the inbound tracking.
  update inventory_reservations
     set status      = 'consumed',
         released_at = now()
   where rfq_id = v_quote.rfq_id
     and status  = 'active';

  return v_po_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS — same simple company_id = get_user_company_id() pattern.
--    PM/owner/accounting write; all company members can read.
-- ----------------------------------------------------------------------------
alter table inventory_reservations enable row level security;
alter table inventory_reservations force row level security;

create policy inventory_reservations_select on inventory_reservations
  for select using (company_id = get_user_company_id());

create policy inventory_reservations_write on inventory_reservations
  for all
  using  (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting'))
  with check (company_id = get_user_company_id());
