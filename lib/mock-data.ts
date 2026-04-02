// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mock Data matching FabSimple v4 HTML prototype
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PROJECTS = [
  {
    id: "p1",
    name: "Dallas Skyline Tower",
    client: "Turner Construction",
    deadline: "2026-06-30",
    contract_type: "Lump Sum",
    total_parts: 1847,
    completed: 1330,
    progress: 72,
    contract_value: 612000,
    status: "Active",
    color: "#4F46E5",
    description: "14-story commercial tower — structural steel and misc metals",
  },
  {
    id: "p2",
    name: "Houston Refinery Exp.",
    client: "Bechtel Corp",
    deadline: "2026-09-15",
    contract_type: "GMP",
    total_parts: 612,
    completed: 269,
    progress: 44,
    contract_value: 378000,
    status: "Active",
    color: "#2563EB",
    description: "Process equipment framing and structural expansion",
  },
  {
    id: "p3",
    name: "Austin Data Center",
    client: "Apple Inc",
    deadline: "2026-12-01",
    contract_type: "Lump Sum",
    total_parts: 382,
    completed: 107,
    progress: 28,
    contract_value: 824000,
    status: "Active",
    color: "#7C3AED",
    description: "Data center structural frame with galvanized exterior HSS",
  },
  {
    id: "p4",
    name: "San Antonio Bridge",
    client: "PCL Construction",
    deadline: "2027-03-01",
    contract_type: "Unit Price",
    total_parts: 200,
    completed: 22,
    progress: 11,
    contract_value: 290000,
    status: "Planning",
    color: "#16A34A",
    description: "Pedestrian bridge — structural steel and misc metals",
  },
];

export const PARTS = [
  { id: "pt1", part_id: "W14×82-1044", assembly_id: "A-204", drawing_no: "DS-104 Rev D", profile: "W14×82", material: "ASTM A992", length: "20'-4\"", weight: 1672, phase: "Phase 2", heat_number: "HN-8821A", project: "Dallas Skyline Tower", status: "Welding", co_ref: "CO-040" },
  { id: "pt2", part_id: "HSS6×6-0312", assembly_id: "B-108", drawing_no: "DS-102 Rev C", profile: "HSS6×6×½", material: "ASTM A500 Gr.C", length: "14'-0\"", weight: 892, phase: "Phase 1", heat_number: "HN-7734B", project: "Dallas Skyline Tower", status: "Welding", co_ref: "" },
  { id: "pt3", part_id: "W8×31-0567", assembly_id: "C-041", drawing_no: "DS-103 Rev C", profile: "W8×31", material: "ASTM A992", length: "28'-6\"", weight: 882, phase: "Phase 1", heat_number: "HN-9012C", project: "Dallas Skyline Tower", status: "Painting", co_ref: "" },
  { id: "pt4", part_id: "W24×68-0801", assembly_id: "I-001", drawing_no: "DS-104 Rev D", profile: "W24×68", material: "ASTM A992", length: "24'-0\"", weight: 1632, phase: "Phase 1", heat_number: "HN-8821A", project: "Dallas Skyline Tower", status: "Shipped", co_ref: "" },
  { id: "pt5", part_id: "L4×4-0089", assembly_id: "D-017", drawing_no: "DS-102 Rev C", profile: "L4×4×⅜", material: "ASTM A36", length: "8'-0\"", weight: 194, phase: "Phase 1", heat_number: "HN-6621A", project: "Houston Refinery", status: "Cutting", co_ref: "" },
  { id: "pt6", part_id: "W14×82-1001", assembly_id: "A-100", drawing_no: "DS-104 Rev D", profile: "W14×82", material: "ASTM A992", length: "18'-0\"", weight: 1476, phase: "Phase 1", heat_number: "HN-8821A", project: "Dallas Skyline Tower", status: "Completed", co_ref: "" },
  { id: "pt7", part_id: "W14×82-1045", assembly_id: "A-205", drawing_no: "DS-104 Rev D", profile: "W14×82", material: "ASTM A992", length: "20'-4\"", weight: 1672, phase: "Phase 2", heat_number: "HN-8821A", project: "Dallas Skyline Tower", status: "Welding", co_ref: "CO-040" },
  { id: "pt8", part_id: "HSS4×4-0501", assembly_id: "F-011", drawing_no: "DS-102 Rev C", profile: "HSS4×4×¼", material: "ASTM A500 Gr.C", length: "12'-0\"", weight: 442, phase: "Phase 2", heat_number: "HN-7734B", project: "Austin Data Center", status: "Painting", co_ref: "" },
  { id: "pt9", part_id: "W12×50-0201", assembly_id: "C-022", drawing_no: "DS-103 Rev C", profile: "W12×50", material: "ASTM A992", length: "30'-0\"", weight: 1500, phase: "Phase 1", heat_number: "HN-9012C", project: "Dallas Skyline Tower", status: "Not Started", co_ref: "" },
  { id: "pt10", part_id: "PL½×12-0044", assembly_id: "A-100", drawing_no: "DS-104 Rev D", profile: "PL½×12", material: "ASTM A36", length: "1'-6\"", weight: 30, phase: "Phase 1", heat_number: "HN-5541B", project: "Dallas Skyline Tower", status: "Completed", co_ref: "" },
  { id: "pt11", part_id: "W14×82-1046", assembly_id: "A-206", drawing_no: "DS-104 Rev D", profile: "W14×82", material: "ASTM A992", length: "20'-4\"", weight: 1672, phase: "Phase 2", heat_number: "HN-8821A", project: "Dallas Skyline Tower", status: "Cutting", co_ref: "" },
  { id: "pt12", part_id: "HSS6×6-0313", assembly_id: "B-109", drawing_no: "DS-102 Rev C", profile: "HSS6×6×½", material: "ASTM A500 Gr.C", length: "16'-0\"", weight: 1020, phase: "Phase 1", heat_number: "HN-7734B", project: "Dallas Skyline Tower", status: "Not Started", co_ref: "" },
];

