-- ============================================================================
-- FabSimple v5.1 — Row Level Security
-- 7 roles × per-operation × FORCE RLS on every tenant-scoped table
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enable + FORCE on every tenant table
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  tenant_tables text[] := array[
    'companies','users','subscriptions','projects','parts','assemblies','drawings',
    'change_orders','rfis','weld_inspections','paint_inspections','aisc_checklist',
    'ncr_reports','heat_numbers','certifications','osha_checklists','daily_production_log',
    'cut_plans','erection_sequence','shipping_tickets','estimates','estimate_line_items',
    'billing_applications','job_costs','purchase_orders','inventory','inventory_adjustments',
    'notifications','activity_feed','audit_log','sequence_counters','gc_contacts',
    'ai_insights','ai_chat_history','user_invitations','file_attachments'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end$$;

-- security_audit_log: service role only, no policies → all denied
alter table security_audit_log enable row level security;
alter table security_audit_log force row level security;

-- ----------------------------------------------------------------------------
-- Shorthand
--   get_user_company_id()  → resolves caller's company_id
--   get_user_role()        → resolves caller's role
-- All policies use these helpers (security definer)
-- ----------------------------------------------------------------------------

-- ============================================================================
-- companies
-- ============================================================================
create policy companies_select on companies for select
  using (id = get_user_company_id());
create policy companies_update_owner on companies for update
  using (id = get_user_company_id() and get_user_role() = 'owner')
  with check (id = get_user_company_id());
-- no INSERT (auth-bootstrap-org handles creation server-side)
-- no DELETE (soft delete via active flag)

-- ============================================================================
-- users
-- ============================================================================
create policy users_select on users for select
  using (company_id = get_user_company_id());
create policy users_insert_owner on users for insert
  with check (company_id = get_user_company_id() and get_user_role() = 'owner');
create policy users_update_owner on users for update
  using (company_id = get_user_company_id() and get_user_role() = 'owner')
  with check (company_id = get_user_company_id());
create policy users_update_self on users for update
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());
-- DELETE: never via API; deactivate via is_active=false

-- ============================================================================
-- subscriptions
-- ============================================================================
create policy subs_select_owner on subscriptions for select
  using (company_id = get_user_company_id() and get_user_role() = 'owner');

-- ============================================================================
-- projects
-- ============================================================================
create policy projects_select on projects for select
  using (company_id = get_user_company_id());
create policy projects_insert on projects for insert
  with check (company_id = get_user_company_id() and get_user_role() in ('owner','pm'));
create policy projects_update on projects for update
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm'))
  with check (company_id = get_user_company_id());
create policy projects_delete on projects for delete
  using (company_id = get_user_company_id() and get_user_role() = 'owner');

-- ============================================================================
-- parts
-- ============================================================================
create policy parts_select on parts for select
  using (
    company_id = get_user_company_id()
    and (
      get_user_role() in ('owner','pm','foreman','qc','estimator','accounting')
      or (get_user_role() = 'worker' and assigned_user_id = get_user_internal_id())
      or get_user_role() = 'worker'  -- workers can read all in own company for drawing/QR ref
    )
  );
create policy parts_insert on parts for insert
  with check (company_id = get_user_company_id() and get_user_role() in ('owner','pm','foreman'));
create policy parts_update_staff on parts for update
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','foreman','qc'))
  with check (company_id = get_user_company_id());
create policy parts_update_worker on parts for update
  using (
    company_id = get_user_company_id()
    and get_user_role() = 'worker'
    and assigned_user_id = get_user_internal_id()
  )
  with check (
    company_id = get_user_company_id()
    and assigned_user_id = get_user_internal_id()
  );
create policy parts_delete on parts for delete
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm'));

-- ============================================================================
-- assemblies
-- ============================================================================
create policy assemblies_select on assemblies for select
  using (company_id = get_user_company_id());
create policy assemblies_write on assemblies for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','foreman'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- drawings
-- ============================================================================
create policy drawings_select on drawings for select
  using (company_id = get_user_company_id());
create policy drawings_write on drawings for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- change_orders
-- ============================================================================
create policy co_select on change_orders for select
  using (company_id = get_user_company_id());
create policy co_write on change_orders for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- rfis
-- ============================================================================
create policy rfis_select on rfis for select
  using (company_id = get_user_company_id());
create policy rfis_write on rfis for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','foreman','qc'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- weld_inspections
-- ============================================================================
create policy weld_select on weld_inspections for select
  using (company_id = get_user_company_id());
create policy weld_write on weld_inspections for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','qc'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- paint_inspections
-- ============================================================================
create policy paint_select on paint_inspections for select
  using (company_id = get_user_company_id());
create policy paint_write on paint_inspections for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','qc'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- aisc_checklist
-- ============================================================================
create policy aisc_select on aisc_checklist for select
  using (company_id = get_user_company_id());
create policy aisc_write on aisc_checklist for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','qc','pm'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- ncr_reports
-- ============================================================================
create policy ncr_select on ncr_reports for select
  using (company_id = get_user_company_id());
create policy ncr_write on ncr_reports for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','qc','pm'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- heat_numbers
-- ============================================================================
create policy heat_select on heat_numbers for select
  using (company_id = get_user_company_id());
