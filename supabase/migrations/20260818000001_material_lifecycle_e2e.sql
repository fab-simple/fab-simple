-- ============================================================================
-- FabSimple — Material Lifecycle E2E (Branch: feature/material-lifecycle-e2e)
-- Adds:
--   1. material_issues         — hard-lock consumption record (immutable)
--   2. fn_receive_with_heat_splits() — atomic receiving + bundle + lot creation
--   3. v_part_traceability     — reverse chain: part → heat → lot → PO → cert
--   4. Netting columns on material_requirements
--   5. RLS for material_issues
--
-- Design principles carried from existing migrations:
--   • Append-only / void pattern (never DELETE a material_issues row)
--   • Dual-layer validation: API pre-check + DB trigger (defense in depth)
--   • material_lots is company-wide; project only ever holds a reservation
--   • Voiding returns qty to lot; consumed reservation records void_qty
-- ============================================================================

-- ============================================================================
-- 1. MATERIAL ISSUES — the hard lock / consumption record
--    Immutable once written; corrections create a void row + new row.
--    This is the backbone of the CMTR package at project closeout.
-- ============================================================================

create table material_issues (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  material_lot_id   uuid not null references material_lots(id) on delete restrict,
  -- part_id references the FabSimple `parts` table (the per-piece fabrication
  -- record). This is the equivalent of fabsimple_schema.sql's piece_marks.
  part_id           uuid not null references parts(id) on delete restrict,
  -- heat_number denormalized from the lot's heat_numbers row so the CMTR
  -- report can be generated without a join even after decades.
  heat_number       text not null,
  quantity          numeric(10,3) not null check (quantity > 0),
  issued_by         uuid references users(id) on delete set null,
  issued_at         timestamptz not null default now(),
  -- Voided = true means this row has been reversed. The reversal creates a new
  -- material_issues row to record who issued the corrected assignment.
  voided            boolean not null default false,
  void_reason       text,
  voided_by         uuid references users(id) on delete set null,
  voided_at         timestamptz,
  created_at        timestamptz not null default now()
);

create index material_issues_lot_idx     on material_issues(material_lot_id);
create index material_issues_part_idx    on material_issues(part_id);
create index material_issues_company_idx on material_issues(company_id);
create index material_issues_heat_idx    on material_issues(heat_number);
-- Partial index: only live (non-voided) issues need fast lookup by lot
create index material_issues_live_lot_idx on material_issues(material_lot_id)
  where voided = false;

-- ----------------------------------------------------------------------------
-- Trigger: on INSERT of a non-voided issue → decrement lot qty + auto-consume
-- the matching active reservation for the same project.
-- On UPDATE voided: true → false (void) → return qty to lot.
-- ----------------------------------------------------------------------------
create or replace function fn_material_issues_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_project_id uuid;
  v_res_id     uuid;
begin
  -- ── New live issue ──────────────────────────────────────────────────────
  if TG_OP = 'INSERT' and not new.voided then

    -- Decrement the lot quantity
    update material_lots
    set
      quantity = quantity - new.quantity,
      status   = case
                   when (quantity - new.quantity) <= 0 then 'consumed'::lot_status
                   else status
                 end
    where id = new.material_lot_id;

    -- Resolve the project that owns this part
    select project_id into v_project_id from parts where id = new.part_id;

    -- Consume the earliest active reservation for this lot+project (if any).
    -- Using LIMIT 1 + FOR UPDATE SKIP LOCKED is safe in a trigger because
    -- the trigger itself already holds a row lock on material_issues.
    select id into v_res_id
    from lot_reservations
    where material_lot_id = new.material_lot_id
      and project_id      = v_project_id
      and status          = 'active'
    order by created_at
    limit 1
    for update skip locked;

    if v_res_id is not null then
      update lot_reservations
      set status      = 'consumed',
          released_at = now()
      where id = v_res_id;
    end if;

  -- ── Void transition (voided flipped to true) ────────────────────────────
  elsif TG_OP = 'UPDATE' and new.voided and not old.voided then

    -- Return the quantity to the lot and restore to available if it was consumed
    update material_lots
    set
      quantity = quantity + old.quantity,
      status   = case
                   when status = 'consumed' then 'available'::lot_status
                   else status
                 end
    where id = old.material_lot_id;

  end if;

  return new;