export const ESTIMATES = [
  { id: "e1", est_number: "EST-2026-041", project_name: "Dallas Office Bldg", client: "Turner Const.", structural_tons: 142, misc_metal_lbs: 18400, labor_hours: 2840, material_cost: 284000, total_bid: 612000, margin_pct: 22.4, status: "Submitted", bid_due_date: "2026-04-15" },
  { id: "e2", est_number: "EST-2026-040", project_name: "Houston Warehouse", client: "Procon LLC", structural_tons: 88, misc_metal_lbs: 9200, labor_hours: 1760, material_cost: 176000, total_bid: 378000, margin_pct: 19.8, status: "Won", bid_due_date: "2026-03-30" },
  { id: "e3", est_number: "EST-2026-039", project_name: "Austin Parking Garage", client: "CBRE", structural_tons: 201, misc_metal_lbs: 4100, labor_hours: 4020, material_cost: 402000, total_bid: 824000, margin_pct: 21.0, status: "Pending", bid_due_date: "2026-04-20" },
];

export const CHANGE_ORDERS = [
  { id: "c1", co_number: "CO-041", project: "Dallas Skyline", description: "Add (8) W6×15 beams — Level 12 grid ext.", drawing_rev: "Rev D", requested_by: "Turner / M.Johnson", date_submitted: "2026-03-18", total_value: 14800, status: "Pending Approval" },
  { id: "c2", co_number: "CO-040", project: "Dallas Skyline", description: "Revise (12) base plate details — add gusset", drawing_rev: "Rev C", requested_by: "EOR — Smith Eng.", date_submitted: "2026-03-12", total_value: 8400, status: "Approved" },
  { id: "c3", co_number: "CO-039", project: "Houston Refinery", description: "Additional (24) misc angle clips", drawing_rev: "Rev B", requested_by: "Bechtel / S.Chen", date_submitted: "2026-03-05", total_value: 3200, status: "Approved — Billed" },
  { id: "c4", co_number: "CO-038", project: "Austin Data Ctr", description: "Galvanize all exterior HSS — spec change", drawing_rev: "Rev A", requested_by: "Apple / D.Park", date_submitted: "2026-02-28", total_value: 21600, status: "Pending Approval" },
];

export const RFIS = [
  { id: "r1", rfi_number: "RFI-0081", project: "Dallas Skyline", question: "Confirm W14×82 base plate hole pattern — conflicts with DS-104 Rev D and structural calc", submitted_to: "Smith Engineering (EOR)", date_submitted: "2026-03-20", date_answered: null, status: "Open" },
  { id: "r2", rfi_number: "RFI-0080", project: "Houston Refinery", question: "ASTM A36 vs A572 Gr.50 for gusset plates — spec sheet ambiguous", submitted_to: "Bechtel Design", date_submitted: "2026-03-14", date_answered: "2026-03-18", status: "Answered" },
  { id: "r3", rfi_number: "RFI-0079", project: "Austin Data Ctr", question: "Galvanizing spec for exterior HSS — ASTM A123 or A153?", submitted_to: "Apple / CBRE", date_submitted: "2026-02-25", date_answered: "2026-03-02", status: "Answered" },
];

