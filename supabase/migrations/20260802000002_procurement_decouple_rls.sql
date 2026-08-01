-- ============================================================================
-- FabSimple — lot_reservations RLS
-- Mirrors material_lots' existing policy shape (§7.1): the same roles who can
-- write a lot directly can create/release a reservation against it.
-- ============================================================================

alter table lot_reservations enable row level security;
alter table lot_reservations force row level security;

create policy lot_reservations_select on lot_reservations for select
  using (company_id = get_user_company_id());
create policy lot_reservations_write on lot_reservations for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','foreman','qc'))
  with check (company_id = get_user_company_id());
