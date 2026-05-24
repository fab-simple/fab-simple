-- ============================================================================
-- FabSimple — Full demo seed.
--
-- Loads every dataset that previously lived in `lib/mock-data.ts` into the
-- existing demo company (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa) so every
-- dashboard page renders with real, backend-driven data when an owner
-- demos the product.
--
-- Idempotent: re-running is safe (ON CONFLICT DO NOTHING on every insert).
-- ============================================================================

-- Stable IDs used by this migration and referenced by FK rows below.
-- prefix 22 = projects, 33 = drawings, 44 = parts, 55 = assemblies,
-- 66 = purchase_orders, 77 = change_orders, 88 = rfis, 99 = estimates,
-- aa = gc_contacts, bb = billing, cc = job costs, dd = paint inspections,
-- ee = weld inspections, ff = ncr, 5h = shipping, 6e = erection,
-- 7c = cut plans.

-- ----------------------------------------------------------------------------
-- 1. GC contacts (all four projects + bridge)
-- ----------------------------------------------------------------------------
insert into gc_contacts (id, company_id, project_id, gc_company, contact_name, role, email, phone, last_contact)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000aa01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'Turner Construction', 'Mark Johnson',  'Project Manager',       'm.johnson@turner.com', '(214) 555-0182', current_date - 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000aa02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'Turner Construction', 'Sarah Kim',     'Field Superintendent',  's.kim@turner.com',     '(214) 555-0199', current_date - 3),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000aa03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222202', 'Bechtel Corp',        'Steve Chen',    'Project Engineer',      's.chen@bechtel.com',   '(713) 555-0241', current_date - 5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000aa04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222203', 'Apple Inc',           'David Park',    'Owner''s Rep',          'd.park@apple.com',     '(512) 555-0341', current_date - 7),
  ('aaaaaaaa-aaaa-aaaa-aaaa-00000000aa05', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222204', 'PCL Construction',    'James Wright',  'Project Manager',       'j.wright@pcl.com',     '(210) 555-0441', current_date - 14)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Estimates (one Won, one Submitted, one Pending)
-- ----------------------------------------------------------------------------
insert into estimates (id, company_id, estimate_number, project_name, gc_name, status, total_amount, structural_tons, misc_metal_lbs, margin_pct, bid_due_date, submitted_at, won_at, created_by)
values
  ('99999999-aaaa-aaaa-aaaa-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'EST-2026-041', 'Dallas Office Bldg',  'Turner Const.', 'submitted', 612000, 142, 18400, 22.4, '2026-04-15', now() - interval '30 days', null, '11111111-1111-1111-1111-111111111103'),
  ('99999999-aaaa-aaaa-aaaa-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'EST-2026-040', 'Houston Warehouse',   'Procon LLC',    'won',       378000,  88,  9200, 19.8, '2026-03-30', now() - interval '50 days', now() - interval '20 days', '11111111-1111-1111-1111-111111111103'),
  ('99999999-aaaa-aaaa-aaaa-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'EST-2026-039', 'Austin Parking Garage','CBRE',          'draft',     824000, 201,  4100, 21.0, '2026-04-20', null, null, '11111111-1111-1111-1111-111111111103')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Change orders (2 pending, 2 approved)
-- ----------------------------------------------------------------------------
insert into change_orders (id, company_id, project_id, co_number, description, amount, status, drawing_rev, submitted_by, approved_by, approved_at, notes)
values
  ('77777777-7777-7777-7777-000000000041', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'CO-041', 'Add (8) W6×15 beams — Level 12 grid extension',     14800.00, 'pending',  'Rev D', '11111111-1111-1111-1111-111111111102', null, null, 'Turner GC requested grid extension'),
  ('77777777-7777-7777-7777-000000000040', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'CO-040', 'Revise (12) base plate details — add gusset',        8400.00, 'approved', 'Rev C', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111101', now() - interval '4 days', 'EOR requested for seismic adequacy'),
  ('77777777-7777-7777-7777-000000000039', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222202', 'CO-039', 'Additional (24) misc angle clips',                   3200.00, 'approved', 'Rev B', '11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111101', now() - interval '10 days', 'Billed App. #3'),
  ('77777777-7777-7777-7777-000000000038', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222203', 'CO-038', 'Galvanize all exterior HSS — spec change',          21600.00, 'pending',  'Rev A', '11111111-1111-1111-1111-111111111102', null, null, 'Apple owner''s rep requested galv')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. RFIs (one open, two answered)
-- ----------------------------------------------------------------------------
insert into rfis (id, company_id, project_id, rfi_number, question, answer, status, submitted_by, submitted_to, date_answered)
values
  ('88888888-8888-8888-8888-000000000081', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'RFI-0081', 'Confirm W14×82 base plate hole pattern — conflicts with DS-104 Rev D and structural calc', null,                                                                              'open',     '11111111-1111-1111-1111-111111111102', 'Smith Engineering (EOR)', null),
  ('88888888-8888-8888-8888-000000000080', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222202', 'RFI-0080', 'ASTM A36 vs A572 Gr.50 for gusset plates — spec sheet ambiguous',                          'Use A572 Gr.50 for all gusset plates per structural notes §5.4',                  'answered', '11111111-1111-1111-1111-111111111102', 'Bechtel Design',          current_date - 7),
  ('88888888-8888-8888-8888-000000000079', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222203', 'RFI-0079', 'Galvanizing spec for exterior HSS — ASTM A123 or A153?',                                    'ASTM A123 for all members > 1/8". A153 for hardware only.',                       'answered', '11111111-1111-1111-1111-111111111102', 'Apple / CBRE',            current_date - 14)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. Purchase orders (mix of states)
-- ----------------------------------------------------------------------------
insert into purchase_orders (id, company_id, project_id, po_number, vendor, total_amount, qty_ordered, qty_received, receiving_status, status, issued_date, expected_date, received_date, created_by)
values
  ('66666666-6666-6666-6666-000000000184', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'PO-2026-0184', 'Nucor Steel TX',  38400.00,  48,  48, 'fully_received', 'received', current_date - 14, current_date - 7,  current_date - 5,  '11111111-1111-1111-1111-111111111102'),
  ('66666666-6666-6666-6666-000000000183', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'PO-2026-0183', 'Atlas Tube',      52800.00, 120,  48, 'partial',        'partial',  current_date - 19, current_date - 9,  null,               '11111111-1111-1111-1111-111111111102'),
  ('66666666-6666-6666-6666-000000000182', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222202', 'PO-2026-0182', 'Service Ctr SW',   8200.00, 200, 200, 'fully_received', 'received', current_date - 21, current_date - 10, current_date - 9,  '11111111-1111-1111-1111-111111111102'),
  ('66666666-6666-6666-6666-000000000181', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'PO-2026-0181', 'Metals USA',       3100.00,  50,   0, 'pending',        'issued',   current_date - 24, current_date + 7,  null,               '11111111-1111-1111-1111-111111111102'),
  ('66666666-6666-6666-6666-000000000180', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222203', 'PO-2026-0180', 'Nucor Steel TX',  44100.00,  30,  24, 'partial',        'partial',  current_date - 27, current_date - 14, null,               '11111111-1111-1111-1111-111111111102')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 6. Additional drawings + supersede chain (DS-102 Rev B superseded by Rev C)
-- ----------------------------------------------------------------------------
insert into drawings (id, company_id, project_id, drawing_number, revision, title, type, status, current_revision, date_issued, approved_by)
values
  ('33333333-3333-3333-3333-333333333305', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'DS-102', 'B', 'HSS bracing — original (SUPERSEDED)', 'shop',       'superseded', false, current_date - 30, '11111111-1111-1111-1111-111111111102'),
  ('33333333-3333-3333-3333-333333333306', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'DM-001', 'B', 'Misc metals — handrail, stairs',       'connection', 'approved',   true,  current_date - 8,  '11111111-1111-1111-1111-111111111102'),
  ('33333333-3333-3333-3333-333333333307', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222203', 'AD-001', 'A', 'Austin DC frame — Phase 1 columns',    'shop',       'in_progress', true, current_date - 4,  '11111111-1111-1111-1111-111111111102')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. Assemblies — extra
-- ----------------------------------------------------------------------------
insert into assemblies (id, company_id, project_id, assembly_mark, description, total_weight, total_parts, completed_parts, status)
values
  ('55555555-5555-5555-5555-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'C-041',  'W8×31 beam assembly — Bay 3',         3200, 8,  5,  'in_progress'),
  ('55555555-5555-5555-5555-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'D-017',  'L4×4 clip angle assembly',             580, 12, 12, 'complete'),
  ('55555555-5555-5555-5555-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'MH-001', 'Stair stringer assembly — Stair 1',   1240, 14, 8,  'in_progress'),
  ('55555555-5555-5555-5555-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222203', 'F-011',  'HSS4×4 brace assembly — Phase 2',     880, 6,  2,  'in_progress')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 8. Larger parts catalogue — enough to give Dallas Skyline real volume.
-- We auto-generate ~60 parts via a series for the Dallas Tower so the
-- dashboard pie shows production curve. Each row has stable part_mark so
-- the unique index protects against re-running.
-- ----------------------------------------------------------------------------
do $$
declare
  v_company uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_project uuid := '22222222-2222-2222-2222-222222222201';
  v_draw_a uuid := '33333333-3333-3333-3333-333333333303'; -- DS-104 Rev D
  v_draw_b uuid := '33333333-3333-3333-3333-333333333302'; -- DS-102 Rev C
  v_worker uuid := '11111111-1111-1111-1111-111111111107';
  v_seq int;
  v_status text;
  v_profile text;
  v_grade text;
  v_phase text;
  v_assembly text;
  v_heat text;
  v_weight numeric;
  v_length numeric;
begin
  for v_seq in 1 .. 60 loop
    v_status := case
      when v_seq <= 24 then 'complete'
      when v_seq <= 36 then 'in_progress'
      when v_seq <= 48 then 'not_started'
      when v_seq <= 54 then 'shipped'
      else 'on_hold'
    end;
    v_profile := case (v_seq % 5)
      when 0 then 'W14x82'
      when 1 then 'HSS6x6x1/2'
      when 2 then 'W8x31'
      when 3 then 'W24x68'
      else 'L4x4x3/8'
    end;
    v_grade := case
      when v_profile like 'W%'   then 'A992'
      when v_profile like 'HSS%' then 'A500-C'
      else 'A36'
    end;
    v_phase := case when v_seq <= 30 then 'P1' else 'P2' end;
    v_assembly := case (v_seq % 4)
      when 0 then 'A-204'
      when 1 then 'B-108'
      when 2 then 'C-041'
      else 'D-017'
    end;
    v_heat := case (v_seq % 4)
      when 0 then 'HT-23845'
      when 1 then 'HT-23846'
      when 2 then 'HT-23900'
      else 'HT-23800'
    end;
    v_weight := case
      when v_profile like 'W14%' then 1672
      when v_profile like 'HSS%' then 892
      when v_profile like 'W8%'  then 882
      when v_profile like 'W24%' then 1632
      else 194
    end;
    v_length := case
      when v_profile like 'W%' then 20.33
      when v_profile like 'HSS%' then 14.0
      else 8.0
    end;

    insert into parts (
      company_id, project_id, part_mark, assembly_mark, profile, grade, length, weight, quantity, status, phase, heat_number,
      drawing_id, assigned_user_id
    ) values (
      v_company, v_project,
      'AUTO-' || lpad(v_seq::text, 4, '0') || '-' || v_profile,
      v_assembly, v_profile, v_grade, v_length, v_weight, 1, v_status::part_status, v_phase, v_heat,
      case when v_seq % 2 = 0 then v_draw_a else v_draw_b end,
      case when v_status in ('in_progress','not_started') then v_worker else null end
    )
    on conflict (company_id, project_id, part_mark) do nothing;
  end loop;
end$$;

-- Also seed a smaller set for the other 3 projects so they don't render empty.
do $$
declare
  v_company uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_projects uuid[] := array[
    '22222222-2222-2222-2222-222222222202'::uuid,
    '22222222-2222-2222-2222-222222222203'::uuid,
    '22222222-2222-2222-2222-222222222204'::uuid
  ];
  v_pid uuid;
  v_seq int;
  v_status part_status;
begin
  foreach v_pid in array v_projects loop
    for v_seq in 1 .. 12 loop
      v_status := case when v_seq <= 4 then 'complete'::part_status
                       when v_seq <= 9 then 'in_progress'::part_status
                       else 'not_started'::part_status end;
      insert into parts (company_id, project_id, part_mark, assembly_mark, profile, grade, length, weight, quantity, status, phase)
      values (
        v_company, v_pid,
        'PT-' || substr(v_pid::text, 1, 4) || '-' || lpad(v_seq::text, 3, '0'),
        'A-' || lpad((v_seq * 7 % 50)::text, 3, '0'),
        case (v_seq % 3) when 0 then 'W18x46' when 1 then 'C12x20.7' else 'PL1/2x12' end,
        case (v_seq % 3) when 0 then 'A992' when 1 then 'A36' else 'A36' end,
        18.0 + (v_seq % 5), 540 + (v_seq * 11), 1, v_status, 'P1'
      )
      on conflict (company_id, project_id, part_mark) do nothing;
    end loop;
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- 9. Job costs (Dallas Skyline)
-- ----------------------------------------------------------------------------
insert into job_costs (id, company_id, project_id, cost_code, description, budget_amount, actual_amount, committed)
values
  ('cccccccc-cccc-cccc-cccc-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', '01-MAT-STR',  'Structural Steel Material', 196000, 182400, 196000),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', '02-MAT-MM',   'Misc Metal Material',        28000,  24100,  28000),
  ('cccccccc-cccc-cccc-cccc-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', '10-LAB-SHOP', 'Shop Labor',                168000, 121200, 168000),
  ('cccccccc-cccc-cccc-cccc-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', '20-COAT',     'Paint / Coating',            42000,  38200,  42000),
  ('cccccccc-cccc-cccc-cccc-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', '30-FRT',      'Freight / Shipping',         24000,  19840,  24000),
  ('cccccccc-cccc-cccc-cccc-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', '40-OH',       'Overhead & Burden',          64000,  16100,  64000)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 10. Billing applications (G702/G703)
-- ----------------------------------------------------------------------------
insert into billing_applications (id, company_id, project_id, application_number, period_to, original_contract, change_orders_total, completed_to_date, materials_stored, retainage_percent, retainage_withheld, previous_billed, amount_due, pct_complete, status, submitted_at, certified_at, created_by)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 1, '2026-01-31', 612000, 0,    122400, 12000, 10, 12240, 0,      110160, 20, 'certified', now() - interval '90 days', now() - interval '80 days', '11111111-1111-1111-1111-111111111106'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 2, '2026-02-28', 612000, 8400, 269000, 14000, 10, 26900, 110160, 130940, 44, 'certified', now() - interval '60 days', now() - interval '50 days', '11111111-1111-1111-1111-111111111106'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 3, '2026-03-31', 612000, 8400, 441000, 18000, 10, 44100, 240900, 155400, 72, 'submitted', now() - interval '4 days',  null,                       '11111111-1111-1111-1111-111111111106')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 11. Weld inspections (one fail to auto-open NCR via trigger if present)
-- ----------------------------------------------------------------------------
do $$
declare
  v_company uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_project uuid := '22222222-2222-2222-2222-222222222201';
  v_inspector uuid := '11111111-1111-1111-1111-111111111105';
  v_part1 uuid; v_part2 uuid;
begin
  select id into v_part1 from parts where company_id = v_company and project_id = v_project and part_mark like 'AUTO-0001%' limit 1;
  select id into v_part2 from parts where company_id = v_company and project_id = v_project and part_mark like 'AUTO-0002%' limit 1;

  insert into weld_inspections (id, company_id, project_id, part_id, weld_number, joint_type, weld_process, filler_metal, inspection_method, cwi_reference, inspector_id, inspector_name, result, aws_d11_reference, notes, inspection_date)
  values
    ('eeeeeeee-eeee-eeee-eeee-000000000441', v_company, v_project, v_part1, 'WLD-0441', 'CJP Groove',  'FCAW', 'E71T-1',  'UT',  'CWI-2841', v_inspector, 'D. Nguyen', 'pending', 'AWS D1.1 §6.9', 'Weld complete — UT scheduled in 2 days', current_date - 2),
    ('eeeeeeee-eeee-eeee-eeee-000000000440', v_company, v_project, v_part1, 'WLD-0440', 'Fillet 5/16"','FCAW', 'E71T-1',  'VT',  'CWI-2841', v_inspector, 'D. Nguyen', 'pass',    'AWS D1.1 §6.9', 'Visual inspection — acceptable',           current_date - 2),
    ('eeeeeeee-eeee-eeee-eeee-000000000439', v_company, v_project, v_part2, 'WLD-0439', 'CJP Groove',  'GMAW', 'ER70S-6', 'MT',  'CWI-2841', v_inspector, 'D. Nguyen', 'pass',    'AWS D1.1 §6.10','MT performed — no linear indications',     current_date - 3),
    ('eeeeeeee-eeee-eeee-eeee-000000000438', v_company, v_project, v_part2, 'WLD-0438', 'PJP Groove',  'SMAW', 'E7018',   'VT',  'SCWI-4821',v_inspector, 'M. Kowalski', 'fail',  'AWS D1.1 §5.22','Undercut >1/32" — repair required',         current_date - 4)
  on conflict (id) do nothing;
end$$;

-- ----------------------------------------------------------------------------
-- 12. Paint inspections — pass + one fail (for NCR pipeline)
-- ----------------------------------------------------------------------------
do $$
declare
  v_company uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_project uuid := '22222222-2222-2222-2222-222222222201';
  v_inspector uuid := '11111111-1111-1111-1111-111111111105';
  v_part1 uuid; v_part2 uuid; v_part3 uuid;
begin
  select id into v_part1 from parts where company_id = v_company and project_id = v_project and part_mark like 'AUTO-0001%' limit 1;
  select id into v_part2 from parts where company_id = v_company and project_id = v_project and part_mark like 'AUTO-0002%' limit 1;
  select id into v_part3 from parts where company_id = v_company and project_id = v_project and part_mark like 'AUTO-0003%' limit 1;

  insert into paint_inspections (id, company_id, project_id, part_id, insp_number, surface_prep, primer_dft, topcoat_dft, required_min, inspector_id, inspector_name, result, ambient_temp, humidity_pct, inspection_date, notes)
  values
    ('dddddddd-dddd-dddd-dddd-000000000441', v_company, v_project, v_part1, 'PI-0441', 'SSPC-SP10', 3.2, 2.8, 5.5, v_inspector, 'J. Reyes', 'pass', 72.0, 48.0, current_date - 2, 'Within spec'),
    ('dddddddd-dddd-dddd-dddd-000000000440', v_company, v_project, v_part2, 'PI-0440', 'SSPC-SP10', 2.7, 2.4, 5.5, v_inspector, 'J. Reyes', 'fail', 68.0, 62.0, current_date - 2, 'Total DFT below required min — rework'),
    ('dddddddd-dddd-dddd-dddd-000000000439', v_company, v_project, v_part3, 'PI-0439', 'SSPC-SP10', 3.4, 2.9, 5.5, v_inspector, 'J. Reyes', 'pass', 70.0, 50.0, current_date - 3, 'Within spec')
  on conflict (id) do nothing;
end$$;

-- ----------------------------------------------------------------------------
-- 13. NCR (manually seed two so the page renders even without trigger fan-out)
-- ----------------------------------------------------------------------------
do $$
declare
  v_company uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_project uuid := '22222222-2222-2222-2222-222222222201';
  v_part2 uuid;
begin
  select id into v_part2 from parts where company_id = v_company and project_id = v_project and part_mark like 'AUTO-0002%' limit 1;

  insert into ncr_reports (id, company_id, project_id, part_id, ncr_number, description, root_cause, status, blocks_shipping, created_by)
  values
    ('ffffffff-ffff-ffff-ffff-000000000001', v_company, v_project, v_part2, 'NCR-0001', 'Paint DFT below required minimum (5.1 vs 5.5 mil)', 'Insufficient topcoat passes',         'open',        true,  '11111111-1111-1111-1111-111111111105'),
    ('ffffffff-ffff-ffff-ffff-000000000002', v_company, v_project, null,    'NCR-0002', 'Weld undercut exceeds AWS D1.1 §5.22 tolerance',     'Inadequate amperage settings on SMAW', 'in_progress', true,  '11111111-1111-1111-1111-111111111105')
  on conflict (id) do nothing;
end$$;

-- ----------------------------------------------------------------------------
-- 14. Erection sequence
-- ----------------------------------------------------------------------------
insert into erection_sequence (id, company_id, project_id, sequence_number, description, load_number, priority, phase, status)
values
  ('6e000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 1, 'Column bases — all column lines, Level 1',        'L-0041', 1, 'Phase 1', 'complete'),
  ('6e000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 2, 'Spandrel beams — Grid A, Levels 1-2',             'L-0041', 2, 'Phase 1', 'complete'),
  ('6e000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 3, 'Interior framing — Bays 1-4, Level 2',            'L-0040', 3, 'Phase 1', 'in_progress'),
  ('6e000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 4, 'HSS diagonal bracing — All bays, Level 2-3',      null,     4, 'Phase 1', 'not_started'),
  ('6e000000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 5, 'Column continuation — Level 6-12',                null,     5, 'Phase 2', 'in_progress'),
  ('6e000000-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 6, 'Floor beams — Level 6-12 all bays',               null,     6, 'Phase 2', 'not_started'),
  ('6e000000-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 7, 'Stair stringers and landing framing',             null,     7, 'Phase 2', 'in_progress'),
  ('6e000000-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 8, 'Penthouse framing and mechanical screen',         null,     8, 'Phase 2', 'not_started')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 15. Shipping tickets
-- ----------------------------------------------------------------------------
insert into shipping_tickets (id, company_id, project_id, ticket_number, load_number, truck_number, carrier, driver_name, ship_date, destination, total_pieces, total_weight, status, created_by)
values
  ('5b000000-0000-0000-0000-000000000041', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'TKT-0041', 'L-0041', 'JL-2841', 'J&L Trucking',         'Mike T.',   current_date - 2,  'Dallas, TX',      14, 18420, 'delivered',  '11111111-1111-1111-1111-111111111104'),
  ('5b000000-0000-0000-0000-000000000040', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201', 'TKT-0040', 'L-0040', 'JL-2841', 'J&L Trucking',         'Mike T.',   current_date,      'Dallas, TX',      22, 28640, 'in_transit', '11111111-1111-1111-1111-111111111104'),
  ('5b000000-0000-0000-0000-000000000039', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222202', 'TKT-0039', 'L-0039', 'SW-441',  'Southwest Freight',    'Carlos R.', current_date + 1,  'Houston, TX',     18, 12100, 'pending',    '11111111-1111-1111-1111-111111111104'),
  ('5b000000-0000-0000-0000-000000000038', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222203', 'TKT-0038', 'L-0038', null,      null,                   null,        current_date + 4,  'Austin, TX',      10,  6800, 'pending',    '11111111-1111-1111-1111-111111111104')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 16. Additional inventory items (mix of low/out/ok)
-- inventory.status is a generated column — auto-computed from quantity/reorder_point.
-- ----------------------------------------------------------------------------
insert into inventory (company_id, profile, grade, quantity, location, reorder_point, max_stock, unit_cost)
select * from (values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'W24x68',  'A992',   6,  'Bay 1', 10, 40, 1730.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'W8x31',   'A992',   28, 'Bay 1', 12, 50, 410.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'HSS4x4x1/4', 'A500-C', 0,  'Bay 2', 10, 40, 320.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'PL1/2x12','A36',    0,  'Bay 4', 10, 50, 88.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'W6x15',   'A992',   35, 'Bay 1', 10, 40, 320.00),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'W18x46',  'A992',   22, 'Bay 1', 12, 60, 1100.00)
) as v(company_id, profile, grade, quantity, location, reorder_point, max_stock, unit_cost)
where not exists (
  select 1 from inventory i where i.company_id = v.company_id and i.profile = v.profile and i.grade = v.grade
);

-- ----------------------------------------------------------------------------
-- 17. Heat numbers — already in initial seed; add extras for variety
-- ----------------------------------------------------------------------------
insert into heat_numbers (company_id, heat_number, material_grade, mill_name, supplier, mtr_status, parts_count, receipt_number)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HN-8821A', 'A992',   'Nucor Steel TX',  'Nucor Steel TX',  'verified', 12, 'REC-0041'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HN-7734B', 'A500-C', 'Steel Dynamics',  'Atlas Tube',      'pending',  6,  'REC-0040'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HN-6621A', 'A36',    'Gerdau',          'Service Ctr SW',  'verified', 8,  'REC-0039'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HN-5541B', 'A36',    'Gerdau',          'Metals USA',      'verified', 5,  'REC-0037'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HN-9012C', 'A992',   'Nucor Steel TX',  'Nucor Steel TX',  'verified', 4,  'REC-0038')
on conflict (company_id, heat_number) do nothing;

-- ----------------------------------------------------------------------------
-- 18. Additional certifications (matching mock-data: 8 rows)
-- ----------------------------------------------------------------------------
insert into certifications (company_id, cert_type, holder_name, cert_number, issue_date, expiry_date, alert_days)
select * from (values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'AWS CWI',             'D. Nguyen',           'CWI-2841',    date '2024-01-05', date '2027-01-05',                              60),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'AWS CWI',             'M. Kowalski',         'SCWI-4821',   date '2022-03-01', date '2025-03-01',                              60),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'AWS Welder',          'R. Torres',           'WC-8841',     date '2025-06-01', date '2026-06-01',                              60),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'AWS Welder',          'A. Garcia',           'WC-7732',     date '2025-04-15', current_date + interval '23 days',              30),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'SSPC Painting Insp.', 'J. Reyes',            'PCI-1141',    date '2024-09-01', date '2026-09-01',                              60),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'DOT Carrier',         'J&L Trucking',        'TX-DOT-2841', date '2026-01-01', date '2026-12-31',                              30),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Crane / Rigging',     'Atlas Crane Co',      'CRANE-4411',  date '2026-02-01', current_date + interval '9 days',               30)
) as v(company_id, cert_type, holder_name, cert_number, issue_date, expiry_date, alert_days)
where not exists (
  select 1 from certifications c where c.company_id = v.company_id and c.cert_number = v.cert_number
);

-- ----------------------------------------------------------------------------
-- 19. Additional activity feed entries (so the live stream looks alive)
-- ----------------------------------------------------------------------------
insert into activity_feed (company_id, user_id, user_name, action, entity_type, entity_id, entity_label, metadata, created_at)
select * from (values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111107'::uuid, 'Roberto Torres', 'uploaded photo',          'parts',           null::uuid, 'HSS6×6-0312', '{"category":"inspection"}'::jsonb, now() - interval '1 minute'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111104'::uuid, 'Marcus Johnson', 'opened AISC hold',        'aisc_checklist',  null::uuid, 'W14x82 column QC review', '{}'::jsonb,        now() - interval '3 minutes'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111101'::uuid, 'Vinay Patel',    'generated',               'shipping_tickets',null::uuid, 'Load L-0041', '{}'::jsonb,                        now() - interval '8 minutes'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111105'::uuid, 'Linda Chen',     'failed paint inspection', 'paint_inspections',null::uuid,'PI-0440', '{"result":"fail"}'::jsonb,             now() - interval '20 minutes'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111102'::uuid, 'Sarah Mitchell', 'submitted change order',  'change_orders',   null::uuid, 'CO-041', '{"amount":14800}'::jsonb,               now() - interval '45 minutes'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111103'::uuid, 'David Park',     'submitted estimate',      'estimates',       null::uuid, 'EST-2026-041','{"total":612000}'::jsonb,         now() - interval '2 hours')
) as v(company_id, user_id, user_name, action, entity_type, entity_id, entity_label, metadata, created_at)
where not exists (
  select 1 from activity_feed af where af.company_id = v.company_id and af.user_id = v.user_id and af.action = v.action and af.entity_label = v.entity_label
);

-- ----------------------------------------------------------------------------
-- 20. Extra notifications (for every user role)
-- notification_type enum: cert_expiry, inventory_low, qc_failure, ncr_created, co_approved, info
-- ----------------------------------------------------------------------------
insert into notifications (company_id, user_id, type, title, message, entity_type, entity_link)
select * from (values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111101'::uuid, 'ncr_created'::notification_type,   'NCR-0001 opened',           'Paint DFT below required min on AUTO-0002', 'ncr_reports',     '/dashboard/ncr'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111105'::uuid, 'qc_failure'::notification_type,    'Weld inspection failed',    'WLD-0438 — repair per AWS D1.1 §5.22',      'weld_inspections','/dashboard/weld-log'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111102'::uuid, 'info'::notification_type,          'RFI-0081 awaiting EOR',     'Confirm W14×82 base plate hole pattern',    'rfis',            '/dashboard/rfis'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111101'::uuid, 'info'::notification_type,          'PO-2026-0184 fully received','Nucor Steel TX — 48 pieces W14×82',        'purchase_orders', '/dashboard/receiving'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111101'::uuid, 'co_approved'::notification_type,   'CO-040 approved',           'Base plate gusset addition approved',       'change_orders',   '/dashboard/change-orders'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111104'::uuid, 'inventory_low'::notification_type, 'HSS4×4×¼ out of stock',     'Reorder before next shift',                 'inventory',       '/dashboard/inventory')
) as v(company_id, user_id, type, title, message, entity_type, entity_link)
where not exists (
  select 1 from notifications n where n.company_id = v.company_id and n.user_id = v.user_id and n.title = v.title
);

-- ----------------------------------------------------------------------------
-- 21. Sample cut plan (so /dashboard/cut-list shows persisted runs)
-- ----------------------------------------------------------------------------
insert into cut_plans (id, company_id, project_id, profile, stock_length, kerf, min_remnant, cuts, waste_percentage, total_bars, total_yield_pct, parameters_json, created_by)
values
  ('7c000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222201',
   'W14x82', 480, 0.125, 6,
   '[
     {"bar_index":1,"cuts":[{"length":244,"mark":"AUTO-0001"},{"length":234,"mark":"AUTO-0007"}],"used_length":478.125,"remnant":1.875,"waste":1.875},
     {"bar_index":2,"cuts":[{"length":244,"mark":"AUTO-0013"},{"length":234,"mark":"AUTO-0019"}],"used_length":478.125,"remnant":1.875,"waste":1.875},
     {"bar_index":3,"cuts":[{"length":244,"mark":"AUTO-0025"},{"length":120,"mark":"AUTO-0031"}],"used_length":364.125,"remnant":115.875,"waste":0}
   ]'::jsonb,
   3.27, 3, 96.73,
   '{"input_cuts":[{"length":244,"qty":3,"mark":"col"},{"length":234,"qty":2,"mark":"col"},{"length":120,"qty":1,"mark":"infill"}]}'::jsonb,
   '11111111-1111-1111-1111-111111111104')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 22. OSHA checklist already seeded in initial seed; nothing extra needed.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 23. Sequence counters: bump so generated IDs continue from realistic values
-- ----------------------------------------------------------------------------
insert into sequence_counters (company_id, table_name, prefix, current_value, width)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rfis',             'RFI',  81,  4),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'change_orders',    'CO',   41,  3),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ncr_reports',      'NCR',   2,  4),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'projects',         'PRJ-2026', 4, 4),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'estimates',        'EST-2026', 41, 3),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purchase_orders',  'PO-2026', 184, 4),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'shipping_tickets', 'TKT',   41,  4),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'billing_applications', 'BILL', 3, 3)
on conflict (company_id, table_name, prefix) do update
  set current_value = greatest(sequence_counters.current_value, excluded.current_value);