export const DRAWINGS = [
  { id: "d1", drawing_no: "DS-104", revision: "Rev D", project: "Dallas Skyline", description: "Columns Level 10–12 — W14 series", date_issued: "2026-03-20", approved_by: "Turner / EOR", status: "Current", parts_linked: 48 },
  { id: "d2", drawing_no: "DS-103", revision: "Rev C", project: "Dallas Skyline", description: "Beam framing Level 10", date_issued: "2026-03-18", approved_by: "Turner / EOR", status: "Current", parts_linked: 112 },
  { id: "d3", drawing_no: "DS-102", revision: "Rev B", project: "Dallas Skyline", description: "HSS bracing — original (SUPERSEDED)", date_issued: "2026-03-10", approved_by: "Turner / EOR", status: "Superseded", parts_linked: 67 },
  { id: "d4", drawing_no: "DS-102", revision: "Rev C", project: "Dallas Skyline", description: "HSS bracing — revised connections", date_issued: "2026-03-20", approved_by: "Turner / EOR", status: "Current", parts_linked: 67 },
  { id: "d5", drawing_no: "DS-101", revision: "Rev A", project: "Houston Refinery", description: "Process equipment framing", date_issued: "2026-03-05", approved_by: "Bechtel", status: "Current", parts_linked: 201 },
  { id: "d6", drawing_no: "DM-001", revision: "Rev B", project: "Dallas Skyline", description: "Misc metals — handrail, stairs", date_issued: "2026-03-15", approved_by: "Turner", status: "Current", parts_linked: 184 },
];

export const PURCHASE_ORDERS = [
  { id: "po1", po_number: "PO-2026-0184", order_date: "2026-03-15", supplier: "Nucor Steel TX", material: "W14×82, A992", qty_ordered: 48, qty_received: 48, receiving_status: "Fully Received", expected_date: "2026-03-22", total_amount: 38400, status: "Closed" },
  { id: "po2", po_number: "PO-2026-0183", order_date: "2026-03-10", supplier: "Atlas Tube", material: "HSS6×6×½, A500", qty_ordered: 120, qty_received: 48, receiving_status: "Partial", expected_date: "2026-03-20", total_amount: 52800, status: "Open" },
  { id: "po3", po_number: "PO-2026-0182", order_date: "2026-03-08", supplier: "Service Ctr SW", material: "L4×4×⅜, A36", qty_ordered: 200, qty_received: 200, receiving_status: "Fully Received", expected_date: "2026-03-19", total_amount: 8200, status: "Closed" },
  { id: "po4", po_number: "PO-2026-0181", order_date: "2026-03-05", supplier: "Metals USA", material: "PL½×12, A36", qty_ordered: 50, qty_received: 0, receiving_status: "Not Received", expected_date: "2026-04-01", total_amount: 3100, status: "Open" },
  { id: "po5", po_number: "PO-2026-0180", order_date: "2026-02-28", supplier: "Nucor Steel TX", material: "W24×68, A992", qty_ordered: 30, qty_received: 24, receiving_status: "Partial", expected_date: "2026-03-15", total_amount: 44100, status: "Open" },
];

export const RECEIPTS = [
  { id: "rec1", receipt_number: "REC-0041", po_number: "PO-0184", delivery_date: "2026-03-22", supplier: "Nucor Steel TX", material: "W14×82", bundle_tag: "BN-4421", heat_number: "HN-8821A", qty_received: 48, qty_ordered: 48, mtr_status: "On File", damage_notes: "None", released: true },
  { id: "rec2", receipt_number: "REC-0040", po_number: "PO-0183", delivery_date: "2026-03-21", supplier: "Atlas Tube", material: "HSS6×6×½", bundle_tag: "BN-4420", heat_number: "HN-7734B", qty_received: 48, qty_ordered: 120, mtr_status: "Awaiting", damage_notes: "None", released: false },
  { id: "rec3", receipt_number: "REC-0039", po_number: "PO-0182", delivery_date: "2026-03-19", supplier: "Service Ctr SW", material: "L4×4×⅜", bundle_tag: "BN-4419", heat_number: "HN-6621A", qty_received: 200, qty_ordered: 200, mtr_status: "On File", damage_notes: "Minor dent — 3 pcs", released: true },
];

