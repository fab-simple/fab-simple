-- ============================================================================
-- 20260525000008_audit_partitioning.sql
--
-- Why this migration exists
-- -------------------------
-- audit_log and activity_feed are append-only event logs that grow with every
-- mutation in the system. The CEO review flagged them as "forever-growth"
-- tables — at one event per part status change, a customer fabricating
-- 2,000 parts/week generates ~100K activity rows a year. Multiply by the
-- audit log (which is *every* insert/update/delete) and a healthy fab shop
-- crosses 1M rows inside year one, and the dashboard's `select ... order by
-- created_at desc limit 10` starts costing seconds instead of milliseconds.
--
-- The fix: monthly range partitioning by `created_at` via pg_partman, with
-- retention policy:
--   activity_feed: 3 months (it's a UX feed, not a compliance log)
--   audit_log:     84 months / 7 years (AISC + SOX compliance)
--
-- Old partitions are detached + dropped by pg_partman's maintenance run,
-- which we schedule daily via pg_cron. Queries restricted to a date range
-- only scan the partitions they need (`created_at desc limit 10` only ever
-- touches the current month).
--
-- Migration safety notes
-- ----------------------
-- - These tables have no incoming FKs (verified in this migration's history),
--   so we can recreate them safely.
-- - The new PK is composite `(id, created_at)` — partitioned tables in PG
--   require the partition column to be part of every UNIQUE / PRIMARY KEY
--   constraint. `id` was previously a uuid PK; no code looks up rows by `id`
--   alone (verified with codebase scan: dashboard.ts and audit.ts only do
--   `order by created_at` + `insert ... select`).
-- - Existing rows are copied from the legacy table into the new partitioned
--   parent. pg_partman's `partition_data_proc` handles the partition routing.
-- - RLS policies are re-attached to the new parent; child partitions inherit
--   them automatically (PG 12+ behaviour).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extensions
-- ----------------------------------------------------------------------------
-- pg_partman is the de-facto standard for declarative partition lifecycle
-- management; pg_cron is what we use to schedule its maintenance proc.
-- Both ship with Supabase (hosted + local).
create extension if not exists pg_cron with schema extensions;
create schema if not exists partman;
create extension if not exists pg_partman with schema partman;


-- ----------------------------------------------------------------------------
-- 2. activity_feed → partitioned
-- ----------------------------------------------------------------------------
do $migration$
begin
  -- Skip everything if this table is already partitioned (idempotent re-runs)
  if exists (
    select 1 from pg_partitioned_table
    where partrelid = 'public.activity_feed'::regclass
  ) then
    raise notice 'activity_feed already partitioned, skipping';
    return;
  end if;

  -- Hold the existing rows aside. Rename the indexes too — Postgres
  -- doesn't auto-rename indexes when a table is renamed, so leaving
  -- `activity_company_idx` attached to the legacy table would conflict
  -- with the matching index we're about to create on the new parent.
  execute 'alter table public.activity_feed rename to activity_feed_legacy';
  execute 'alter index if exists activity_company_idx rename to activity_company_idx_legacy';

  -- New parent table — note the composite PK that includes the partition key.
  execute $sql$
    create table public.activity_feed (
      id              uuid not null default gen_random_uuid(),
      company_id      uuid not null references companies(id) on delete cascade,
      user_id         uuid references users(id) on delete set null,
      user_name       text,
      action          text not null,
      entity_type     text not null,
      entity_id       uuid,
      entity_label    text,
      metadata        jsonb,
      created_at      timestamptz not null default now(),
      primary key (id, created_at)
    ) partition by range (created_at);
  $sql$;

  execute 'create index activity_company_idx on public.activity_feed (company_id, created_at desc)';

  -- Re-enable RLS + recreate the same policies that lived on the old table.
  -- We assert these here (rather than relying on the older rls migration to
  -- be re-run) because they're hand-maintained policies and we don't want a
  -- silent change in behaviour.
  execute 'alter table public.activity_feed enable row level security';
  execute 'alter table public.activity_feed force row level security';
  execute $sql$
    create policy activity_select on public.activity_feed for select
      using (company_id = get_user_company_id())
  $sql$;
  -- INSERTs only via service role — no policy.

  -- Register the table with pg_partman for monthly partitioning.
  -- p_premake = 4 → keeps 4 months of future partitions warm.
  -- p_default_table = false → if a write arrives for a date with no
  --   partition we want a hard error (it should never happen with
  --   infinite_time_partitions = true).
  perform partman.create_parent(
    p_parent_table       => 'public.activity_feed',
    p_control            => 'created_at',
    p_interval           => '1 month',
    p_premake            => 4,
    p_default_table      => false
  );

  -- 90-day retention. retention_keep_table=false means "drop the detached
  -- partition", not "leave it as an unattached table forever".
  update partman.part_config
     set retention                 = '90 days',
         retention_keep_table      = false,
         retention_keep_index      = false,
         infinite_time_partitions  = true,
         optimize_constraint       = 30
   where parent_table = 'public.activity_feed';

  -- Copy historical rows into the partitioned set.
  -- This routes each row into the correct monthly partition; pg_partman
  -- handles creating any missing partitions to land older rows.
  insert into public.activity_feed
    (id, company_id, user_id, user_name, action, entity_type, entity_id, entity_label, metadata, created_at)
  select id, company_id, user_id, user_name, action, entity_type, entity_id, entity_label, metadata, created_at
    from public.activity_feed_legacy;

  -- Trigger immediate maintenance so today's + the next few months' partitions exist.
  perform partman.run_maintenance(p_parent_table => 'public.activity_feed');

  drop table public.activity_feed_legacy;
end
$migration$;


-- ----------------------------------------------------------------------------
-- 3. audit_log → partitioned
-- ----------------------------------------------------------------------------
do $migration$
begin
  if exists (
    select 1 from pg_partitioned_table
    where partrelid = 'public.audit_log'::regclass
  ) then
    raise notice 'audit_log already partitioned, skipping';
    return;
  end if;

  execute 'alter table public.audit_log rename to audit_log_legacy';
  execute 'alter index if exists audit_log_company_idx rename to audit_log_company_idx_legacy';
  execute 'alter index if exists audit_log_table_idx   rename to audit_log_table_idx_legacy';

  execute $sql$
    create table public.audit_log (
      id              uuid not null default gen_random_uuid(),
      company_id      uuid not null references companies(id) on delete cascade,
      user_id         uuid references users(id) on delete set null,
      action          text not null,
      table_name      text not null,
      record_id       uuid,
      old_values      jsonb,
      new_values      jsonb,
      ip_address      text,
      user_agent      text,
      created_at      timestamptz not null default now(),
      primary key (id, created_at)
    ) partition by range (created_at);
  $sql$;

  execute 'create index audit_log_company_idx on public.audit_log (company_id, created_at desc)';
  execute 'create index audit_log_table_idx   on public.audit_log (table_name, record_id)';

  execute 'alter table public.audit_log enable row level security';
  execute 'alter table public.audit_log force row level security';
  execute $sql$
    create policy audit_select_owner on public.audit_log for select
      using (company_id = get_user_company_id() and get_user_role() = 'owner')
  $sql$;
  execute $sql$
    create policy audit_select_self on public.audit_log for select
      using (company_id = get_user_company_id() and user_id = get_user_internal_id())
  $sql$;
  -- INSERTs only via service role — no policy.

  perform partman.create_parent(
    p_parent_table       => 'public.audit_log',
    p_control            => 'created_at',
    p_interval           => '1 month',
    p_premake            => 4,
    p_default_table      => false
  );

  -- 7-year retention for audit. Tightens AISC 303 audit-trail compliance:
  -- accreditors expect 5-year minimum; SOX is 7.
  update partman.part_config
     set retention                 = '84 months',
         retention_keep_table      = false,
         retention_keep_index      = false,
         infinite_time_partitions  = true,
         optimize_constraint       = 30
   where parent_table = 'public.audit_log';

  insert into public.audit_log
    (id, company_id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at)
  select id, company_id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at
    from public.audit_log_legacy;

  perform partman.run_maintenance(p_parent_table => 'public.audit_log');

  drop table public.audit_log_legacy;
end
$migration$;


-- ----------------------------------------------------------------------------
-- 4. Schedule daily maintenance via pg_cron
-- ----------------------------------------------------------------------------
-- run_maintenance() walks every pg_partman-managed table, creates any new
-- partitions that should now exist, and drops any partitions outside the
-- retention window. Running it daily at 03:17 UTC (avoiding the top of the
-- hour where other jobs cluster) is plenty — partitions cover full months.
do $$
begin
  -- Drop the old schedule if one exists from a previous attempt at this
  -- migration, so re-runs don't accumulate duplicate cron jobs.
  perform cron.unschedule('fab-partition-maintenance')
    where exists (
      select 1 from cron.job where jobname = 'fab-partition-maintenance'
    );
exception when undefined_table or undefined_function then
  -- cron schema not provisioned (e.g. local dev without pg_cron loaded
  -- as a shared_preload_library). The Supabase hosted instance has this
  -- preloaded; locally `supabase db reset` warms it via the extension.
  null;
end $$;

do $$
begin
  perform cron.schedule(
    'fab-partition-maintenance',
    '17 3 * * *',
    'CALL partman.run_maintenance_proc();'
  );
exception when undefined_table or undefined_function then
  -- Same caveat as above. The application is fully functional without the
  -- cron job; you'll just need to invoke partman.run_maintenance_proc()
  -- manually (or via the /admin/partition-maintenance endpoint we added
  -- alongside this migration).
  raise notice 'pg_cron not active; partition maintenance will need to be triggered manually until cron is enabled';
end $$;


-- ----------------------------------------------------------------------------
-- 5. Grants
-- ----------------------------------------------------------------------------
-- pg_partman creates its own bookkeeping tables in the partman schema;
-- ensure the postgres-admin role can read them through the API for the
-- admin "Partition health" view we expose.
grant usage on schema partman to postgres, service_role;
grant select on partman.part_config to postgres, service_role;
