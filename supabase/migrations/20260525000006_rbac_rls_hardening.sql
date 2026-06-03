-- ============================================================================
-- FabSimple v5.1 — RLS hardening (CEO security audit response)
--
-- Closes four classes of RLS holes surfaced by the security audit:
--
-- 1. users_update_self  — was `using (auth_id = auth.uid())` with no column
--    restriction, letting any worker call
--      supabase.from('users').update({ role: 'owner' }).eq('auth_id', authUid)
--    directly via the anon-key REST endpoint and pair with the JWT-sync
--    trigger to become owner with no audit trail.
--
-- 2. file_attachments_write  — was `for all` on company_id only, so any
--    worker could DELETE billing PDFs / MTRs / drawings / NCR photos with
--    no audit trail. Splits into per-op policies that gate destructive ops.
--
-- 3. parts_update_worker  — column-level free-for-all. A worker could
--    mutate part_mark / profile / weight / project_id on any part they
--    happened to be assigned to, breaking heat-number traceability.
--
-- 4. Permissive SELECT policies on projects / change_orders / rfis /
--    ncr_reports — RLS let any role read; API permission matrix correctly
--    blocked workers but direct PostgREST (and /search, /copilot) bypassed
--    it. Tighten RLS to mirror the API matrix.
--
-- Idempotent: each policy is dropped before recreate.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. users — workers/PMs/anyone cannot promote themselves
--
-- Self-update via PostgREST is still allowed, but a BEFORE-UPDATE trigger
-- locks every security-relevant column (role, company_id, auth_id, is_active)
-- to its OLD value unless the connection is using the service_role JWT or
-- the caller is an existing owner of the company.
--
-- RLS alone can't do this — WITH CHECK subqueries against the same row see
-- the post-update value, so a `with check (role = (select role from users
-- where auth_id = auth.uid()))` clause always returns true. The trigger
-- compares OLD.role to NEW.role directly.
-- ---------------------------------------------------------------------------
drop policy if exists users_update_self on users;
create policy users_update_self on users for update
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

create or replace function public.fn_users_lock_security_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_is_owner boolean;
begin
  -- Service-role connections (no auth.uid()) bypass — Edge Functions need
  -- to be able to mutate role / company_id / is_active.
  if auth.uid() is null then
    return new;
  end if;

  -- If the caller is the row being updated, lock security columns.
  if new.auth_id = auth.uid() then
    if new.role        is distinct from old.role        then
      raise exception 'role changes must go through an Edge Function (caller cannot self-promote)'
        using errcode = '42501';
    end if;
    if new.company_id  is distinct from old.company_id  then
      raise exception 'company_id changes must go through an Edge Function'
        using errcode = '42501';
    end if;
    if new.auth_id     is distinct from old.auth_id     then
      raise exception 'auth_id is immutable'
        using errcode = '42501';
    end if;
    if new.is_active   is distinct from old.is_active   then
      raise exception 'is_active changes must go through an Edge Function (owner-only)'
        using errcode = '42501';
    end if;
  else
    -- Cross-row update path: only an owner of the same company may flip
    -- another user's role / company_id / is_active.
    select role into caller_role from public.users where auth_id = auth.uid() limit 1;
    caller_is_owner := (caller_role = 'owner');
    if not caller_is_owner then
      if new.role       is distinct from old.role       then
        raise exception 'only owner may change other users.role'
          using errcode = '42501';
      end if;
      if new.company_id is distinct from old.company_id then
        raise exception 'only owner may change other users.company_id'
          using errcode = '42501';
      end if;
      if new.is_active  is distinct from old.is_active  then
        raise exception 'only owner may change other users.is_active'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_lock_security_columns on public.users;
create trigger trg_users_lock_security_columns
before update on public.users
for each row execute function public.fn_users_lock_security_columns();

comment on function public.fn_users_lock_security_columns() is
  'CEO security audit response: prevents privilege escalation via direct PostgREST update of public.users. Service-role (Edge Functions) and existing owners are exempt.';

-- ---------------------------------------------------------------------------
-- 2. file_attachments — destructive ops gated to uploader or owner/pm
-- ---------------------------------------------------------------------------
drop policy if exists file_select on file_attachments;
drop policy if exists file_write on file_attachments;

create policy files_select on file_attachments for select
  using (company_id = get_user_company_id());

-- INSERT: API enforces entity-type RBAC; RLS just makes sure inserts stay in-tenant.
create policy files_insert on file_attachments for insert
  with check (
    company_id = get_user_company_id()
    and uploaded_by = get_user_internal_id()
  );

-- UPDATE: uploader can change metadata on their own attachment; owner/pm can rename anything in tenant.
create policy files_update on file_attachments for update
  using (
    company_id = get_user_company_id()
    and (uploaded_by = get_user_internal_id() or get_user_role() in ('owner','pm'))
  )
  with check (
    company_id = get_user_company_id()
  );

-- DELETE: uploader can remove their own upload; owner / pm can remove anyone's.
-- Workers / estimators / qc / accounting / foreman can only delete what they themselves uploaded.
create policy files_delete on file_attachments for delete
  using (
    company_id = get_user_company_id()
    and (uploaded_by = get_user_internal_id() or get_user_role() in ('owner','pm'))
  );

-- ---------------------------------------------------------------------------
-- 3. parts — worker update is status-only (BEFORE UPDATE trigger lock)
-- ---------------------------------------------------------------------------
-- RLS keeps the original USING/WITH CHECK pair for company_id / assignment.
-- A trigger does the column whitelist, again because WITH CHECK can't read
-- OLD values reliably for self-referential updates.

