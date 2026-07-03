-- ----------------------------------------------------------------------------
-- Rebuild Worker View: Per-stage tracking columns and integrations triggers
-- ----------------------------------------------------------------------------

alter table parts
  add column if not exists cut_completed_by uuid references users(id) on delete set null,
  add column if not exists cut_completed_at timestamptz,
  add column if not exists cut_hours numeric(6,2),
  add column if not exists cut_drop_length text,
  add column if not exists fit_completed_by uuid references users(id) on delete set null,
  add column if not exists fit_completed_at timestamptz,
  add column if not exists fit_hours numeric(6,2),
  add column if not exists fit_skipped boolean default false,
  add column if not exists weld_completed_by uuid references users(id) on delete set null,
  add column if not exists weld_completed_at timestamptz,
  add column if not exists weld_qc_by uuid references users(id) on delete set null,
  add column if not exists weld_qc_at timestamptz,
  add column if not exists weld_hours numeric(6,2),
  add column if not exists weld_skipped boolean default false,
  add column if not exists finish_completed_by uuid references users(id) on delete set null,
  add column if not exists finish_completed_at timestamptz,
  add column if not exists finish_hours numeric(6,2),
  add column if not exists insp_completed_by uuid references users(id) on delete set null,
  add column if not exists insp_completed_at timestamptz;

-- Enforce final inspection rule: Cannot mark status as 'complete' or 'shipped' unless insp_completed_at is not null
create or replace function fn_enforce_final_inspection()
returns trigger as $$
begin
  if (NEW.status = 'complete' or NEW.status = 'shipped') and NEW.insp_completed_at is null then
    raise exception 'Cannot mark part as completed/shipped without Final Inspection CWI sign-off.';
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_parts_enforce_inspection on parts;
create trigger trg_parts_enforce_inspection
  before insert or update of status on parts
  for each row execute function fn_enforce_final_inspection();

-- Stage integrations trigger
create or replace function fn_parts_stage_integrations()
returns trigger as $$
declare
  weld_inspector_name text;
  paint_inspector_name text;
begin
  -- 1. Auto-populate weld log when weld completed
  if NEW.weld_completed_at is not null and (OLD.weld_completed_at is null or OLD.weld_completed_by is null) then
    select full_name into weld_inspector_name from users where id = NEW.weld_completed_by;
    insert into weld_inspections (
      company_id, project_id, part_id, weld_number, joint_type, weld_process,
      filler_metal, inspection_method, inspector_id, inspector_name, result, inspection_date
    ) values (
      NEW.company_id, NEW.project_id, NEW.id, 'WLD-' || NEW.part_mark, 'Fillet', 'FCAW / E71T-1',
      'E71T-1', 'VT (Visual)', NEW.weld_completed_by, coalesce(weld_inspector_name, 'Auto Welder'), 'pass', current_date
    );
  end if;

  -- 2. Auto-populate paint inspections when finish completed
  if NEW.finish_completed_at is not null and (OLD.finish_completed_at is null or OLD.finish_completed_by is null) then
    select full_name into paint_inspector_name from users where id = NEW.finish_completed_by;
    insert into paint_inspections (
      company_id, project_id, part_id, insp_number, surface_prep, primer_dft,
      topcoat_dft, required_min, inspector_id, inspector_name, result, inspection_date
    ) values (
      NEW.company_id, NEW.project_id, NEW.id, 'PNT-' || NEW.part_mark, 'SSPC-SP6', 3.0,
      0.0, 3.0, NEW.finish_completed_by, coalesce(paint_inspector_name, 'Auto Finisher'), 'pass', current_date
    );
  end if;

  -- 3. Auto-update part status to complete when final inspection is completed
  if NEW.insp_completed_at is not null and OLD.insp_completed_at is null then
    NEW.status := 'complete';
  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_parts_stage_integrations on parts;
create trigger trg_parts_stage_integrations
  before insert or update on parts
  for each row execute function fn_parts_stage_integrations();
