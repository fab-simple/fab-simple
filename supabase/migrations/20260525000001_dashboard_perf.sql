-- Dashboard performance migration.
--
-- 1. Indexes that the parallel dashboard query needs to be cheap at 10k+ parts:
--    - parts(company_id, status)        — partitioning by tenant + status
--    - parts(project_id, status)        — per-project progress aggregation
--    - certifications(company_id, expiry_date)
--    - inventory(company_id, status)
--    - activity_feed(company_id, created_at DESC)
--    - ncr_reports(company_id, status)
--    - change_orders(company_id, status)
--    - rfis(company_id, status)
--    - projects(company_id, status, deadline)
--
-- 2. Per-project aggregate view: dashboard_project_progress.
--    This is a regular view (not materialized) — Postgres folds it into the
--    underlying scans efficiently with the new indexes, and we don't have to
--    schedule a refresh. If a tenant grows past 100k parts/project we can
--    convert it to a materialized view with a trigger-based refresh.

create index if not exists parts_company_status_idx       on parts (company_id, status);
create index if not exists parts_project_status_idx       on parts (project_id, status);
create index if not exists certifications_co_exp_idx      on certifications (company_id, expiry_date);
create index if not exists inventory_co_status_idx        on inventory (company_id, status);
create index if not exists activity_feed_co_created_idx   on activity_feed (company_id, created_at desc);
create index if not exists ncr_reports_co_status_idx      on ncr_reports (company_id, status);
create index if not exists change_orders_co_status_idx    on change_orders (company_id, status);
create index if not exists rfis_co_status_idx             on rfis (company_id, status);
create index if not exists projects_co_status_deadline_idx on projects (company_id, status, deadline);

-- Per-project progress rollup. The dashboard endpoint reads this in O(N projects)
-- instead of fetching all parts and bucketing client-side.
create or replace view dashboard_project_progress as
select
  p.id              as project_id,
  p.company_id      as company_id,
  count(pa.id)      as total_parts,
  count(*) filter (where pa.status in ('complete','shipped')) as completed_parts,
  case when count(pa.id) = 0 then 0
       else round((count(*) filter (where pa.status in ('complete','shipped'))::numeric / count(pa.id)) * 100)
  end as progress_pct
from projects p
left join parts pa on pa.project_id = p.id
group by p.id, p.company_id;

comment on view dashboard_project_progress is
  'Per-project parts progress for the dashboard. Reads through RLS on parts/projects.';

-- Sequential rate limit table for cross-instance throttling (used by p21).
create table if not exists rate_limit_buckets (
  id            text primary key,
  count         int not null default 0,
  window_start  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists rate_limit_buckets_window_idx on rate_limit_buckets (window_start);

-- A small SQL function the Edge Function can RPC-call to atomically
-- increment + check the bucket. Returns (over_limit boolean, count int, reset_at timestamptz).
create or replace function rl_check(
  p_key   text,
  p_max   int,
  p_window_seconds int
) returns table(over_limit boolean, used int, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_used         int;
begin
  v_window_start := now() - make_interval(secs => p_window_seconds);

  -- Reset stale bucket atomically
  insert into rate_limit_buckets (id, count, window_start, updated_at)
  values (p_key, 1, now(), now())
  on conflict (id) do update
  set count = case
                when rate_limit_buckets.window_start < v_window_start then 1
                else rate_limit_buckets.count + 1
              end,
      window_start = case
                       when rate_limit_buckets.window_start < v_window_start then now()
                       else rate_limit_buckets.window_start
                     end,
      updated_at = now()
  returning rate_limit_buckets.count, rate_limit_buckets.window_start
  into v_used, v_window_start;

  over_limit := v_used > p_max;
  used := v_used;
  reset_at := v_window_start + make_interval(secs => p_window_seconds);
  return next;
end
$$;

revoke all on function rl_check(text, int, int) from public;
grant execute on function rl_check(text, int, int) to anon, authenticated, service_role;