end;
$$;

create trigger material_issues_after_change
  after insert or update of voided on material_issues
  for each row execute function fn_material_issues_after_change();

-- Guard: prevent updating heat_number or part_id once written — corrections
-- must go through the void + re-issue path, never a direct edit.
create or replace function fn_material_issues_immutable_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.material_lot_id <> old.material_lot_id
     or new.part_id       <> old.part_id
     or new.heat_number   <> old.heat_number
     or new.quantity      <> old.quantity then
    raise exception
      'material_issues rows are immutable once written. '
      'To correct a mis-issue, set voided=true + void_reason, then insert a new row.';
  end if;
  return new;
end;
$$;

create trigger material_issues_immutable
  before update on material_issues
  for each row execute function fn_material_issues_immutable_guard();

-- ============================================================================
-- 2. NETTING COLUMNS on material_requirements
--    qty_needed   = raw demand from the BOM
--    qty_netted   = portion satisfied by existing available lots
--    qty_to_order = qty_needed - qty_netted (what actually goes to a PO/RFQ)
--    Backfill: for all existing rows, needed = to_order = current quantity
-- ============================================================================

alter table material_requirements
  add column if not exists qty_needed   numeric(12,3),
  add column if not exists qty_netted   numeric(12,3) not null default 0,
  add column if not exists qty_to_order numeric(12,3);

-- Backfill existing rows so they're internally consistent
update material_requirements
set
  qty_needed   = quantity,
  qty_to_order = quantity
where qty_needed is null;

