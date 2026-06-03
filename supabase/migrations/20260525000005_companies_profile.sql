-- ============================================================================
-- FabSimple v5.1 — Extend `companies` with contractor profile fields
--
-- The billing page (AIA G702 PDF) hardcoded `contractor_name: "FabSimple
-- Steel"` because the database had no place to store the customer's actual
-- legal entity. Same gap exists for project headers, future invoices,
-- letterheads, etc. This migration:
--
--   1. Adds the missing contractor profile columns to `companies`.
--   2. Backfills sane defaults for the demo company.
--   3. Adds RLS so every signed-in user can SELECT their own org row but
--      only Owners can UPDATE it.
-- ============================================================================

alter table companies
  add column if not exists legal_name      text,
  add column if not exists address_line1   text,
  add column if not exists address_line2   text,
  add column if not exists city            text,
  add column if not exists state           text,
  add column if not exists zip             text,
  add column if not exists phone           text,
  add column if not exists email           text,
  add column if not exists website         text,
  add column if not exists license_number  text,
  add column if not exists tax_id          text,
  add column if not exists logo_url        text;

comment on column companies.legal_name is
  'Full legal entity name as it appears on contracts (e.g. "NOVUS Steel Engineering, LLC"). Falls back to `name` for display when null.';

-- ---------------------------------------------------------------------------
-- Backfill: demo company gets a fully realistic profile so the AIA G702 PDF
-- and any "letterhead"-style UI has something to display out of the box.
-- ---------------------------------------------------------------------------
update companies set
  legal_name     = coalesce(legal_name,     'NOVUS Steel Engineering, LLC'),
  address_line1  = coalesce(address_line1,  '1450 Industrial Pkwy'),
  address_line2  = coalesce(address_line2,  null),
  city           = coalesce(city,           'Dallas'),
  state          = coalesce(state,          'TX'),
  zip            = coalesce(zip,            '75207'),
  phone          = coalesce(phone,          '(214) 555-0187'),
  email          = coalesce(email,          'office@novussteel.com'),
  website        = coalesce(website,        'https://novussteel.com'),
  license_number = coalesce(license_number, 'TX-CL-0048721'),
  tax_id         = coalesce(tax_id,         '47-1382904'),
  logo_url       = coalesce(logo_url,       null)
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Catch-all for any other companies that might have been created without
-- these fields — set legal_name = name so nothing renders as NULL on PDFs.
update companies
   set legal_name = name
 where legal_name is null;

-- ---------------------------------------------------------------------------
-- RLS: every signed-in user can SELECT their own company row (needed for
-- the org-name lookup on every page header / PDF). Only Owners can UPDATE.
-- ---------------------------------------------------------------------------
alter table companies enable row level security;

drop policy if exists companies_select_own on companies;
create policy companies_select_own on companies
  for select
  using (id = public.get_user_company_id());

drop policy if exists companies_update_owner on companies;
create policy companies_update_owner on companies
  for update
  using (
    id = public.get_user_company_id()
    and exists (
      select 1 from users
       where users.auth_id = auth.uid()
         and users.role = 'owner'
    )
  )
  with check (
    id = public.get_user_company_id()
    and exists (
      select 1 from users
       where users.auth_id = auth.uid()
         and users.role = 'owner'
    )
  );