create policy heat_write on heat_numbers for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','qc','accounting','foreman'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- certifications
-- ============================================================================
create policy cert_select on certifications for select
  using (company_id = get_user_company_id());
create policy cert_write on certifications for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','qc'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- osha_checklists
-- ============================================================================
create policy osha_select on osha_checklists for select
  using (company_id = get_user_company_id());
create policy osha_write on osha_checklists for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','qc','foreman'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- daily_production_log
-- ============================================================================
create policy dpl_select on daily_production_log for select
  using (company_id = get_user_company_id());
create policy dpl_write on daily_production_log for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','foreman','pm'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- cut_plans
-- ============================================================================
create policy cut_select on cut_plans for select
  using (company_id = get_user_company_id());
create policy cut_write on cut_plans for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','foreman','pm'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- erection_sequence
-- ============================================================================
create policy erec_select on erection_sequence for select
  using (company_id = get_user_company_id());
create policy erec_write on erection_sequence for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','foreman'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- shipping_tickets
-- ============================================================================
create policy ship_select on shipping_tickets for select
  using (company_id = get_user_company_id());
create policy ship_write on shipping_tickets for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- estimates
-- ============================================================================
create policy est_select on estimates for select
  using (company_id = get_user_company_id() and get_user_role() in ('owner','estimator','pm','accounting'));
create policy est_write on estimates for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','estimator'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- estimate_line_items
-- ============================================================================
create policy estli_select on estimate_line_items for select
  using (company_id = get_user_company_id() and get_user_role() in ('owner','estimator','pm','accounting'));
create policy estli_write on estimate_line_items for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','estimator'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- billing_applications
-- ============================================================================
create policy bill_select on billing_applications for select
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting'));
create policy bill_write on billing_applications for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- job_costs
-- ============================================================================
create policy jc_select on job_costs for select
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting','estimator'));
create policy jc_write on job_costs for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- purchase_orders
-- ============================================================================
create policy po_select on purchase_orders for select
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','accounting','foreman'));
create policy po_write on purchase_orders for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- inventory
-- ============================================================================
create policy inv_select on inventory for select
  using (company_id = get_user_company_id());
create policy inv_write on inventory for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','foreman','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- inventory_adjustments
-- ============================================================================
create policy invadj_select on inventory_adjustments for select
  using (company_id = get_user_company_id());
create policy invadj_write on inventory_adjustments for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','foreman','accounting'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- notifications
-- ============================================================================
create policy notif_select_own on notifications for select
  using (company_id = get_user_company_id() and user_id = get_user_internal_id());
create policy notif_update_own on notifications for update
  using (company_id = get_user_company_id() and user_id = get_user_internal_id())
  with check (company_id = get_user_company_id() and user_id = get_user_internal_id());

-- ============================================================================
-- activity_feed
-- ============================================================================
create policy activity_select on activity_feed for select
  using (company_id = get_user_company_id());
-- INSERT only via Edge Function (service role)

-- ============================================================================
-- audit_log
-- ============================================================================
create policy audit_select_owner on audit_log for select
  using (company_id = get_user_company_id() and get_user_role() = 'owner');
create policy audit_select_self on audit_log for select
  using (company_id = get_user_company_id() and user_id = get_user_internal_id());
-- INSERT only via Edge Function (service role)

-- ============================================================================
-- sequence_counters
-- ============================================================================
create policy seq_select on sequence_counters for select
  using (company_id = get_user_company_id());
-- writes only via next_sequence_number() (security definer fn)

-- ============================================================================
-- gc_contacts
-- ============================================================================
create policy gc_select on gc_contacts for select
  using (company_id = get_user_company_id());
create policy gc_write on gc_contacts for all
  using (company_id = get_user_company_id() and get_user_role() in ('owner','pm','estimator'))
  with check (company_id = get_user_company_id());

-- ============================================================================
-- ai_insights
-- ============================================================================
create policy ai_ins_select on ai_insights for select
  using (company_id = get_user_company_id());
create policy ai_ins_update on ai_insights for update
  using (company_id = get_user_company_id())
  with check (company_id = get_user_company_id());
-- INSERT only via Edge Function (AI Copilot)

-- ============================================================================
-- ai_chat_history
-- ============================================================================
create policy ai_chat_own on ai_chat_history for all
  using (company_id = get_user_company_id() and user_id = get_user_internal_id())
  with check (company_id = get_user_company_id() and user_id = get_user_internal_id());

-- ============================================================================
-- user_invitations
-- ============================================================================
create policy invite_select_owner on user_invitations for select
  using (company_id = get_user_company_id() and get_user_role() = 'owner');
create policy invite_write_owner on user_invitations for all
  using (company_id = get_user_company_id() and get_user_role() = 'owner')
  with check (company_id = get_user_company_id());

-- ============================================================================
-- file_attachments
-- ============================================================================
create policy file_select on file_attachments for select
  using (company_id = get_user_company_id());
create policy file_write on file_attachments for all
  using (company_id = get_user_company_id())
  with check (company_id = get_user_company_id());
