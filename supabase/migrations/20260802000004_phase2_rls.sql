-- ============================================================================
-- FabSimple — Procurement & Material Traceability, Phase 2 — RLS
-- Enable + FORCE RLS on the 6 new tables. Every table carries its own
-- company_id (see 20260802000003's header note on rfq_lines/rfq_vendors/
-- vendor_quote_lines), so every policy here is the same simple
-- `company_id = get_user_company_id()` shape used everywhere else in this
-- schema — no EXISTS-subquery policies needed.
-- Roles: docs/procurement-material-traceability-spec.md §15.14.
-- ============================================================================

do $$
declare
  t text;
  new_tenant_tables text[] := array[
    'material_requirements','rfqs','rfq_lines','rfq_vendors','vendor_quotes','vendor_quote_lines'
  ];
begin
  foreach t in array new_tenant_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end$$;

-- ============================================================================
-- material_requirements — owner/pm/estimator write; + foreman/accounting read
-- ============================================================================
create policy material_requirements_select on material_requirements for select
  using (company_id = get_user_company_id());
create policy material_requirements_write on material_requirements for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','estimator'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- rfqs — owner/pm/accounting write; + estimator read
-- ============================================================================
create policy rfqs_select on rfqs for select
  using (company_id = get_user_company_id());
create policy rfqs_write on rfqs for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- rfq_lines / rfq_vendors — written only via fn_create_rfq (sbAdmin, security
-- definer), never through direct client writes; read mirrors rfqs.
-- ============================================================================
create policy rfq_lines_select on rfq_lines for select
  using (company_id = get_user_company_id());
create policy rfq_lines_write on rfq_lines for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting'))
  with check (company_id = get_user_company_id());

create policy rfq_vendors_select on rfq_vendors for select
  using (company_id = get_user_company_id());
create policy rfq_vendors_write on rfq_vendors for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- vendor_quotes — owner/pm/accounting write; + estimator read
-- ============================================================================
create policy vendor_quotes_select on vendor_quotes for select
  using (company_id = get_user_company_id());
create policy vendor_quotes_write on vendor_quotes for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- vendor_quote_lines — written only via fn_create_vendor_quote (sbAdmin);
-- read mirrors vendor_quotes.
-- ============================================================================
create policy vendor_quote_lines_select on vendor_quote_lines for select
  using (company_id = get_user_company_id());
create policy vendor_quote_lines_write on vendor_quote_lines for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting'))
  with check (company_id = get_user_company_id());