export const INVENTORY = [
  { id: "inv1", material: "W14×82", astm_spec: "ASTM A992", qty_on_hand: 42, max_stock: 60, reorder_point: 15, status: "ok" },
  { id: "inv2", material: "W24×68", astm_spec: "ASTM A992", qty_on_hand: 6, max_stock: 40, reorder_point: 10, status: "low" },
  { id: "inv3", material: "W8×31", astm_spec: "ASTM A992", qty_on_hand: 28, max_stock: 50, reorder_point: 12, status: "ok" },
  { id: "inv4", material: "W12×50", astm_spec: "ASTM A992", qty_on_hand: 8, max_stock: 60, reorder_point: 15, status: "low" },
  { id: "inv5", material: "HSS6×6×½", astm_spec: "ASTM A500 Gr.C", qty_on_hand: 48, max_stock: 120, reorder_point: 20, status: "low" },
  { id: "inv6", material: "HSS4×4×¼", astm_spec: "ASTM A500 Gr.C", qty_on_hand: 0, max_stock: 40, reorder_point: 10, status: "out" },
  { id: "inv7", material: "L4×4×⅜", astm_spec: "ASTM A36", qty_on_hand: 18, max_stock: 200, reorder_point: 30, status: "low" },
  { id: "inv8", material: "PL½×12", astm_spec: "ASTM A36", qty_on_hand: 0, max_stock: 50, reorder_point: 10, status: "out" },
  { id: "inv9", material: "C12×20.7", astm_spec: "ASTM A36", qty_on_hand: 22, max_stock: 30, reorder_point: 8, status: "ok" },
  { id: "inv10", material: "W6×15", astm_spec: "ASTM A992", qty_on_hand: 35, max_stock: 40, reorder_point: 10, status: "ok" },
];

export const ASSEMBLIES = [
  { id: "as1", assembly_id: "A-204", drawing_no: "DS-104", description: "W14×82 column assembly — Level 11", total_parts: 4, parts_complete: 3, parts_in_prog: 1, parts_not_start: 0, progress: 75, status: "In Progress" },
  { id: "as2", assembly_id: "A-205", drawing_no: "DS-104", description: "W14×82 column assembly — Level 12", total_parts: 4, parts_complete: 4, parts_in_prog: 0, parts_not_start: 0, progress: 100, status: "Complete" },
  { id: "as3", assembly_id: "B-108", drawing_no: "DS-102", description: "HSS6×6 diagonal brace assembly", total_parts: 6, parts_complete: 2, parts_in_prog: 2, parts_not_start: 2, progress: 33, status: "In Progress" },
  { id: "as4", assembly_id: "C-041", drawing_no: "DS-103", description: "W8×31 beam assembly — Bay 3", total_parts: 8, parts_complete: 5, parts_in_prog: 2, parts_not_start: 1, progress: 63, status: "In Progress" },
  { id: "as5", assembly_id: "D-017", drawing_no: "DS-104", description: "L4×4 clip angle assembly", total_parts: 12, parts_complete: 12, parts_in_prog: 0, parts_not_start: 0, progress: 100, status: "Complete" },
  { id: "as6", assembly_id: "MH-001", drawing_no: "DM-001", description: "Stair stringer assembly — Stair 1", total_parts: 14, parts_complete: 8, parts_in_prog: 4, parts_not_start: 2, progress: 57, status: "In Progress" },
];

