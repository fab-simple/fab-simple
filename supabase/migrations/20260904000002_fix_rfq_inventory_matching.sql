-- ============================================================================
-- Fix fn_create_rfq inventory matching: profile + length only.
--
-- The previous version (20260904000001) matched on profile + name + grade +
-- length. This caused most MRs to silently skip reservation because:
--   1. name: MRs frequently have name=NULL while inventory has name='W-BEAM'
--   2. grade: formatting differs between systems (A992 vs A-992 vs A36)
--
-- New matching key: profile + length only — the two fields that are always
-- populated and consistently formatted in both tables. This mirrors how a
-- fab shop actually thinks: "Do I have W14x82 at 26'-9" in stock?" regardless
-- of grade designation or member name label.
-- ============================================================================

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

  -- ── Inventory reservations ─────────────────────────────────────────────────
  -- For each RFQ line: look up the MR, find matching bulk stock by
  -- profile + length only, and reserve as much of it as is available.
  --
  -- Matching key: profile + length
  --   • profile: always populated in both tables, consistently formatted
  --   • length: the cut-length — if the same cut is in stock, reserve it
  --   • name excluded: MRs often have name=NULL; inventory may have 'W-BEAM'
  --   • grade excluded: formatting varies across import sources (A992/A-992)
  --
  -- Partial coverage is fine — if only 10 of 30 are in stock, reserve 10.
  -- Zero coverage (no matching inventory) means no reservation row — not an error.
  for v_line in select * from jsonb_array_elements(p_lines) loop

    -- Resolve the MR for this line
    select profile, length, project_id
      into v_mr
      from material_requirements
     where id = (v_line->>'material_requirement_id')::uuid;

    if not found then
      continue; -- API already validated MR IDs; skip defensively
    end if;

    -- Find the best matching bulk-inventory row.
    -- "Best" = most unreserved quantity (deplete the fullest bin first).
    select inv.id, inv.quantity
      into v_inv
      from inventory inv
     where inv.company_id = p_company_id
       -- profile: exact case-insensitive, trimmed match
       and lower(trim(inv.profile))             = lower(trim(coalesce(v_mr.profile, '')))
       -- length: same case-insensitive match; both columns are text
       and lower(trim(coalesce(inv.length, ''))) = lower(trim(coalesce(v_mr.length, '')))
       and inv.quantity > 0
     order by inv.quantity desc
     limit 1;

    if not found then
      continue; -- no bulk stock for this profile+length — nothing to reserve
    end if;

    -- How much is already spoken for by other open RFQs?
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
      p_company_id,
      v_inv.id,
      v_rfq_id,
      v_mr.project_id,
      v_to_reserve,
      p_created_by,
      'Auto-reserved when RFQ ' || p_rfq_number || ' was created'
    );

  end loop;

  return v_rfq_id;
end;
$$;
