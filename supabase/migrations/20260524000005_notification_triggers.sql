-- ============================================================================
-- Notification fan-out triggers
-- Writes into the notifications table whenever a noteworthy event occurs.
-- Roles targeted per event follow least-surprise: NCR → QC + PM + Owner,
-- PO arrival → Foreman + PM, cert expiry → Owner + holder, etc.
-- ============================================================================

create or replace function fn_notify_roles(
  p_company_id uuid,
  p_roles text[],
  p_type notification_type,
  p_title text,
  p_message text,
  p_entity_type text,
  p_entity_id uuid,
  p_link text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (company_id, user_id, type, title, message, entity_type, entity_id, entity_link)
  select p_company_id, u.id, p_type, p_title, p_message, p_entity_type, p_entity_id, p_link
  from users u
  where u.company_id = p_company_id
    and u.is_active = true
    and u.role::text = any(p_roles);
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. NCR created → QC + PM + Owner
-- ----------------------------------------------------------------------------
create or replace function fn_notify_ncr_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform fn_notify_roles(
    new.company_id,
    array['qc','pm','owner'],
    'ncr_created'::notification_type,
    'New NCR: ' || new.ncr_number,
    coalesce(new.description, 'Non-conformance report opened'),
    'ncr_reports', new.id,
    '/dashboard/paint-inspection'
  );
  return new;
end;
$$;
drop trigger if exists trg_notify_ncr_created on ncr_reports;
create trigger trg_notify_ncr_created
  after insert on ncr_reports
  for each row execute function fn_notify_ncr_created();

-- ----------------------------------------------------------------------------
-- 2. PO received → Foreman + PM
-- ----------------------------------------------------------------------------
create or replace function fn_notify_po_received()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'received' and (old.status is null or old.status <> 'received') then
    perform fn_notify_roles(
      new.company_id,
      array['foreman','pm','owner'],
      'info'::notification_type,
      'PO received: ' || new.po_number,
      'Material from ' || coalesce(new.vendor_name, 'vendor') || ' arrived',
      'purchase_orders', new.id,
      '/dashboard/receiving'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_po_received on purchase_orders;
create trigger trg_notify_po_received
  after update on purchase_orders
  for each row execute function fn_notify_po_received();

-- ----------------------------------------------------------------------------
-- 3. Inspection failure → QC + PM
-- ----------------------------------------------------------------------------
create or replace function fn_notify_inspection_failed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  label text;
begin
  if new.result <> 'fail' then return new; end if;
  if tg_table_name = 'paint_inspections' then label := new.insp_number;
  else label := new.weld_number;
  end if;

  perform fn_notify_roles(
    new.company_id,
    array['qc','pm'],
    'qc_failure'::notification_type,
    'Inspection failed: ' || label,
    'Auto-NCR will be opened',
    tg_table_name, new.id,
    '/dashboard/' || replace(tg_table_name, '_', '-')
  );
  return new;
end;
$$;
drop trigger if exists trg_notify_paint_failed on paint_inspections;
create trigger trg_notify_paint_failed
  after insert on paint_inspections
  for each row execute function fn_notify_inspection_failed();
drop trigger if exists trg_notify_weld_failed on weld_inspections;
create trigger trg_notify_weld_failed
  after insert on weld_inspections
  for each row execute function fn_notify_inspection_failed();

-- ----------------------------------------------------------------------------
-- 4. Change order approved → PM + Estimator + Accounting
-- ----------------------------------------------------------------------------
create or replace function fn_notify_co_approved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (old.status is null or old.status <> 'approved') then
    perform fn_notify_roles(
      new.company_id,
      array['pm','estimator','accounting','owner'],
      'co_approved'::notification_type,
      'CO approved: ' || new.co_number,
      'Amount $' || coalesce(new.amount, 0)::text,
      'change_orders', new.id,
      '/dashboard/change-orders'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_co_approved on change_orders;
create trigger trg_notify_co_approved
  after insert or update on change_orders
  for each row execute function fn_notify_co_approved();

-- ----------------------------------------------------------------------------
-- 5. Inventory below reorder point → Foreman + PM (insert + update)
-- ----------------------------------------------------------------------------
create or replace function fn_notify_inventory_low()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reorder_point is not null
     and new.quantity <= new.reorder_point
     and (tg_op = 'INSERT' or (old.quantity is null or old.quantity > new.reorder_point))
  then
    perform fn_notify_roles(
      new.company_id,
      array['foreman','pm','owner'],
      'inventory_low'::notification_type,
      'Low stock: ' || new.profile,
      'Quantity ' || new.quantity || ' (reorder at ' || new.reorder_point || ')',
      'inventory', new.id,
      '/dashboard/inventory'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_inv_low on inventory;
create trigger trg_notify_inv_low
  after insert or update on inventory
  for each row execute function fn_notify_inventory_low();

-- ----------------------------------------------------------------------------
-- 6. RFI raised → PM + Owner
-- ----------------------------------------------------------------------------
create or replace function fn_notify_rfi_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform fn_notify_roles(
    new.company_id,
    array['pm','owner','estimator'],
    'info'::notification_type,
    'New RFI: ' || new.rfi_number,
    coalesce(new.question, 'Request for information'),
    'rfis', new.id,
    '/dashboard/rfis'
  );
  return new;
end;
$$;
drop trigger if exists trg_notify_rfi_created on rfis;
create trigger trg_notify_rfi_created
  after insert on rfis
  for each row execute function fn_notify_rfi_created();