export const DAILY_LOGS = [
  { id: "dl1", log_date: "2026-03-23", station: "Beam Line / CNC", operators: "R. Torres, M. Smith", parts_completed: 24, operation_type: "Cutting", hours_worked: 16, budget_parts: 28, notes: "New saw blade installed — 30 min downtime" },
  { id: "dl2", log_date: "2026-03-23", station: "Welding Station 1", operators: "D. Nguyen", parts_completed: 12, operation_type: "Welding", hours_worked: 8, budget_parts: 16, notes: "AWS hold on A-204 — 45 min delay" },
  { id: "dl3", log_date: "2026-03-23", station: "Welding Station 2", operators: "A. Garcia", parts_completed: 6, operation_type: "Welding", hours_worked: 8, budget_parts: 6, notes: "None" },
  { id: "dl4", log_date: "2026-03-23", station: "Paint Booth", operators: "T. Williams", parts_completed: 31, operation_type: "Painting", hours_worked: 10, budget_parts: 30, notes: "SSPC SP-6 blast ran 2 hrs AM" },
  { id: "dl5", log_date: "2026-03-23", station: "Touch-up / Shipping Prep", operators: "2 workers", parts_completed: 18, operation_type: "Finishing", hours_worked: 16, budget_parts: 18, notes: "Load L-0041 prep" },
];

export const PAINT_INSPECTIONS = [
  { id: "pi1", insp_number: "PI-0441", part_id_text: "W14×82-1044", assembly_id: "A-204", insp_date: "2026-03-22", inspector: "J. Reyes", surface_prep: "SP-6 ✓", primer_dft: 3.2, topcoat_dft: 2.8, total_dft: 6.0, total_req: 5.5, result: "Pass" },
  { id: "pi2", insp_number: "PI-0440", part_id_text: "HSS6×6-0312", assembly_id: "B-108", insp_date: "2026-03-22", inspector: "J. Reyes", surface_prep: "SP-6 ✓", primer_dft: 2.7, topcoat_dft: 2.4, total_dft: 5.1, total_req: 5.5, result: "Fail — Rework Required" },
  { id: "pi3", insp_number: "PI-0439", part_id_text: "W8×31-0567", assembly_id: "C-041", insp_date: "2026-03-21", inspector: "J. Reyes", surface_prep: "SP-6 ✓", primer_dft: 3.4, topcoat_dft: 2.9, total_dft: 6.3, total_req: 5.5, result: "Pass" },
  { id: "pi4", insp_number: "PI-0438", part_id_text: "W14×82-1045", assembly_id: "A-205", insp_date: "2026-03-21", inspector: "J. Reyes", surface_prep: "SP-6 ✓", primer_dft: 3.1, topcoat_dft: 2.7, total_dft: 5.8, total_req: 5.5, result: "Pass" },
  { id: "pi5", insp_number: "PI-0437", part_id_text: "HSS4×4-0501", assembly_id: "F-011", insp_date: "2026-03-20", inspector: "J. Reyes", surface_prep: "SP-6 ✓", primer_dft: 3.0, topcoat_dft: 2.6, total_dft: 5.6, total_req: 5.5, result: "Pass" },
];

export const WELD_INSPECTIONS = [
  { id: "wi1", weld_id: "WLD-0441", part_id_text: "W14×82-1044", insp_date: "2026-03-22", joint_type: "CJP Groove", weld_process: "FCAW", filler_metal: "E71T-1", insp_method: "UT", inspector: "D. Nguyen / CWI-2841", result: "Pending", notes: "Weld complete — UT scheduled Mar 24" },
  { id: "wi2", weld_id: "WLD-0440", part_id_text: "W14×82-1044", insp_date: "2026-03-22", joint_type: "Fillet 5/16\"", weld_process: "FCAW", filler_metal: "E71T-1", insp_method: "VT", inspector: "D. Nguyen / CWI-2841", result: "Pass", notes: "Visual inspection — acceptable per AWS D1.1 §6.9" },
  { id: "wi3", weld_id: "WLD-0439", part_id_text: "HSS6×6-0312", insp_date: "2026-03-21", joint_type: "CJP Groove", weld_process: "GMAW", filler_metal: "ER70S-6", insp_method: "MT", inspector: "D. Nguyen / CWI-2841", result: "Pass", notes: "MT performed — no linear indications" },
  { id: "wi4", weld_id: "WLD-0438", part_id_text: "W8×31-0567", insp_date: "2026-03-20", joint_type: "PJP Groove", weld_process: "SMAW", filler_metal: "E7018", insp_method: "VT", inspector: "M. Kowalski / SCWI", result: "Fail — Repair Required", notes: "Undercut >1/32\" — repair per AWS D1.1 §5.22" },
  { id: "wi5", weld_id: "WLD-0437", part_id_text: "W8×31-0567", insp_date: "2026-03-20", joint_type: "Fillet 3/8\"", weld_process: "FCAW", filler_metal: "E71T-1", insp_method: "VT", inspector: "D. Nguyen / CWI-2841", result: "Pass", notes: "—" },
];

