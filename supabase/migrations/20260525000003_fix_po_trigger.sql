-- ============================================================================
-- Fix fn_notify_po_received(): referenced `new.vendor_name`, but the column
-- on `purchase_orders` is `vendor`. The bug made every PO status update to
-- 'received' fail with `record "new" has no field "vendor_name"`, which is
-- why marking a PO fully received on /dashboard/receiving exploded.
-- ============================================================================

create or replace function fn_notify_po_received()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'received' and (old.status is null or old.status <> 'received') then
    perform fn_notify_roles(
      new.company_id,
      array['foreman','pm','owner'],
      'info'::notification_type,
      'PO received: ' || new.po_number,
      'Material from ' || coalesce(new.vendor, 'vendor') || ' arrived',
      'purchase_orders', new.id,
      '/dashboard/receiving'
    );
  end if;
  return new;
end;
$$;