create or replace function public.fn_parts_worker_column_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into caller_role from public.users where auth_id = auth.uid() limit 1;

  if caller_role = 'worker' then
    if new.part_mark      is distinct from old.part_mark      then
      raise exception 'workers cannot change part_mark' using errcode = '42501';
    end if;
    if new.assembly_mark  is distinct from old.assembly_mark  then
      raise exception 'workers cannot change assembly_mark' using errcode = '42501';
    end if;
    if new.profile        is distinct from old.profile        then
      raise exception 'workers cannot change profile' using errcode = '42501';
    end if;
    if new.grade          is distinct from old.grade          then
      raise exception 'workers cannot change grade' using errcode = '42501';
    end if;
    if new.length         is distinct from old.length         then
      raise exception 'workers cannot change length' using errcode = '42501';
    end if;
    if new.weight         is distinct from old.weight         then
      raise exception 'workers cannot change weight' using errcode = '42501';
    end if;
    if new.quantity       is distinct from old.quantity       then
      raise exception 'workers cannot change quantity' using errcode = '42501';
    end if;
    if new.phase          is distinct from old.phase          then
      raise exception 'workers cannot change phase' using errcode = '42501';
    end if;
    if new.heat_number    is distinct from old.heat_number    then
      raise exception 'workers cannot change heat_number' using errcode = '42501';
    end if;
    if new.drawing_id     is distinct from old.drawing_id     then
      raise exception 'workers cannot change drawing_id' using errcode = '42501';
    end if;
    if new.project_id     is distinct from old.project_id     then
      raise exception 'workers cannot change project_id' using errcode = '42501';
    end if;
    if new.assigned_user_id is distinct from old.assigned_user_id then
      raise exception 'workers cannot reassign parts' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_parts_worker_column_lock on public.parts;
create trigger trg_parts_worker_column_lock
before update on public.parts
for each row execute function public.fn_parts_worker_column_lock();

comment on function public.fn_parts_worker_column_lock() is
  'CEO security audit response: workers can only flip status / notes / completed_at on parts assigned to them. Geometry / traceability / project assignment locked.';

-- ---------------------------------------------------------------------------
-- 4. Tighten permissive SELECT policies so direct PostgREST + /search +
--    /copilot can't leak data the API matrix already hides.
-- ---------------------------------------------------------------------------

-- Projects: Owner/PM/Estimator/Foreman/QC/Accounting (everyone non-worker).
drop policy if exists projects_select on projects;
create policy projects_select on projects for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','estimator','foreman','qc','accounting')
  );

-- Change Orders: Owner / PM / Accounting only (per v5 matrix).
drop policy if exists co_select on change_orders;
create policy co_select on change_orders for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','accounting')
  );

-- RFIs: Owner / PM / Foreman / QC.
drop policy if exists rfis_select on rfis;
create policy rfis_select on rfis for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman','qc')
  );

-- NCR Reports: Owner / PM / Foreman / QC.
drop policy if exists ncr_select on ncr_reports;
create policy ncr_select on ncr_reports for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman','qc')
  );

-- Weld + Paint inspections: Owner / PM / QC.
drop policy if exists weld_select on weld_inspections;
create policy weld_select on weld_inspections for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','qc')
  );

drop policy if exists paint_select on paint_inspections;
create policy paint_select on paint_inspections for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','qc')
  );

-- AISC checklist: Owner / PM / Foreman / QC.
drop policy if exists aisc_select on aisc_checklist;
create policy aisc_select on aisc_checklist for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman','qc')
  );

-- Heat numbers + Certifications: Owner / PM / QC.
drop policy if exists heat_select on heat_numbers;
create policy heat_select on heat_numbers for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','qc')
  );

drop policy if exists cert_select on certifications;
create policy cert_select on certifications for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','qc')
  );

-- OSHA: Owner / PM / Foreman / QC.
drop policy if exists osha_select on osha_checklists;
create policy osha_select on osha_checklists for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman','qc')
  );

-- Daily Production Log / Cut Plans / Erection: Owner / PM / Foreman.
drop policy if exists dpl_select on daily_production_log;
create policy dpl_select on daily_production_log for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman')
  );

drop policy if exists cut_select on cut_plans;
create policy cut_select on cut_plans for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman')
  );

drop policy if exists erec_select on erection_sequence;
create policy erec_select on erection_sequence for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman')
  );

-- Shipping tickets: Owner / PM / Foreman / Accounting.
drop policy if exists ship_select on shipping_tickets;
create policy ship_select on shipping_tickets for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman','accounting')
  );

-- Inventory: Owner / Estimator / PM / Foreman / Accounting (no worker, no QC).
drop policy if exists inv_select on inventory;
create policy inv_select on inventory for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','estimator','pm','foreman','accounting')
  );

drop policy if exists invadj_select on inventory_adjustments;
create policy invadj_select on inventory_adjustments for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman','accounting')
  );

-- GC Contacts: Owner / Estimator / PM.
drop policy if exists gc_select on gc_contacts;
create policy gc_select on gc_contacts for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','estimator','pm')
  );

-- Assemblies + Drawings: Owner / PM / Foreman / QC (+ worker for drawings via QR deep link).
drop policy if exists assemblies_select on assemblies;
create policy assemblies_select on assemblies for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman','qc')
  );

drop policy if exists drawings_select on drawings;
create policy drawings_select on drawings for select
  using (
    company_id = get_user_company_id()
    and get_user_role() in ('owner','pm','foreman','qc','worker')
  );