export const HEAT_NUMBERS = [
  { id: "hn1", heat_number: "HN-8821A", astm_spec: "ASTM A992", profile: "W14×82 / W24×68", supplier: "Nucor Steel TX", mtr_status: "On File", parts_count: 6, receipt_number: "REC-0041", status: "Released" },
  { id: "hn2", heat_number: "HN-7734B", astm_spec: "ASTM A500 Gr.C", profile: "HSS6×6×½ / HSS4×4×¼", supplier: "Atlas Tube", mtr_status: "Awaiting", parts_count: 4, receipt_number: "REC-0040", status: "Quarantine" },
  { id: "hn3", heat_number: "HN-6621A", astm_spec: "ASTM A36", profile: "L4×4×⅜", supplier: "Service Ctr SW", mtr_status: "On File", parts_count: 2, receipt_number: "REC-0039", status: "Released" },
  { id: "hn4", heat_number: "HN-5541B", astm_spec: "ASTM A36", profile: "C12×20.7 / PL½×12", supplier: "Metals USA", mtr_status: "On File", parts_count: 3, receipt_number: "REC-0037", status: "Released" },
  { id: "hn5", heat_number: "HN-9012C", astm_spec: "ASTM A992", profile: "W8×31", supplier: "Nucor Steel TX", mtr_status: "On File", parts_count: 2, receipt_number: "REC-0038", status: "Released" },
];

export const CERTIFICATIONS = [
  { id: "cert1", person_company: "D. Nguyen", role_title: "CWI", cert_type: "AWS CWI", cert_number: "CWI-2841", issue_date: "2024-01-05", expiry_date: "2027-01-05", alert_days: 60, status: "Valid", days_until: 653 },
  { id: "cert2", person_company: "M. Kowalski", role_title: "Sr. CWI", cert_type: "AWS CWI", cert_number: "SCWI-4821", issue_date: "2022-03-01", expiry_date: "2025-03-01", alert_days: 60, status: "Expired", days_until: -32 },
  { id: "cert3", person_company: "R. Torres", role_title: "Welder", cert_type: "AWS Welder", cert_number: "WC-8841", issue_date: "2025-06-01", expiry_date: "2026-06-01", alert_days: 60, status: "Valid", days_until: 70 },
  { id: "cert4", person_company: "A. Garcia", role_title: "Welder", cert_type: "AWS Welder", cert_number: "WC-7732", issue_date: "2025-04-15", expiry_date: "2026-04-15", alert_days: 30, status: "Expiring Soon", days_until: 23 },
  { id: "cert5", person_company: "J. Reyes", role_title: "PCI", cert_type: "SSPC Painting Inspector", cert_number: "PCI-1141", issue_date: "2024-09-01", expiry_date: "2026-09-01", alert_days: 60, status: "Valid", days_until: 162 },
  { id: "cert6", person_company: "J&L Trucking", role_title: "DOT", cert_type: "DOT Carrier", cert_number: "TX-DOT-2841", issue_date: "2026-01-01", expiry_date: "2026-12-31", alert_days: 30, status: "Valid", days_until: 283 },
  { id: "cert7", person_company: "Atlas Crane Co", role_title: "Rigging", cert_type: "Crane / Rigging", cert_number: "CRANE-4411", issue_date: "2026-02-01", expiry_date: "2026-04-01", alert_days: 30, status: "Expiring Soon", days_until: 9 },
  { id: "cert8", person_company: "Texas Steel Fab LLC", role_title: "Fabricator", cert_type: "AISC Company Certification", cert_number: "AISC-STD-0441", issue_date: "2023-07-01", expiry_date: "2026-07-01", alert_days: 60, status: "Valid", days_until: 100 },
];

