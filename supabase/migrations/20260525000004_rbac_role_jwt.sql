-- ============================================================================
-- FabSimple v5.1 — Stamp public.users.role into the JWT
--
-- The Next.js middleware uses `user.app_metadata.role` to gate routes per the
-- v5 Role-Based Access Matrix. Demo and invited users have their role written
-- to public.users but not to auth.users.raw_app_meta_data, so the JWT never
-- carries the role claim and the middleware silently grants access to every
-- page.
--
-- This migration:
--   1. Backfills `raw_app_meta_data.role` for every existing user.
--   2. Creates a trigger so future inserts / role-changes on public.users
--      automatically sync into auth.users.raw_app_meta_data.
--
-- Users currently signed-in must refresh their session (or wait for the next
-- token refresh) for the new claim to appear in their JWT.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Backfill — write role into raw_app_meta_data for every linked auth user.
-- ---------------------------------------------------------------------------
update auth.users au
set raw_app_meta_data = coalesce(au.raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object(
                             'role', pu.role::text,
                             'company_id', pu.company_id::text
                           )
from public.users pu
where pu.auth_id = au.id
  and (
        coalesce(au.raw_app_meta_data ->> 'role', '') <> pu.role::text
        or coalesce(au.raw_app_meta_data ->> 'company_id', '') <> pu.company_id::text
      );

-- ---------------------------------------------------------------------------
-- 2. Trigger — keep auth.users.raw_app_meta_data in sync going forward.
-- ---------------------------------------------------------------------------
create or replace function public.fn_sync_user_role_to_jwt()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.auth_id is null then
    return new;
  end if;

  if (tg_op = 'INSERT')
     or (new.role is distinct from old.role)
     or (new.company_id is distinct from old.company_id)
     or (new.auth_id is distinct from old.auth_id)
  then
    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                                || jsonb_build_object(
                                     'role',       new.role::text,
                                     'company_id', new.company_id::text
                                   )
     where id = new.auth_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_user_role_to_jwt on public.users;
create trigger trg_sync_user_role_to_jwt
after insert or update of role, company_id, auth_id
on public.users
for each row
execute function public.fn_sync_user_role_to_jwt();

-- ---------------------------------------------------------------------------
-- 3. Helper view — debug-only; lets owners quickly verify role claims.
-- ---------------------------------------------------------------------------
create or replace view public.v_user_role_claims as
select
  pu.id                                  as user_id,
  pu.email,
  pu.role::text                          as table_role,
  au.raw_app_meta_data ->> 'role'        as jwt_role,
  au.raw_app_meta_data ->> 'company_id'  as jwt_company_id,
  pu.company_id::text                    as table_company_id,
  (pu.role::text = au.raw_app_meta_data ->> 'role') as in_sync
from public.users pu
join auth.users au on au.id = pu.auth_id;

comment on view public.v_user_role_claims is
  'RBAC debug: compares public.users.role with the JWT app_metadata.role written into auth.users.';
