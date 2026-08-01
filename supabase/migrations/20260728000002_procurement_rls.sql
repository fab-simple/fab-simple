-- ============================================================================
-- FabSimple — Procurement & Material Traceability, Phase 1 — RLS
-- Enable + FORCE RLS on the 6 new tables, add policies matching the roles
-- decided in docs/procurement-material-traceability-spec.md §7/§13.
--
-- Also fixes a pre-existing drift on purchase_orders: `po_write` (from
-- 20260524000003_rls.sql) never included 'pm', even though
-- supabase/functions/api/lib/permissions.ts has always listed `pm` as
-- insertable/updatable. A pm-role request passed the API's pre-flight
-- check and then failed at the DB layer with an opaque 400 rather than a
-- clean 403. Fixed here since this migration already touches
-- purchase_orders' vendor/confirmation columns and pm is the primary
-- procurement actor for the new fields.
-- ============================================================================

do $$
declare
  t text;
  new_tenant_tables text[] := array[
    'vendors','inbound_shipments','receivings','bundles','material_lots','mtr_documents'
  ];
begin
  foreach t in array new_tenant_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end$$;

-- ============================================================================
-- vendors
-- ============================================================================
create policy vendors_select on vendors for select
  using (company_id = get_user_company_id());
create policy vendors_write on vendors for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- inbound_shipments
-- ============================================================================
create policy inbound_shipments_select on inbound_shipments for select
  using (company_id = get_user_company_id());
create policy inbound_shipments_write on inbound_shipments for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','foreman','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- receivings — insert/update deliberately split (§13 D9): foreman can log a
-- delivery, but only owner/pm may correct one after the fact.
-- ============================================================================
create policy receivings_select on receivings for select
  using (company_id = get_user_company_id());
create policy receivings_insert on receivings for insert
  with check (company_id = get_user_company_id() and get_user_role() in ('owner','pm','foreman'));
create policy receivings_update on receivings for update
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm'))
  with check (company_id = get_user_company_id());
create policy receivings_delete on receivings for delete
  using (company_id = get_user_company_id() and get_user_role() = 'owner');

-- ============================================================================
-- bundles
-- ============================================================================
create policy bundles_select on bundles for select
  using (company_id = get_user_company_id());
create policy bundles_write on bundles for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','foreman'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- material_lots
-- ============================================================================
create policy lots_select on material_lots for select
  using (company_id = get_user_company_id());
create policy lots_write on material_lots for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','foreman','qc'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- mtr_documents — insert/update split: foreman can attach a scanned MTR and
-- trigger OCR extraction, but only qc/owner may flip ocr_status to
-- 'verified' (the value that lifts heat quarantine).
-- ============================================================================
create policy mtr_docs_select on mtr_documents for select
  using (company_id = get_user_company_id());
create policy mtr_docs_insert on mtr_documents for insert
  with check (company_id = get_user_company_id() and get_user_role() in ('owner','qc','foreman'));
create policy mtr_docs_update on mtr_documents for update
  using (company_id = get_user_company_id() and get_user_role() in ('owner','qc'))
  with check (company_id = get_user_company_id());
create policy mtr_docs_delete on mtr_documents for delete
  using (company_id = get_user_company_id() and get_user_role() = 'owner');

-- ============================================================================
-- purchase_orders — add 'pm' to the write policy (bugfix, see header note)
-- ============================================================================
drop policy if exists po_write on purchase_orders;
create policy po_write on purchase_orders for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting'))
  with check (company_id = get_user_company_id());