export const ERECTION_SEQUENCES = [
  { id: "es1", seq_number: 1, phase: "Phase 1", description: "Column bases — all column lines, Level 1", profiles: "W14×82, W14×99 · 28 pcs", assembly_ids: "A-100 thru A-108", status: "Complete" },
  { id: "es2", seq_number: 2, phase: "Phase 1", description: "Spandrel beams — Grid A, Levels 1–2", profiles: "W24×68, W18×46 · 14 pcs", assembly_ids: "B-108, B-109", status: "Complete" },
  { id: "es3", seq_number: 3, phase: "Phase 1", description: "Interior framing — Bays 1–4, Level 2", profiles: "W12×50, W8×31 · 32 pcs", assembly_ids: "C-041 thru C-048", status: "In Progress" },
  { id: "es4", seq_number: 4, phase: "Phase 1", description: "HSS diagonal bracing — All bays, Level 2–3", profiles: "HSS6×6×½ · 18 pcs", assembly_ids: "D-017 thru D-024", status: "Queued" },
  { id: "es5", seq_number: 5, phase: "Phase 2", description: "Column continuation — Level 6–12", profiles: "W14×82 · 48 pcs", assembly_ids: "A-204, A-205", status: "In Progress" },
  { id: "es6", seq_number: 6, phase: "Phase 2", description: "Floor beams — Level 6–12 all bays", profiles: "W18×46, W16×40 · 112 pcs", assembly_ids: "—", status: "Queued" },
  { id: "es7", seq_number: 7, phase: "Phase 2", description: "Stair stringers and landing framing", profiles: "MC10×28.5, L4×4 · DM-001", assembly_ids: "MH-001", status: "In Progress" },
  { id: "es8", seq_number: 8, phase: "Phase 2", description: "Penthouse framing and mechanical screen", profiles: "Misc metals per DM-002", assembly_ids: "—", status: "Queued" },
];

export const SHIPMENTS = [
  { id: "sh1", load_number: "L-0041", ship_date: "2026-03-22", project: "Dallas Skyline Tower", carrier: "J&L Trucking / JL-2841", driver: "Mike T.", erection_seq: "Seq. 1–2", total_pieces: 14, total_weight: 18420, status: "Delivered" },
  { id: "sh2", load_number: "L-0040", ship_date: "2026-03-24", project: "Dallas Skyline Tower", carrier: "J&L Trucking / JL-2841", driver: "Mike T.", erection_seq: "Seq. 3", total_pieces: 22, total_weight: 28640, status: "Scheduled" },
  { id: "sh3", load_number: "L-0039", ship_date: "2026-03-25", project: "Houston Refinery", carrier: "Southwest Freight / SW-441", driver: "Carlos R.", erection_seq: "Seq. 1", total_pieces: 18, total_weight: 12100, status: "Scheduled" },
  { id: "sh4", load_number: "L-0038", ship_date: "2026-03-28", project: "Austin Data Center", carrier: "TBD", driver: "TBD", erection_seq: "Seq. 1", total_pieces: 10, total_weight: 6800, status: "Draft" },
];

export const GC_CONTACTS = [
  { id: "gc1", name: "Mark Johnson", company_name: "Turner Construction", role_title: "Project Manager", project: "Dallas Skyline Tower", phone: "(214) 555-0182", email: "m.johnson@turner.com", last_contact: "2026-03-22" },
  { id: "gc2", name: "Sarah Kim", company_name: "Turner Construction", role_title: "Field Superintendent", project: "Dallas Skyline Tower", phone: "(214) 555-0199", email: "s.kim@turner.com", last_contact: "2026-03-21" },
  { id: "gc3", name: "Steve Chen", company_name: "Bechtel Corp", role_title: "Project Engineer", project: "Houston Refinery Exp.", phone: "(713) 555-0241", email: "s.chen@bechtel.com", last_contact: "2026-03-18" },
  { id: "gc4", name: "David Park", company_name: "Apple Inc", role_title: "Owner's Rep", project: "Austin Data Center", phone: "(512) 555-0341", email: "d.park@apple.com", last_contact: "2026-03-15" },
  { id: "gc5", name: "James Wright", company_name: "PCL Construction", role_title: "Project Manager", project: "San Antonio Bridge", phone: "(210) 555-0441", email: "j.wright@pcl.com", last_contact: "2026-03-10" },
];

export const JOB_COSTS = [
  { id: "jc1", category: "Structural Steel Material", project: "Dallas Skyline Tower", budget: 196000, actual: 182400, committed: 196000 },
  { id: "jc2", category: "Misc Metal Material", project: "Dallas Skyline Tower", budget: 28000, actual: 24100, committed: 28000 },
  { id: "jc3", category: "Shop Labor", project: "Dallas Skyline Tower", budget: 168000, actual: 121200, committed: 168000 },
  { id: "jc4", category: "Paint / Coating", project: "Dallas Skyline Tower", budget: 42000, actual: 38200, committed: 42000 },
  { id: "jc5", category: "Freight / Shipping", project: "Dallas Skyline Tower", budget: 24000, actual: 19840, committed: 24000 },
  { id: "jc6", category: "Overhead & Burden", project: "Dallas Skyline Tower", budget: 64000, actual: 16100, committed: 64000 },
];

