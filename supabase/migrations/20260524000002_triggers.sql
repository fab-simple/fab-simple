-- ============================================================================
-- FabSimple v5.1 — Triggers
-- updated_at + auto-NCR on inspection fail + audit/activity + assembly progress
-- ============================================================================

-- ----------------------------------------------------------------------------
-- updated_at on every table that has the column
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
    group by table_name
  loop
    execute format(
      'drop trigger if exists trg_%s_updated_at on public.%I; '
      'create trigger trg_%s_updated_at before update on public.%I '
      'for each row execute function fn_set_updated_at();',
      t, t, t, t
    );
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- AUTO-NCR on inspection fail (paint or weld)
-- ----------------------------------------------------------------------------
create or replace function fn_auto_ncr_on_inspection_fail()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ncr_number text;
  v_actor uuid;
  v_user_name text;
  v_inspection_type text;
  v_ref_label text;
begin
  if NEW.result <> 'fail' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.result = 'fail' then
    return NEW;  -- already failed; don't double-create
  end if;

  v_ncr_number := next_sequence_number(NEW.company_id, 'ncr_reports', 'NCR', 4);
  v_actor := coalesce(NEW.inspector_id, get_user_internal_id());

  if TG_TABLE_NAME = 'paint_inspections' then
    v_inspection_type := 'paint';
    v_ref_label := coalesce(NEW.insp_number, NEW.id::text);
  else
    v_inspection_type := 'weld';
    v_ref_label := coalesce(NEW.weld_number, NEW.id::text);
  end if;

  insert into ncr_reports(
    company_id, project_id, part_id, ncr_number,
    source_inspection_id, source_inspection_type,
    description, status, blocks_shipping, assigned_to, created_by
  ) values (
    NEW.company_id, NEW.project_id, NEW.part_id, v_ncr_number,
    NEW.id, v_inspection_type,
    'Auto-generated from failed ' || v_inspection_type || ' inspection ' || v_ref_label,
    'open', true, v_actor, v_actor
  );

  select full_name into v_user_name from users where id = v_actor;
  insert into activity_feed(company_id, user_id, user_name, action, entity_type, entity_id, entity_label, metadata)
  values (NEW.company_id, v_actor, coalesce(v_user_name, 'System'),
          'created NCR from failed inspection', 'ncr_reports', NEW.id,
          v_ncr_number, jsonb_build_object('inspection_type', v_inspection_type));

  return NEW;
end;
$$;

drop trigger if exists trg_paint_auto_ncr on paint_inspections;
create trigger trg_paint_auto_ncr
  after insert or update on paint_inspections
  for each row execute function fn_auto_ncr_on_inspection_fail();

drop trigger if exists trg_weld_auto_ncr on weld_inspections;
create trigger trg_weld_auto_ncr
  after insert or update on weld_inspections
  for each row execute function fn_auto_ncr_on_inspection_fail();

-- ----------------------------------------------------------------------------
-- Auto paint result based on total_dft vs required_min
-- ----------------------------------------------------------------------------
create or replace function fn_paint_auto_result()
returns trigger
language plpgsql
as $$
begin
  if NEW.required_min > 0 then
    if NEW.total_dft >= NEW.required_min then
      NEW.result := 'pass';
    else
      NEW.result := 'fail';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_paint_auto_result on paint_inspections;
create trigger trg_paint_auto_result
  before insert or update on paint_inspections
  for each row execute function fn_paint_auto_result();

-- ----------------------------------------------------------------------------
-- Assembly progress: increment completed_parts on part status change
-- ----------------------------------------------------------------------------
create or replace function fn_assembly_progress()
returns trigger
language plpgsql
as $$
declare
  v_assembly_id uuid;
begin
  select id into v_assembly_id from assemblies
  where company_id = NEW.company_id
    and project_id = NEW.project_id
    and assembly_mark = NEW.assembly_mark;
  if v_assembly_id is null then return NEW; end if;

  update assemblies set
    total_parts = (select count(*) from parts
                   where company_id = NEW.company_id and assembly_mark = NEW.assembly_mark),
    completed_parts = (select count(*) from parts
                       where company_id = NEW.company_id and assembly_mark = NEW.assembly_mark
                         and status in ('complete','shipped'))
  where id = v_assembly_id;
  return NEW;
end;
$$;

drop trigger if exists trg_parts_assembly_progress on parts;
create trigger trg_parts_assembly_progress
  after insert or update of status, assembly_mark on parts
  for each row execute function fn_assembly_progress();

-- ----------------------------------------------------------------------------
-- Bump heat_numbers.parts_count when parts.heat_number changes
-- ----------------------------------------------------------------------------
create or replace function fn_heat_parts_count()
returns trigger
language plpgsql
as $$
begin
  if NEW.heat_number is null then return NEW; end if;
  update heat_numbers
    set parts_count = (
      select count(*) from parts
      where company_id = NEW.company_id and heat_number = NEW.heat_number
    )
    where company_id = NEW.company_id and heat_number = NEW.heat_number;
  return NEW;
end;
$$;

drop trigger if exists trg_parts_heat_count on parts;
create trigger trg_parts_heat_count
  after insert or update of heat_number on parts
  for each row execute function fn_heat_parts_count();

-- ----------------------------------------------------------------------------
-- Drawing supersede: when a new revision is created, mark old as superseded
-- ----------------------------------------------------------------------------
create or replace function fn_drawing_supersede()
returns trigger
language plpgsql
as $$
begin
  if NEW.current_revision then
    update drawings
      set current_revision = false, status = 'superseded'
      where company_id = NEW.company_id
        and project_id = NEW.project_id
        and drawing_number = NEW.drawing_number
        and id <> NEW.id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_drawing_supersede on drawings;
create trigger trg_drawing_supersede
  after insert or update on drawings
  for each row execute function fn_drawing_supersede();

-- ----------------------------------------------------------------------------
-- Billing pct_complete sanity: ensure new app ≥ previous app
-- ----------------------------------------------------------------------------
create or replace function fn_billing_pct_monotonic()
returns trigger
language plpgsql
as $$
declare
  v_prev numeric;
begin
  select max(pct_complete) into v_prev
  from billing_applications
  where project_id = NEW.project_id
    and application_number < NEW.application_number;
  if v_prev is not null and NEW.pct_complete < v_prev then
    raise exception 'pct_complete (%) cannot be less than previous application (%)', NEW.pct_complete, v_prev;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_billing_monotonic on billing_applications;
create trigger trg_billing_monotonic
  before insert or update on billing_applications
  for each row execute function fn_billing_pct_monotonic();

-- ----------------------------------------------------------------------------
-- Job cost auto-rollup helper (called by Edge Function after PO receipt)
-- ----------------------------------------------------------------------------
create or replace function fn_recompute_job_cost(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update job_costs jc set actual_amount = coalesce(t.actual, 0)
  from (
    select project_id, 'material' as cost_code, sum(total_amount) as actual
    from purchase_orders
    where project_id = p_project_id and status in ('received','partial','closed')
    group by project_id
  ) t
  where jc.project_id = t.project_id and jc.cost_code = t.cost_code;
end;
$$;