-- ============================================================================
-- 3. fn_receive_with_heat_splits — atomic receiving + N bundles + N lots
--    This collapses the 2-step "receive → bundles page → assign heat" into
--    a single server-side transaction.
--
--    p_splits is a JSONB array:
--      [{ "heat_number_id": "uuid",
--         "profile":        "W14x82",
--         "grade":          "A992",
--         "quantity":       22000,
--         "length":         null | number,
--         "location":       null | "Yard-B4" }]
--
--    Returns the receiving_id.
-- ============================================================================
create or replace function fn_receive_with_heat_splits(
  p_company_id    uuid,
  p_po_id         uuid,
  p_shipment_id   uuid,        -- can be null if no inbound_shipment row yet
  p_received_by   uuid,
  p_qty_received  numeric,
  p_exceptions    text,
  p_splits        jsonb        -- array, may be empty (zero splits = legacy path)
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_po                purchase_orders%rowtype;
  v_receiving_number  text;
  v_receiving_id      uuid;
  v_split             jsonb;
  v_bundle_number     text;
  v_bundle_id         uuid;
  v_heat_id           uuid;
begin
  -- Validate the PO belongs to this company
  select * into v_po from purchase_orders where id = p_po_id and company_id = p_company_id;
  if not found then
    raise exception 'purchase_order % not found or access denied', p_po_id;
  end if;

  -- Generate receiving number via the existing sequence RPC
  v_receiving_number := next_sequence_number(p_company_id, 'receivings', 'REC', 4);

  -- Insert the receiving header row.
  -- fn_receivings_before_insert fires automatically and computes
  -- qty_remaining_on_po / qty_backordered / qty_over_delivered.
  insert into receivings (
    company_id, po_id, inbound_shipment_id, vendor_id,
    receiving_number, qty_received, received_by, exceptions
  ) values (
    p_company_id,
    p_po_id,
    p_shipment_id,
    v_po.vendor_id,
    v_receiving_number,
    p_qty_received,
    p_received_by,
    p_exceptions
  ) returning id into v_receiving_id;

  -- For each heat split: create bundle → assign heat → lot
  for v_split in select * from jsonb_array_elements(p_splits) loop
    v_heat_id := (v_split->>'heat_number_id')::uuid;

    -- Validate the heat belongs to the company (RLS-equivalent check inside
    -- security definer function — we can't rely on RLS here)
    if not exists (
      select 1 from heat_numbers where id = v_heat_id and company_id = p_company_id
    ) then
      raise exception 'heat_number % not found or access denied', v_heat_id;
    end if;

    -- Create the bundle linked to this receiving event
    v_bundle_number := next_sequence_number(p_company_id, 'bundles', 'BND', 4);

    insert into bundles (
      company_id, receiving_id, bundle_number,
      quantity, heat_number_id, storage_location
    ) values (
      p_company_id,
      v_receiving_id,
      v_bundle_number,
      (v_split->>'quantity')::numeric,
      v_heat_id,
      v_split->>'location'
    ) returning id into v_bundle_id;

    -- Assign heat → creates the material_lot row
    perform fn_assign_heat_to_bundle(
      v_bundle_id,
      v_heat_id,
      v_split->>'profile',
      v_split->>'grade',
      case when v_split->>'length' is not null
           then (v_split->>'length')::numeric
           else null end,
      v_split->>'location'
    );
  end loop;

  return v_receiving_id;
end;
$$;

-- ============================================================================
-- 4. v_part_traceability — read-only reverse chain
--    Given any part_id, walk all the way back to the mill certificate.
--    Uses FabSimple's actual table names (parts / material_lots / bundles /
--    receivings / heat_numbers) rather than the spec-doc aliases.
-- ============================================================================
create or replace view v_part_traceability as
select
  p.id                        as part_id,
  p.mark                      as part_mark,
  p.name                      as part_name,
  p.profile,
  p.project_id,
  proj.name                   as project_name,
  proj.number                 as project_number,
  mi.id                       as issue_id,
  mi.heat_number,
  mi.quantity                 as qty_consumed,
  mi.issued_at,
  mi.voided,
  ml.id                       as lot_id,
  ml.lot_number,
  ml.profile                  as lot_profile,
  ml.grade                    as lot_grade,
  ml.location                 as bin_location,
  h.id                        as heat_number_id,
  h.status                    as heat_availability_status,
  h.mtr_status,
  b.id                        as bundle_id,
  b.bundle_number,
  rcv.id                      as receiving_id,
  rcv.receiving_number,
  rcv.received_at             as received_date,
  po.id                       as po_id,
  po.po_number,
  v.id                        as vendor_id,
  v.name                      as vendor_name,
  -- Mill cert from mtr_documents (one per heat, joined via heat_number_id)
  mtr.id                      as mtr_doc_id,
  mtr.mill_name,
  mtr.ocr_status              as mtr_ocr_status,
  fa.file_url                 as mill_cert_url
from parts p
join projects proj             on proj.id = p.project_id
join material_issues mi        on mi.part_id = p.id
join material_lots ml          on ml.id = mi.material_lot_id
join heat_numbers h            on h.id = ml.heat_number_id
left join bundles b            on b.id = ml.bundle_id
left join receivings rcv       on rcv.id = b.receiving_id
left join purchase_orders po   on po.id = rcv.po_id
left join vendors v            on v.id = po.vendor_id
left join mtr_documents mtr    on mtr.heat_number_id = h.id
left join file_attachments fa  on fa.id = mtr.file_attachment_id;

-- ============================================================================
-- 5. RLS — material_issues
--    Same pattern as every other procurement table:
--      company_id = get_user_company_id()
--    QC can read all issues; foreman/PM can issue; only owner can void.
-- ============================================================================

alter table material_issues enable row level security;

-- SELECT: anyone who can read material_lots can also read issues (same audience)
create policy material_issues_select on material_issues
  for select
  using (company_id = get_user_company_id());

-- INSERT: pm, foreman, qc can issue material
create policy material_issues_insert on material_issues
  for insert
  with check (
    company_id = get_user_company_id()
    and get_user_role() in ('owner', 'pm', 'foreman', 'qc')
  );

-- UPDATE: restricted to voiding only — and only owner/pm may void
-- (immutable guard trigger prevents editing anything else)
create policy material_issues_update on material_issues
  for update
  using (company_id = get_user_company_id())
  with check (
    company_id = get_user_company_id()
    and get_user_role() in ('owner', 'pm')
  );

-- DELETE: never (immutability enforced at policy layer as well as trigger)
-- No delete policy → no deletes.
