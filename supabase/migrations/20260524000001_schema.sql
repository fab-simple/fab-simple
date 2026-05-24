-- ============================================================================
-- FabSimple v5.1 — Production Schema
-- 37 tables · multi-tenant via company_id · matches product spec exactly
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type user_role         as enum ('owner','pm','estimator','foreman','qc','accounting','worker');
create type plan_tier         as enum ('starter','professional','enterprise');
create type project_status    as enum ('active','on_hold','completed','archived');
create type part_status       as enum ('not_started','in_progress','complete','shipped','on_hold');
create type drawing_type      as enum ('shop','erection','connection');
create type drawing_status    as enum ('in_progress','submitted','approved','released','superseded');
create type co_status         as enum ('pending','approved','rejected');
create type rfi_status        as enum ('open','answered','closed');
create type inspection_result as enum ('pass','fail','hold','pending');
create type aisc_status       as enum ('open','done','hold','na');
create type ncr_status        as enum ('open','in_progress','re_inspected','closed');
create type mtr_status        as enum ('pending','received','verified');
create type estimate_status   as enum ('draft','submitted','won','lost');
create type po_status         as enum ('draft','issued','partial','received','closed');
create type billing_status    as enum ('draft','submitted','certified','paid');
create type inventory_status  as enum ('ok','low','out');
create type adjustment_type   as enum ('received','consumed','manual','damaged');
create type notification_type as enum ('cert_expiry','inventory_low','qc_failure','ncr_created','co_approved','info');
create type subscription_status as enum ('trialing','active','past_due','canceled');
create type shipping_status   as enum ('pending','loaded','in_transit','delivered');
create type ai_insight_type   as enum ('bottleneck','reorder','schedule','cost','qc');
create type ai_message_role   as enum ('user','assistant','system');

-- ----------------------------------------------------------------------------
-- 1. companies — multi-tenant root
-- ----------------------------------------------------------------------------
create table companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  aisc_cert       boolean not null default false,
  plan            plan_tier not null default 'starter',
  max_parts       int not null default 5000,
  max_projects    int not null default 10,
  max_users       int not null default 10,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. users — platform users (linked to auth.users)