export const BILLING_APPLICATIONS = [
  { id: "ba1", app_number: "App. #1", period_to: "Jan 31, 2026", project: "Dallas Skyline Tower", pct_complete: 20, amount_claimed: 122400, retainage_pct: 10, retainage_withheld: 12240, amount_certified: 122400, status: "Certified" },
  { id: "ba2", app_number: "App. #2", period_to: "Feb 28, 2026", project: "Dallas Skyline Tower", pct_complete: 44, amount_claimed: 145520, retainage_pct: 10, retainage_withheld: 14552, amount_certified: 145520, status: "Certified" },
  { id: "ba3", app_number: "App. #3", period_to: "Mar 31, 2026", project: "Dallas Skyline Tower", pct_complete: 72, amount_claimed: 172480, retainage_pct: 10, retainage_withheld: 17248, amount_certified: null, status: "Submitted" },
];

export const USERS_LIST = [
  { id: "u1", first_name: "Jake", last_name: "Rivera", role: "owner", email: "jake@txsteelfab.com", avatar_color: "#4F46E5", active: true, last_active: "Now" },
  { id: "u2", first_name: "D.", last_name: "Nguyen", role: "qc", email: "d.nguyen@txsteelfab.com", avatar_color: "#D97706", active: true, last_active: "Active" },
  { id: "u3", first_name: "R.", last_name: "Torres", role: "worker", email: "r.torres@txsteelfab.com", avatar_color: "#7C3AED", active: true, last_active: "Active" },
  { id: "u4", first_name: "M.", last_name: "Kowalski", role: "foreman", email: "m.kowalski@txsteelfab.com", avatar_color: "#0891B2", active: true, last_active: "Active" },
  { id: "u5", first_name: "M.", last_name: "Smith", role: "worker", email: "m.smith@txsteelfab.com", avatar_color: "#64748B", active: true, last_active: "2h ago" },
];

export const NOTIFICATIONS = [
  { id: "n1", type: "error", message: "AISC hold on W14×82-1044 — QC sign-off required before erection", created_at: "2 min ago", read: false },
  { id: "n2", type: "warning", message: "PO-2026-0183 partial delivery — HSS6×6 48/120 pcs received. MTR pending.", created_at: "1 hr ago", read: false },
  { id: "n3", type: "warning", message: "Atlas Crane Co certification expiring in 9 days — CRANE-4411", created_at: "3 hr ago", read: false },
  { id: "n4", type: "success", message: "Load L-0041 shipped — 14 pieces to Dallas Skyline Tower", created_at: "5 hr ago", read: false },
];

export const ACTIVITY_FEED = [
  { id: "af1", user_name: "D. Nguyen", action: "updated", entity_type: "part", entity_id: "W14×82-1044", detail: "→ Welding", color: "#16A34A", time: "just now", category: "status_update" },
  { id: "af2", user_name: "R. Torres", action: "uploaded photo", entity_type: "part", entity_id: "HSS6×6-0312", detail: "weld inspection", color: "#D97706", time: "1 min", category: "inspection" },
  { id: "af3", user_name: "M. Kowalski", action: "opened AISC hold", entity_type: "checklist", entity_id: "W14×82 column QC review", detail: "", color: "#6366F1", time: "3 min", category: "qc" },
  { id: "af4", user_name: "Jake Rivera", action: "generated", entity_type: "shipment", entity_id: "Load L-0041", detail: "shipping ticket", color: "#2563EB", time: "8 min", category: "shipping" },
];

export const DEMO_ROLES = [
  { key: "owner", label: "Owner", color: "#4F46E5" },
  { key: "estimator", label: "Estimator", color: "#D97706" },
  { key: "pm", label: "Project Manager", color: "#2563EB" },
  { key: "foreman", label: "Shop Foreman", color: "#16A34A" },
  { key: "qc", label: "QC / CWI", color: "#7C3AED" },
  { key: "accounting", label: "Accounting", color: "#0891B2" },
  { key: "worker", label: "Shop Worker", color: "#64748B" },
];

