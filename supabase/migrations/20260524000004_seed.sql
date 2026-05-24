-- ============================================================================
-- FabSimple v5.1 — Seed data
-- One demo company "NOVUSsteel Demo Shop", 7 demo users (one per role),
-- 4 active projects, sample parts/drawings/QC/inventory. Idempotent via
-- ON CONFLICT — safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auth users (use Supabase admin API to create at runtime; here we
-- pre-insert into auth.users so local dev has the rows ready)
-- ----------------------------------------------------------------------------
-- These auth.user UUIDs are deterministic so the seed can refer to them.

-- GoTrue's Go scan layer requires empty strings (not NULL) for token columns.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token, is_sso_user, is_anonymous
)
select
  u.id::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated',
  u.email,
  crypt('demo123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name),
  now(), now(),
  '', '', '', '', '', '', '', '',
  false, false
from (values
  ('00000000-0000-0000-0000-000000000001', 'owner@demo.fabsimple.io',      'Vinay Patel'),
  ('00000000-0000-0000-0000-000000000002', 'pm@demo.fabsimple.io',         'Sarah Mitchell'),
  ('00000000-0000-0000-0000-000000000003', 'estimator@demo.fabsimple.io',  'David Park'),
  ('00000000-0000-0000-0000-000000000004', 'foreman@demo.fabsimple.io',    'Marcus Johnson'),
  ('00000000-0000-0000-0000-000000000005', 'qc@demo.fabsimple.io',         'Linda Chen'),
  ('00000000-0000-0000-0000-000000000006', 'accounting@demo.fabsimple.io', 'Rachel Kim'),
  ('00000000-0000-0000-0000-000000000007', 'worker@demo.fabsimple.io',     'Roberto Torres')
) as u(id, email, full_name)
on conflict (id) do nothing;

-- Identities (required by GoTrue for password sign-in)
insert into auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  u.id,
  'email',
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  now(),
  now(),
  now()
from auth.users u
where u.email like '%@demo.fabsimple.io'
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
  );

