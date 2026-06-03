-- ============================================================================
-- FabSimple v5.1 — billing_line_items (AIA G703 Schedule of Values)
--
-- The AIA G703 Continuation Sheet is itemized rows: each line is a portion of
-- the contract (e.g. "Mobilization", "Detailing", "Fabrication — Phase 1"),
-- with original scheduled value, work completed this period, materials
-- stored, % complete, and balance to finish.
--
-- Previously the G703 PDF was rendered with `lines: []` because there was no
-- table to read from. This migration adds:
--
--   1. `billing_line_items` — the project's permanent schedule of values
--      (one set per project, mirrored from estimate_line_items on
--      conversion if the estimate had a takeoff).
--   2. `billing_application_lines` — per-payment-app numbers (work completed
--      this period). These are joined back to billing_line_items on render.
--
-- For a minimum-viable G703 we only need billing_line_items to be populated
-- AND optional per-period numbers. The convertEstimate flow now seeds
-- billing_line_items from estimate_line_items.
-- ============================================================================

create table if not exists billing_line_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  description   text not null,
  quantity      numeric(14,3) not null default 1,
  unit          text not null default 'ls',
  unit_cost     numeric(14,2) not null default 0,
  total_cost    numeric(14,2) not null default 0,
  -- Scheduled value (G703 column C). Defaults to total_cost.
  scheduled_value numeric(14,2) generated always as (
    case when total_cost > 0 then total_cost else quantity * unit_cost end
  ) stored,
  sort_order    int not null default 0,
  source        text default 'manual',  -- 'manual' | 'estimate_conversion'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ix_billing_line_items_company on billing_line_items(company_id);
create index if not exists ix_billing_line_items_project on billing_line_items(project_id, sort_order);

alter table billing_line_items enable row level security;
alter table billing_line_items force row level security;

drop policy if exists bli_select on billing_line_items;
create policy bli_select on billing_line_items for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','accounting','estimator')
  );

drop policy if exists bli_write on billing_line_items;
create policy bli_write on billing_line_items for all
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','accounting','estimator')
  )
  with check (company_id = get_user_company_id());


-- Per-payment-application snapshot of "work completed this period".
-- (Optional — G703 still renders without these; numbers default to 0.)
create table if not exists billing_application_lines (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references companies(id) on delete cascade,
  billing_application_id   uuid not null references billing_applications(id) on delete cascade,
  billing_line_item_id     uuid not null references billing_line_items(id) on delete cascade,
  work_completed_previous  numeric(14,2) not null default 0,
  work_completed_period    numeric(14,2) not null default 0,
  materials_stored         numeric(14,2) not null default 0,
  pct_complete             numeric(5,2) not null default 0,
  retainage_amount         numeric(14,2) not null default 0,
  created_at               timestamptz not null default now()
);

create index if not exists ix_bal_app on billing_application_lines(billing_application_id);
create index if not exists ix_bal_line on billing_application_lines(billing_line_item_id);

alter table billing_application_lines enable row level security;
alter table billing_application_lines force row level security;

drop policy if exists bal_select on billing_application_lines;
create policy bal_select on billing_application_lines for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','accounting')
  );

drop policy if exists bal_write on billing_application_lines;
create policy bal_write on billing_application_lines for all
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','accounting')
  )
  with check (company_id = get_user_company_id());


-- Demo seed: give the active demo project a real schedule of values so the
-- G703 PDF has something to render right out of the box.
do $$
declare
  active_project_id uuid;
  active_company_id uuid;
begin
  select id, company_id into active_project_id, active_company_id
  from projects
  where company_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and status in ('active','on_hold')
  order by created_at asc
  limit 1;

  if active_project_id is not null and not exists (
    select 1 from billing_line_items where project_id = active_project_id
  ) then
    insert into billing_line_items (company_id, project_id, description, quantity, unit, unit_cost, total_cost, sort_order, source) values
      (active_company_id, active_project_id, 'Mobilization',                       1, 'ls', 18500,  18500, 1, 'manual'),
      (active_company_id, active_project_id, 'Shop Drawings & Detailing',          1, 'ls', 42000,  42000, 2, 'manual'),
      (active_company_id, active_project_id, 'Material — Wide Flange Beams',     185, 'tn',   980, 181300, 3, 'manual'),
      (active_company_id, active_project_id, 'Material — Misc Connection Steel',  35, 'tn',  1120,  39200, 4, 'manual'),
      (active_company_id, active_project_id, 'Fabrication — Phase 1 (Levels 1-3)', 1, 'ls', 124000, 124000, 5, 'manual'),
      (active_company_id, active_project_id, 'Fabrication — Phase 2 (Levels 4-6)', 1, 'ls', 118500, 118500, 6, 'manual'),
      (active_company_id, active_project_id, 'Galvanizing & Shop Paint',           1, 'ls',  32500,  32500, 7, 'manual'),
      (active_company_id, active_project_id, 'Quality Control & AISC Compliance',  1, 'ls',  14750,  14750, 8, 'manual'),
      (active_company_id, active_project_id, 'Delivery & Field Coordination',      1, 'ls',  22000,  22000, 9, 'manual'),
      (active_company_id, active_project_id, 'Erection — Phase 1',                 1, 'ls',  98000,  98000, 10,'manual'),
      (active_company_id, active_project_id, 'Erection — Phase 2',                 1, 'ls',  92500,  92500, 11,'manual'),
      (active_company_id, active_project_id, 'Final Punch List & Closeout',        1, 'ls',  17000,  17000, 12,'manual');
  end if;
end$$;
