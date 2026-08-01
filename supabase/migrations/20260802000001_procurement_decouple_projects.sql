-- ============================================================================
-- FabSimple — Decouple Procurement from Project Context
-- Removes project_id from receivings/bundles/material_lots (no data existed
-- yet in any of the three — confirmed with owner before writing this). Material
-- becomes a genuinely company-wide pool; a project only ever holds a partial,
-- releasable *claim* against a lot via the new lot_reservations table.
-- Spec: docs/procurement-material-traceability-spec.md §16
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop the bundle project-derivation trigger entirely — bundles never need
--    a project again.
-- ----------------------------------------------------------------------------
drop trigger if exists bundles_set_project_id on bundles;
drop function if exists fn_bundles_set_project_id();

-- ----------------------------------------------------------------------------
-- 2. Drop project_id from the three tables. `on delete cascade` on these FKs
--    is exactly what made deleting a project silently destroy receiving/bundle
--    history — removing the column removes that risk too.
-- ----------------------------------------------------------------------------
alter table receivings    drop column if exists project_id;
alter table bundles       drop column if exists project_id;
alter table material_lots drop column if exists project_id;

-- ----------------------------------------------------------------------------
-- 3. Simplify fn_receivings_before_insert — drop the project resolution/
--    validation entirely, keep only the qty math (remaining/backordered/
--    over-delivered), which has nothing to do with projects.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 4. Rewrite fn_assign_heat_to_bundle without p_project_id. Changing the
--    parameter list changes the function's identity, so the old overload
--    must be dropped explicitly before creating the new one.
-- ----------------------------------------------------------------------------
drop function if exists fn_assign_heat_to_bundle(uuid, uuid, uuid, text, text, numeric, text);

create or replace function fn_assign_heat_to_bundle(
  p_bundle_id      uuid,
  p_heat_number_id uuid,
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
    company_id, bundle_id, heat_number_id, lot_number,
    profile, grade, quantity, original_quantity, length, location, status
  ) values (
    v_bundle.company_id, p_bundle_id, p_heat_number_id, v_lot_number,
    p_profile, p_grade, v_bundle.quantity, v_bundle.quantity, p_length, p_location, 'available'
  )
  returning id into v_lot_id;

  update heat_numbers set parts_count = parts_count + 1 where id = p_heat_number_id;

  return v_lot_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. lot_reservations — the only place a project ever touches material. A
--    single lot can carry active reservations for multiple projects at once;
--    "available to reserve" = material_lots.quantity - sum(active reservations).
-- ----------------------------------------------------------------------------
create type reservation_status as enum ('active', 'released', 'consumed');

create table lot_reservations (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  material_lot_id   uuid not null references material_lots(id) on delete cascade,
  project_id        uuid not null references projects(id) on delete cascade,
  quantity          numeric(10,3) not null check (quantity > 0),
  status            reservation_status not null default 'active',
  reserved_by       uuid references users(id) on delete set null,
  reserved_at       timestamptz not null default now(),
  released_at       timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index lot_reservations_lot_idx on lot_reservations(material_lot_id) where status = 'active';
create index lot_reservations_project_idx on lot_reservations(project_id);
create index lot_reservations_company_idx on lot_reservations(company_id);

create trigger set_updated_at before update on lot_reservations
  for each row execute function fn_set_updated_at();

-- Defense in depth: even if a caller bypasses the API's own availability
-- check, the database refuses a reservation that would exceed what's
-- actually left on the lot. Only fires on new/growing active reservations —
-- releasing (status change away from 'active') never needs this check.
create or replace function fn_lot_reservations_before_insert() returns trigger as $$
declare
  v_lot_qty numeric;
  v_already_reserved numeric;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select quantity into v_lot_qty from material_lots where id = new.material_lot_id;
  if not found then
    raise exception 'material_lot % not found', new.material_lot_id;
  end if;

  select coalesce(sum(quantity), 0) into v_already_reserved
    from lot_reservations where material_lot_id = new.material_lot_id and status = 'active';

  if v_already_reserved + new.quantity > v_lot_qty then
    raise exception 'Cannot reserve % — only % of % remaining on this lot is unreserved',
      new.quantity, (v_lot_qty - v_already_reserved), v_lot_qty;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger lot_reservations_before_insert before insert on lot_reservations
  for each row execute function fn_lot_reservations_before_insert();