-- ----------------------------------------------------------------------------
-- Company
-- ----------------------------------------------------------------------------
insert into companies (id, name, aisc_cert, plan, max_parts, max_projects, max_users)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NOVUSsteel Demo Shop', true, 'professional', 50000, 25, 25)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Users
-- ----------------------------------------------------------------------------
insert into users (id, auth_id, company_id, role, full_name, email, is_active)
values
  ('11111111-1111-1111-1111-111111111101', '00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner',      'Vinay Patel',     'owner@demo.fabsimple.io', true),
  ('11111111-1111-1111-1111-111111111102', '00000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pm',         'Sarah Mitchell',  'pm@demo.fabsimple.io', true),
  ('11111111-1111-1111-1111-111111111103', '00000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'estimator',  'David Park',      'estimator@demo.fabsimple.io', true),
  ('11111111-1111-1111-1111-111111111104', '00000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'foreman',    'Marcus Johnson',  'foreman@demo.fabsimple.io', true),
  ('11111111-1111-1111-1111-111111111105', '00000000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'qc',         'Linda Chen',      'qc@demo.fabsimple.io', true),
  ('11111111-1111-1111-1111-111111111106', '00000000-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'accounting', 'Rachel Kim',      'accounting@demo.fabsimple.io', true),
  ('11111111-1111-1111-1111-111111111107', '00000000-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'worker',     'Roberto Torres',  'worker@demo.fabsimple.io', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Subscription
-- ----------------------------------------------------------------------------
insert into subscriptions (company_id, plan, status, max_users, max_projects)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'professional', 'active', 25, 25)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Projects
-- ----------------------------------------------------------------------------
insert into projects (id, company_id, name, number, gc_name, contract_value, contract_type, est_tonnage, status, pm_id, start_date, deadline, description, color)
values
  ('22222222-2222-2222-2222-222222222201', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dallas Skyline Tower', 'PRJ-2026-0001', 'Turner Construction', 612000, 'Lump Sum', 320, 'active', '11111111-1111-1111-1111-111111111102', '2026-02-01', '2026-06-30', '14-story commercial tower — structural steel and misc metals', '#4F46E5'),
  ('22222222-2222-2222-2222-222222222202', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Houston Refinery Exp.', 'PRJ-2026-0002', 'Bechtel Corp', 378000, 'GMP', 195, 'active', '11111111-1111-1111-1111-111111111102', '2026-03-15', '2026-09-15', 'Process equipment framing and structural expansion', '#2563EB'),
  ('22222222-2222-2222-2222-222222222203', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Austin Data Center', 'PRJ-2026-0003', 'Apple Inc', 824000, 'Lump Sum', 410, 'active', '11111111-1111-1111-1111-111111111102', '2026-04-01', '2026-12-01', 'Data center structural frame with galvanized exterior HSS', '#7C3AED'),
  ('22222222-2222-2222-2222-222222222204', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'San Antonio Bridge',   'PRJ-2026-0004', 'TXDOT', 1240000, 'Unit Price', 580, 'active', '11111111-1111-1111-1111-111111111102', '2026-01-10', '2027-03-30', 'Pedestrian bridge superstructure with galvanized handrails', '#0D9488')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Drawings
-- ----------------------------------------------------------------------------
insert into drawings (id, company_id, project_id, drawing_number, revision, title, type, status, current_revision, date_issued, approved_by)
values
  ('33333333-3333-3333-3333-333333333301', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'DS-101', 'D', 'Tower frame lvl 1-4', 'shop', 'approved', true, '2026-02-15', '11111111-1111-1111-1111-111111111102'),
  ('33333333-3333-3333-3333-333333333302', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'DS-102', 'C', 'Tower frame lvl 5-9', 'shop', 'approved', true, '2026-02-20', '11111111-1111-1111-1111-111111111102'),
  ('33333333-3333-3333-3333-333333333303', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'DS-104', 'D', 'Bracing detail',     'shop', 'approved', true, '2026-03-01', '11111111-1111-1111-1111-111111111102'),
  ('33333333-3333-3333-3333-333333333304', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222202', 'HR-201', 'B', 'Refinery framing N', 'shop', 'released', true, '2026-03-20', '11111111-1111-1111-1111-111111111102')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Parts (sample)
-- ----------------------------------------------------------------------------
insert into parts (company_id, project_id, part_mark, assembly_mark, profile, grade, length, weight, quantity, status, phase, heat_number, drawing_id, assigned_user_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'W14x82-1044', 'A-204', 'W14x82', 'A992', 24.5, 2009, 1, 'in_progress', 'P2', 'HT-23845', '33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111107'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'HSS6x6-0312', 'B-108', 'HSS6x6x3/8', 'A500-C', 18.0, 540, 1, 'in_progress', 'P2', 'HT-23846', '33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111107'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'W12x65-2104', 'A-205', 'W12x65', 'A992', 22.0, 1430, 1, 'complete', 'P1', 'HT-23845', '33333333-3333-3333-3333-333333333301', null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'L4x4x1/2-0801', 'C-110', 'L4x4x1/2', 'A36', 12.0, 145, 1, 'not_started', 'P1', null, '33333333-3333-3333-3333-333333333302', null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222202', 'W18x46-3001', 'D-201', 'W18x46', 'A992', 28.0, 1288, 1, 'shipped', 'P1', 'HT-23800', '33333333-3333-3333-3333-333333333304', null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222203', 'C10x15.3-4001', 'E-301', 'C10x15.3', 'A36', 20.0, 306, 1, 'in_progress', 'P1', 'HT-23900', null, '11111111-1111-1111-1111-111111111107')
on conflict (company_id, project_id, part_mark) do nothing;

-- ----------------------------------------------------------------------------
-- Assemblies
-- ----------------------------------------------------------------------------
insert into assemblies (company_id, project_id, assembly_mark, description, total_weight, total_parts, completed_parts, status)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'A-204', 'NE Corner column assembly', 12500, 6, 2, 'in_progress'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'A-205', 'Lvl 2 girder', 8200, 4, 4, 'complete'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'B-108', 'X-brace truss',           4100, 8, 3, 'in_progress')
on conflict (company_id, project_id, assembly_mark) do nothing;

-- ----------------------------------------------------------------------------
-- Heat numbers
-- ----------------------------------------------------------------------------
insert into heat_numbers (company_id, heat_number, material_grade, mill_name, supplier, mtr_status, parts_count)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HT-23845', 'A992', 'Nucor Steel', 'Triple S Steel', 'verified', 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HT-23846', 'A500-C', 'Steel Dynamics', 'Triple S Steel', 'received', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HT-23800', 'A992', 'Nucor Steel', 'Reliance Steel', 'verified', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HT-23900', 'A36',  'Gerdau',      'Reliance Steel', 'pending', 1)
on conflict (company_id, heat_number) do nothing;

-- ----------------------------------------------------------------------------
-- Inventory
-- ----------------------------------------------------------------------------
insert into inventory (company_id, profile, grade, quantity, location, reorder_point, max_stock, unit_cost)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'W14x82', 'A992', 24, 'Bay 1', 10, 50, 1240),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'W12x65', 'A992', 8,  'Bay 1', 10, 40, 980),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HSS6x6x3/8', 'A500-C', 0,  'Bay 2', 8,  30, 415),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'L4x4x1/2', 'A36', 42, 'Bay 3', 15, 80, 165),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'C10x15.3','A36', 18, 'Bay 3', 10, 60, 287)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- AISC 303-10 checklist seed (24 items, 7 categories)
-- These get cloned into each new project via POST /seed-aisc
-- ----------------------------------------------------------------------------
do $$
declare
  v_company uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_project uuid := '22222222-2222-2222-2222-222222222201';
  items text[][] := array[
    array['Materials','§6.1','Mill test reports received and verified'],
    array['Materials','§6.1','Material grade matches contract specification'],
    array['Materials','§6.2','Heat numbers traceable to all members'],
    array['Materials','§6.3','Bolts conform to A325/A490 with proper markings'],
    array['Fabrication','§5.1','Cutting tolerances verified per §5.1'],
    array['Fabrication','§5.2','Drilling and reaming tolerances per §5.2'],
    array['Fabrication','§5.3','Bend radii and cold-bend ratios per §5.3'],
    array['Welding','§6.4','WPS approved and on file'],
    array['Welding','§6.4','Welder qualification records current'],
    array['Welding','§6.5','Weld VT/UT/MT/PT per applicable AWS D1.1'],
    array['Welding','§6.5','CWI inspector certification valid'],
    array['Connections','§7.1','Bolt installation method verified (turn-of-nut/torque)'],
    array['Connections','§7.2','Faying surfaces prepared per slip-critical class'],
    array['Connections','§7.3','Pretensioned bolts verified with Skidmore'],
    array['Erection','§8.1','Erection drawings reviewed and field-marked'],
    array['Erection','§8.2','Plumb, level and alignment within tolerance'],
    array['Erection','§8.3','Anchor rod survey verified pre-erection'],
    array['Erection','§8.4','Temporary bracing per erector engineer'],
    array['Coatings','§9.1','Surface prep per SSPC class verified'],
    array['Coatings','§9.2','Primer DFT meets project specification'],
    array['Coatings','§9.3','Topcoat DFT and total DFT within tolerance'],
    array['Coatings','§9.4','Galvanized coating thickness per ASTM A123'],
    array['Documentation','§10.1','Inspection reports submitted weekly'],
    array['Documentation','§10.2','Non-conformance reports closed before shipment']
  ];
  i int;
begin
  for i in 1 .. array_length(items, 1) loop
    insert into aisc_checklist (company_id, project_id, category, section_ref, item_text, sort_order, status)
    values (v_company, v_project, items[i][1], items[i][2], items[i][3], i, 'open')
    on conflict do nothing;
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- OSHA persistent checklist (per company, not per project)
-- ----------------------------------------------------------------------------
do $$
declare
  v_company uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  items text[][] := array[
    array['PPE','29 CFR 1910.132','Hard hats issued and inspected'],
    array['PPE','29 CFR 1910.133','Safety glasses required in shop'],
    array['Welding Safety','29 CFR 1910.252','Hot work permit posted'],
    array['Welding Safety','29 CFR 1910.252','Welding screens and ventilation in place'],
    array['Fall Protection','29 CFR 1926.501','Fall arrest > 6ft documented'],
    array['Cranes','29 CFR 1926.1400','Crane operator certification current'],
    array['Cranes','29 CFR 1926.1412','Annual crane inspection on file'],
    array['Fire Safety','29 CFR 1910.157','Extinguishers inspected monthly'],
    array['Material Handling','29 CFR 1910.176','Rigging gear inspected pre-shift'],
    array['First Aid','29 CFR 1910.151','First aid kits stocked and accessible']
  ];
  i int;
begin
  for i in 1 .. array_length(items, 1) loop
    insert into osha_checklists (company_id, category, section_ref, item_text, sort_order, status)
    values (v_company, items[i][1], items[i][2], items[i][3], i, 'open')
    on conflict do nothing;
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- Certifications (with upcoming expiries to drive alerts)
-- ----------------------------------------------------------------------------
insert into certifications (company_id, cert_type, holder_name, cert_number, issue_date, expiry_date, alert_days)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CWI', 'Linda Chen', 'AWS-CWI-23145', '2023-08-15', current_date + interval '18 days',  30),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AWS D1.1 Welder', 'Roberto Torres', 'WPS-3G-882', '2024-05-10', current_date + interval '90 days', 30),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Crane Operator', 'Marcus Johnson', 'NCCCO-CC-9921', '2022-11-01', current_date + interval '24 days',  30),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AISC Certified Fab Shop', 'NOVUSsteel Demo Shop', 'AISC-1245', '2024-01-01', current_date + interval '8 months', 60)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Sample daily production log
-- ----------------------------------------------------------------------------
insert into daily_production_log (company_id, project_id, log_date, shift, station, operators, parts_completed, hours_worked, operation_type, notes, created_by)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', current_date - 4, 'Day', 'Bay 1 / Cutting', array['Roberto Torres','Marcus Johnson'], 88,  16, 'Cutting',   'Plasma table running smoothly', '11111111-1111-1111-1111-111111111104'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', current_date - 3, 'Day', 'Bay 2 / Welding', array['Roberto Torres'],                       102, 16, 'Welding',   '4 weld inspections passed', '11111111-1111-1111-1111-111111111104'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', current_date - 2, 'Day', 'Paint Booth',     array['Marcus Johnson'],                       91,  14, 'Painting',  'DFT readings in spec', '11111111-1111-1111-1111-111111111104'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', current_date - 1, 'Day', 'Bay 1 / Cutting', array['Roberto Torres','Marcus Johnson'], 118, 16, 'Cutting',   'Best day this quarter', '11111111-1111-1111-1111-111111111104'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', current_date,     'Day', 'Bay 2 / Welding', array['Roberto Torres'],                       73,  10, 'Welding',   'Started late — crane maintenance', '11111111-1111-1111-1111-111111111104')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Sample activity feed (recent events visible on dashboard)
-- ----------------------------------------------------------------------------
insert into activity_feed (company_id, user_id, user_name, action, entity_type, entity_id, entity_label, metadata, created_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111107', 'Roberto Torres', 'updated part status to In Progress', 'parts',    null, 'W14x82-1044', '{}'::jsonb, now() - interval '2 minutes'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111104', 'Marcus Johnson', 'logged daily production',            'daily_production_log', null, 'Bay 1', '{}'::jsonb, now() - interval '12 minutes'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111105', 'Linda Chen',     'passed weld inspection',             'weld_inspections', null, 'WLD-0042', '{}'::jsonb, now() - interval '34 minutes'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111102', 'Sarah Mitchell', 'approved change order',              'change_orders', null, 'CO-042', '{"amount":12400}'::jsonb, now() - interval '1 hour'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111101', 'Vinay Patel',    'created project',                    'projects', '22222222-2222-2222-2222-222222222203', 'Austin Data Center', '{}'::jsonb, now() - interval '3 hours')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- A couple of pending notifications
-- ----------------------------------------------------------------------------
insert into notifications (company_id, user_id, type, title, message, entity_type, entity_link)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111105', 'cert_expiry',   'CWI cert expiring in 18 days', 'Linda Chen — renew AWS-CWI-23145',   'certifications', '/dashboard/certifications'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111104', 'inventory_low', 'HSS6x6x3/8 out of stock',     'Reorder before tomorrow shift',      'inventory',      '/dashboard/inventory'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111101', 'co_approved',   'CO-042 approved by Sarah',    'Contract value updated to $624,400', 'change_orders',  '/dashboard/change-orders');

-- ----------------------------------------------------------------------------
-- Storage buckets
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('drawings', 'drawings', false),
  ('mtrs',     'mtrs',     false),
  ('photos',   'photos',   false),
  ('billing',  'billing',  false)
on conflict do nothing;