-- ----------------------------------------------------------------------------
create table users (
  id              uuid primary key default gen_random_uuid(),
  auth_id         uuid not null unique references auth.users(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  role            user_role not null default 'worker',
  full_name       text not null,
  email           text not null,
  phone           text,
  is_active       boolean not null default true,
  last_login      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index users_company_idx on users(company_id);
create index users_auth_idx on users(auth_id);

-- ----------------------------------------------------------------------------
-- 3. subscriptions
-- ----------------------------------------------------------------------------
create table subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(id) on delete cascade,
  plan                    plan_tier not null,
  status                  subscription_status not null default 'trialing',
  current_period_start    timestamptz not null default now(),
  current_period_end      timestamptz not null default now() + interval '30 days',
  max_users               int not null,
  max_projects            int not null,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index subscriptions_company_idx on subscriptions(company_id);

-- ----------------------------------------------------------------------------
-- 4. projects
-- ----------------------------------------------------------------------------
create table projects (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  name            text not null,
  number          text not null,
  gc_name         text,
  gc_contact      text,
  gc_phone        text,
  contract_value  numeric(14,2),
  contract_type   text,
  est_tonnage     numeric(10,2),
  status          project_status not null default 'active',
  pm_id           uuid references users(id) on delete set null,
  start_date      date,
  deadline        date,
  description     text,
  color           text,
  is_archived     boolean not null default false,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index projects_company_idx on projects(company_id);
create index projects_status_idx on projects(company_id, status);
create index projects_pm_idx on projects(pm_id);

-- ----------------------------------------------------------------------------
-- 5. parts
-- ----------------------------------------------------------------------------
create table parts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  part_mark       text not null,
  assembly_mark   text,
  profile         text not null,
  grade           text,
  length          numeric(10,3),
  weight          numeric(10,2),
  quantity        int not null default 1,
  status          part_status not null default 'not_started',
  phase           text,
  heat_number     text,
  drawing_id      uuid,
  assigned_user_id uuid references users(id) on delete set null,
  notes           text,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index parts_company_idx on parts(company_id);
create index parts_project_idx on parts(project_id);
create index parts_status_idx on parts(company_id, status);
create index parts_assigned_idx on parts(assigned_user_id) where assigned_user_id is not null;
create unique index parts_company_mark_idx on parts(company_id, project_id, part_mark);

-- ----------------------------------------------------------------------------
-- 6. assemblies
-- ----------------------------------------------------------------------------
create table assemblies (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  assembly_mark   text not null,
  description     text,
  total_weight    numeric(10,2),
  total_parts     int not null default 0,
  completed_parts int not null default 0,
  status          part_status not null default 'not_started',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index assemblies_company_idx on assemblies(company_id);
create index assemblies_project_idx on assemblies(project_id);
create unique index assemblies_company_mark_idx on assemblies(company_id, project_id, assembly_mark);

-- ----------------------------------------------------------------------------
-- 7. drawings
-- ----------------------------------------------------------------------------
create table drawings (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  project_id          uuid not null references projects(id) on delete cascade,
  drawing_number      text not null,
  revision            text not null default 'A',
  title               text,
  type                drawing_type not null default 'shop',
  status              drawing_status not null default 'in_progress',
  current_revision    boolean not null default true,
  date_issued         date,
  approved_by         uuid references users(id) on delete set null,
  file_url            text,
  parts_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index drawings_company_idx on drawings(company_id);
create index drawings_project_idx on drawings(project_id);
create unique index drawings_company_num_rev_idx on drawings(company_id, project_id, drawing_number, revision);

-- ----------------------------------------------------------------------------
-- 8. change_orders
-- ----------------------------------------------------------------------------
create table change_orders (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  co_number       text not null,
  description     text not null,
  amount          numeric(14,2) not null default 0,
  status          co_status not null default 'pending',
  drawing_rev     text,
  submitted_by    uuid references users(id) on delete set null,
  approved_by     uuid references users(id) on delete set null,
  approved_at     timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index change_orders_company_idx on change_orders(company_id);
create index change_orders_project_idx on change_orders(project_id);

-- ----------------------------------------------------------------------------
-- 9. rfis
-- ----------------------------------------------------------------------------
create table rfis (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  rfi_number      text not null,
  question        text not null,
  answer          text,
  status          rfi_status not null default 'open',
  submitted_by    uuid references users(id) on delete set null,
  submitted_to    text,
  responded_by    uuid references users(id) on delete set null,
  date_answered   date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index rfis_company_idx on rfis(company_id);
create index rfis_project_idx on rfis(project_id);

-- ----------------------------------------------------------------------------
-- 10. weld_inspections (AWS D1.1)
-- ----------------------------------------------------------------------------
create table weld_inspections (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  project_id          uuid references projects(id) on delete set null,
  part_id             uuid references parts(id) on delete set null,
  weld_number         text not null,
  joint_type          text not null,
  fillet_size         text,
  weld_process        text not null,
  filler_metal        text not null,
  inspection_method   text not null,
  cwi_reference       text,
  inspector_id        uuid references users(id) on delete set null,
  inspector_name      text,
  result              inspection_result not null default 'pending',
  aws_d11_reference   text,
  notes               text,
  inspection_date     date not null default current_date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index weld_company_idx on weld_inspections(company_id);
create index weld_project_idx on weld_inspections(project_id);

-- ----------------------------------------------------------------------------
-- 11. paint_inspections (SSPC)
-- ----------------------------------------------------------------------------
create table paint_inspections (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  project_id          uuid references projects(id) on delete set null,
  part_id             uuid references parts(id) on delete set null,
  insp_number         text not null,
  surface_prep        text not null,
  primer_dft          numeric(6,1) not null default 0,
  topcoat_dft         numeric(6,1) not null default 0,
  total_dft           numeric(6,1) generated always as (primer_dft + topcoat_dft) stored,
  required_min        numeric(6,1) not null default 0,
  inspector_id        uuid references users(id) on delete set null,
  inspector_name      text,
  result              inspection_result not null default 'pending',
  ambient_temp        numeric(5,1),
  humidity_pct        numeric(5,1),
  notes               text,
  inspection_date     date not null default current_date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index paint_company_idx on paint_inspections(company_id);
create index paint_project_idx on paint_inspections(project_id);

-- ----------------------------------------------------------------------------
-- 12. aisc_checklist (AISC 303-10)
-- ----------------------------------------------------------------------------
create table aisc_checklist (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  section_ref     text not null,
  item_text       text not null,
  category        text not null,
  status          aisc_status not null default 'open',
  assigned_to     uuid references users(id) on delete set null,
  notes           text,
  cleared_at      timestamptz,
  cleared_by      uuid references users(id) on delete set null,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index aisc_company_idx on aisc_checklist(company_id);
create index aisc_project_idx on aisc_checklist(project_id);

-- ----------------------------------------------------------------------------
-- 13. ncr_reports
-- ----------------------------------------------------------------------------
create table ncr_reports (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  project_id          uuid references projects(id) on delete set null,
  part_id             uuid references parts(id) on delete set null,
  ncr_number          text not null,
  source_inspection_id uuid,
  source_inspection_type text,
  description         text not null,
  root_cause          text,
  corrective_action   text,
  status              ncr_status not null default 'open',
  blocks_shipping     boolean not null default true,
  assigned_to         uuid references users(id) on delete set null,
  closed_at           timestamptz,
  closed_by           uuid references users(id) on delete set null,
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index ncr_company_idx on ncr_reports(company_id);
create index ncr_project_idx on ncr_reports(project_id);
create index ncr_status_idx on ncr_reports(company_id, status);

-- ----------------------------------------------------------------------------
-- 14. heat_numbers (MTR traceability)
-- ----------------------------------------------------------------------------
create table heat_numbers (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  heat_number         text not null,
  material_grade      text not null,
  mill_name           text,
  supplier            text,
  mtr_status          mtr_status not null default 'pending',
  mtr_file_url        text,
  receipt_number      text,
  parts_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index heat_company_num_idx on heat_numbers(company_id, heat_number);

-- ----------------------------------------------------------------------------
-- 15. certifications
-- ----------------------------------------------------------------------------
create table certifications (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  cert_type       text not null,
  holder_name     text not null,
  cert_number     text,
  issue_date      date,
  expiry_date     date not null,
  alert_days      int not null default 30,
  status          text not null default 'active',
  file_url        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index certifications_company_idx on certifications(company_id);
create index certifications_expiry_idx on certifications(company_id, expiry_date);

-- ----------------------------------------------------------------------------
-- 16. osha_checklists
-- ----------------------------------------------------------------------------
create table osha_checklists (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  section_ref     text not null,
  item_text       text not null,
  category        text,
  status          aisc_status not null default 'open',
  assigned_to     uuid references users(id) on delete set null,
  notes           text,
  cleared_at      timestamptz,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index osha_company_idx on osha_checklists(company_id);

-- ----------------------------------------------------------------------------
-- 17. daily_production_log
-- ----------------------------------------------------------------------------
create table daily_production_log (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  project_id          uuid references projects(id) on delete set null,
  log_date            date not null default current_date,
  shift               text,
  station             text not null,
  operators           text[],
  parts_completed     int not null default 0,
  hours_worked        numeric(6,2) not null default 0,
  operation_type      text,
  notes               text,
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index daily_log_company_idx on daily_production_log(company_id);
create index daily_log_date_idx on daily_production_log(company_id, log_date desc);

-- ----------------------------------------------------------------------------
-- 18. cut_plans
-- ----------------------------------------------------------------------------
create table cut_plans (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  project_id          uuid references projects(id) on delete set null,
  profile             text not null,
  stock_length        numeric(10,3) not null,
  kerf                numeric(6,3) not null default 0.125,
  min_remnant         numeric(10,3) not null default 6,
  cuts                jsonb not null default '[]'::jsonb,
  waste_percentage    numeric(5,2),
  total_bars          int not null default 0,
  total_yield_pct     numeric(5,2),
  parameters_json     jsonb,
  generated_at        timestamptz not null default now(),
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index cut_plans_company_idx on cut_plans(company_id);

-- ----------------------------------------------------------------------------
-- 19. erection_sequence
-- ----------------------------------------------------------------------------
create table erection_sequence (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  sequence_number int not null,
  part_id         uuid references parts(id) on delete set null,
  description     text,
  load_number     text,
  priority        int not null default 0,
  phase           text,
  status          part_status not null default 'not_started',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index erection_company_idx on erection_sequence(company_id);
create index erection_project_idx on erection_sequence(project_id);

-- ----------------------------------------------------------------------------
-- 20. shipping_tickets
-- ----------------------------------------------------------------------------
create table shipping_tickets (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid references projects(id) on delete set null,
  ticket_number   text not null,
  load_number     text,
  truck_number    text,
  carrier         text,
  driver_name     text,
  ship_date       date,
  destination     text,
  parts           jsonb not null default '[]'::jsonb,
  total_pieces    int not null default 0,
  total_weight    numeric(10,2),
  bol_url         text,
  status          shipping_status not null default 'pending',
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index shipping_company_idx on shipping_tickets(company_id);

-- ----------------------------------------------------------------------------
-- 21. estimates
-- ----------------------------------------------------------------------------
create table estimates (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  estimate_number     text not null,
  project_name        text not null,
  gc_name             text,
  status              estimate_status not null default 'draft',
  total_amount        numeric(14,2) not null default 0,
  bid_per_lb          numeric(10,4),
  bid_per_ton         numeric(10,2),
  structural_tons     numeric(10,2),
  misc_metal_lbs      numeric(10,2),
  margin_pct          numeric(5,2),
  bid_due_date        date,
  scenarios           jsonb not null default '[]'::jsonb,
  notes               text,
  submitted_at        timestamptz,
  won_at              timestamptz,
  converted_project_id uuid references projects(id) on delete set null,
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index estimates_company_idx on estimates(company_id);

-- ----------------------------------------------------------------------------
-- 22. estimate_line_items
-- ----------------------------------------------------------------------------
create table estimate_line_items (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  estimate_id     uuid not null references estimates(id) on delete cascade,
  category        text not null,
  description     text not null,
  quantity        numeric(10,2) not null default 1,
  unit_cost       numeric(12,2) not null default 0,
  labor_hours     numeric(10,2),
  total           numeric(14,2) generated always as (quantity * unit_cost) stored,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index estimate_lines_company_idx on estimate_line_items(company_id);
create index estimate_lines_est_idx on estimate_line_items(estimate_id);

-- ----------------------------------------------------------------------------
-- 23. billing_applications (AIA G702/G703)
-- ----------------------------------------------------------------------------
create table billing_applications (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(id) on delete cascade,
  project_id              uuid not null references projects(id) on delete cascade,
  application_number      int not null,
  period_to               date not null,
  original_contract       numeric(14,2) not null default 0,
  change_orders_total     numeric(14,2) not null default 0,
  completed_to_date       numeric(14,2) not null default 0,
  materials_stored        numeric(14,2) not null default 0,
  retainage_percent       numeric(5,2) not null default 10,
  retainage_withheld      numeric(14,2) not null default 0,
  previous_billed         numeric(14,2) not null default 0,
  amount_due              numeric(14,2) not null default 0,
  pct_complete            numeric(5,2) not null default 0,
  status                  billing_status not null default 'draft',
  pdf_url                 text,
  notes                   text,
  submitted_at            timestamptz,
  certified_at            timestamptz,
  created_by              uuid references users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index billing_company_idx on billing_applications(company_id);
create index billing_project_idx on billing_applications(project_id);
create unique index billing_app_num_idx on billing_applications(project_id, application_number);

-- ----------------------------------------------------------------------------
-- 24. job_costs
-- ----------------------------------------------------------------------------
create table job_costs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  cost_code       text not null,
  description     text,
  budget_amount   numeric(14,2) not null default 0,
  actual_amount   numeric(14,2) not null default 0,
  committed       numeric(14,2) not null default 0,
  variance        numeric(14,2) generated always as (budget_amount - actual_amount) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index job_costs_company_idx on job_costs(company_id);
create index job_costs_project_idx on job_costs(project_id);

-- ----------------------------------------------------------------------------
-- 25. purchase_orders
-- ----------------------------------------------------------------------------
create table purchase_orders (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  project_id          uuid references projects(id) on delete set null,
  po_number           text not null,
  vendor              text not null,
  items               jsonb not null default '[]'::jsonb,
  total_amount        numeric(14,2) not null default 0,
  qty_ordered         numeric(10,2),
  qty_received        numeric(10,2) not null default 0,
  receiving_status    text not null default 'pending',
  status              po_status not null default 'draft',
  issued_date         date,
  expected_date       date,
  received_date       date,
  notes               text,
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index po_company_idx on purchase_orders(company_id);
create index po_project_idx on purchase_orders(project_id);

-- ----------------------------------------------------------------------------
-- 26. inventory
-- ----------------------------------------------------------------------------
create table inventory (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  profile         text not null,
  grade           text,
  length          numeric(10,3),
  quantity        numeric(10,2) not null default 0,
  location        text,
  reorder_point   numeric(10,2) not null default 0,
  max_stock       numeric(10,2),
  unit_cost       numeric(10,2),
  status          inventory_status generated always as (
    case
      when quantity <= 0 then 'out'::inventory_status
      when quantity <= reorder_point then 'low'::inventory_status
      else 'ok'::inventory_status
    end
  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index inventory_company_idx on inventory(company_id);
create index inventory_status_idx on inventory(company_id, status);

-- ----------------------------------------------------------------------------
-- 27. inventory_adjustments
-- ----------------------------------------------------------------------------
create table inventory_adjustments (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  inventory_id        uuid not null references inventory(id) on delete cascade,
  adjustment_type     adjustment_type not null,
  quantity_change     numeric(10,2) not null,
  reason              text,
  reference_id        uuid,
  reference_type      text,
  adjusted_by         uuid references users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index inv_adj_company_idx on inventory_adjustments(company_id);
create index inv_adj_inventory_idx on inventory_adjustments(inventory_id);

-- ----------------------------------------------------------------------------
-- 28. notifications
-- ----------------------------------------------------------------------------
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  type            notification_type not null default 'info',
  title           text not null,
  message         text not null,
  entity_type     text,
  entity_id       uuid,
  entity_link     text,
  is_read         boolean not null default false,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, is_read, created_at desc);

-- ----------------------------------------------------------------------------
-- 29. activity_feed
-- ----------------------------------------------------------------------------
create table activity_feed (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  user_name       text,
  action          text not null,
  entity_type     text not null,
  entity_id       uuid,
  entity_label    text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);
create index activity_company_idx on activity_feed(company_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 30. audit_log
-- ----------------------------------------------------------------------------
create table audit_log (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  action          text not null,
  table_name      text not null,
  record_id       uuid,
  old_values      jsonb,
  new_values      jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);
create index audit_log_company_idx on audit_log(company_id, created_at desc);
create index audit_log_table_idx on audit_log(table_name, record_id);

-- ----------------------------------------------------------------------------
-- 31. security_audit_log (service-role only)
-- ----------------------------------------------------------------------------
create table security_audit_log (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null,
  user_id         uuid,
  email           text,
  ip_address      text,
  user_agent      text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);
create index sec_audit_event_idx on security_audit_log(event_type, created_at desc);

-- ----------------------------------------------------------------------------
-- 32. sequence_counters (atomic ID generation)
-- ----------------------------------------------------------------------------
create table sequence_counters (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  table_name      text not null,
  prefix          text not null,
  current_value   bigint not null default 0,
  width           int not null default 4,
  updated_at      timestamptz not null default now()
);
create unique index seq_counters_unique_idx on sequence_counters(company_id, table_name, prefix);

-- ----------------------------------------------------------------------------
-- 33. gc_contacts
-- ----------------------------------------------------------------------------
create table gc_contacts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  project_id      uuid references projects(id) on delete set null,
  gc_company      text not null,
  contact_name    text not null,
  role            text,
  email           text,
  phone           text,
  notes           text,
  last_contact    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index gc_contacts_company_idx on gc_contacts(company_id);

-- ----------------------------------------------------------------------------
-- 34. ai_insights
-- ----------------------------------------------------------------------------
create table ai_insights (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  insight_type        ai_insight_type not null,
  priority            text not null default 'medium',
  title               text not null,
  description         text not null,
  suggested_action    text,
  entity_type         text,
  entity_id           uuid,
  is_resolved         boolean not null default false,
  resolved_at         timestamptz,
  resolved_by         uuid references users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index ai_insights_company_idx on ai_insights(company_id, is_resolved, created_at desc);

-- ----------------------------------------------------------------------------
-- 35. ai_chat_history
-- ----------------------------------------------------------------------------
create table ai_chat_history (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  session_id      uuid not null,
  role            ai_message_role not null,
  message         text not null,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);
create index ai_chat_session_idx on ai_chat_history(session_id, created_at);

-- ----------------------------------------------------------------------------
-- 36. user_invitations
-- ----------------------------------------------------------------------------
create table user_invitations (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  email           text not null,
  role            user_role not null default 'worker',
  invited_by      uuid references users(id) on delete set null,
  token           text not null unique,
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index user_invitations_company_idx on user_invitations(company_id);
create index user_invitations_token_idx on user_invitations(token);

-- ----------------------------------------------------------------------------
-- 37. file_attachments (polymorphic — drawings, MTRs, photos, BOLs)
-- ----------------------------------------------------------------------------
create table file_attachments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  entity_type     text not null,
  entity_id       uuid not null,
  storage_bucket  text not null,
  storage_path    text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid references users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index file_attach_entity_idx on file_attachments(entity_type, entity_id);
create index file_attach_company_idx on file_attachments(company_id);

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Resolve the caller's company_id from auth.uid()
create or replace function get_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.users where auth_id = auth.uid() limit 1;
$$;

-- Resolve the caller's role
create or replace function get_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where auth_id = auth.uid() limit 1;
$$;

-- Resolve the caller's users.id (internal id, not auth.uid())
create or replace function get_user_internal_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_id = auth.uid() limit 1;
$$;

-- Atomic sequential ID: returns 'PREFIX-NNNN' incremented per company+table
create or replace function next_sequence_number(
  p_company_id uuid,
  p_table_name text,
  p_prefix     text,
  p_width      int default 4
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
  v_width int := coalesce(p_width, 4);
begin
  insert into sequence_counters(company_id, table_name, prefix, current_value, width)
  values (p_company_id, p_table_name, p_prefix, 1, v_width)
  on conflict (company_id, table_name, prefix)
    do update set
      current_value = sequence_counters.current_value + 1,
      updated_at = now()
  returning current_value into v_next;
  return p_prefix || '-' || lpad(v_next::text, v_width, '0');
end;
$$;

-- updated_at trigger fn
create or replace function fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
