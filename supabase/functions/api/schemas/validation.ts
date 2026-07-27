// Zod schemas per table for INSERT/UPDATE payloads.
// Update schemas are .partial() of insert (all fields optional).

import { z } from "zod";

const uuid = z.string().uuid();
const numeric = z.coerce.number();
const intish = z.coerce.number().int();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

export const Schemas = {
  projects: z.object({
    name: z.string().min(1).max(200),
    number: z.string().min(1).max(60).optional(),
    gc_name: z.string().max(200).optional(),
    gc_contact: z.string().max(200).optional(),
    gc_phone: z.string().max(30).optional(),
    contract_value: numeric.nonnegative().optional(),
    contract_type: z.enum(["Lump Sum", "GMP", "T&M", "Unit Price"]).optional(),
    est_tonnage: numeric.nonnegative().optional(),
    status: z.enum(["active", "on_hold", "completed", "archived"]).optional(),
    pm_id: uuid.optional(),
    start_date: dateStr.optional(),
    deadline: dateStr.optional(),
    description: z.string().max(2000).optional(),
    color: z.string().max(20).optional(),
  }),

  parts: z.object({
    project_id: uuid,
    part_mark: z.string().min(1).max(80),
    assembly_mark: z.string().max(80).optional(),
    profile: z.string().min(1).max(80),
    grade: z.string().max(40).optional(),
    length: z.string().max(40).optional(),
    weight: numeric.optional(),
    quantity: intish.positive().default(1),
    status: z.enum(["not_started", "ordered", "in_progress", "complete", "shipped", "on_hold"]).optional(),
    phase: z.string().max(20).optional(),
    heat_number: z.string().max(60).optional(),
    material_lot_id: uuid.optional().nullable(),
    drawing_id: uuid.optional(),
    assigned_user_id: uuid.optional(),
    notes: z.string().max(2000).optional(),
    finish: z.string().max(200).optional().nullable(),
    cut_completed_by: uuid.optional().nullable(),
    cut_completed_at: z.string().optional().nullable(),
    cut_hours: numeric.optional().nullable(),
    cut_drop_length: z.string().max(80).optional().nullable(),
    fit_completed_by: uuid.optional().nullable(),
    fit_completed_at: z.string().optional().nullable(),
    fit_hours: numeric.optional().nullable(),
    fit_skipped: z.boolean().optional().nullable(),
    weld_completed_by: uuid.optional().nullable(),
    weld_completed_at: z.string().optional().nullable(),
    weld_qc_by: uuid.optional().nullable(),
    weld_qc_at: z.string().optional().nullable(),
    weld_hours: numeric.optional().nullable(),
    weld_skipped: z.boolean().optional().nullable(),
    finish_completed_by: uuid.optional().nullable(),
    finish_completed_at: z.string().optional().nullable(),
    finish_hours: numeric.optional().nullable(),
    insp_completed_by: uuid.optional().nullable(),
    insp_completed_at: z.string().optional().nullable(),
  }),

  assemblies: z.object({
    project_id: uuid,
    assembly_mark: z.string().min(1).max(80),
    description: z.string().max(500).optional(),
    total_weight: numeric.optional(),
  }),

  drawings: z.object({
    project_id: uuid,
    drawing_number: z.string().min(1).max(60),
    revision: z.string().min(1).max(10).default("A"),
    title: z.string().max(200).optional(),
    type: z.enum(["shop", "erection", "connection"]).default("shop"),
    status: z.enum(["in_progress", "submitted", "approved", "released", "superseded"]).optional(),
    current_revision: z.boolean().default(true),
    date_issued: dateStr.optional(),
    approved_by: uuid.optional(),
    file_url: z.string().url().optional(),
  }),

  change_orders: z.object({
    project_id: uuid,
    description: z.string().min(1).max(2000),
    amount: numeric,
    status: z.enum(["pending", "approved", "rejected"]).default("pending"),
    drawing_rev: z.string().max(20).optional(),
    notes: z.string().max(2000).optional(),
  }),

  rfis: z.object({
    project_id: uuid,
    question: z.string().min(1).max(4000),
    submitted_to: z.string().max(200).optional(),
    status: z.enum(["open", "answered", "closed"]).default("open"),
    answer: z.string().max(4000).optional(),
  }),

  weld_inspections: z.object({
    project_id: uuid.optional(),
    part_id: uuid.optional(),
    joint_type: z.enum(["CJP Groove", "PJP Groove", "Fillet", "Plug / Slot"]),
    fillet_size: z.string().max(30).optional(),
    weld_process: z.enum(["FCAW / E71T-1", "SMAW / E7018", "GMAW / ER70S-6", "SAW"]),
    filler_metal: z.string().min(1).max(60),
    inspection_method: z.enum(["VT (Visual)", "UT (Ultrasonic)", "MT (Magnetic Particle)", "PT (Dye Penetrant)", "RT (Radiographic)"]),
    cwi_reference: z.string().max(60).optional(),
    inspector_name: z.string().min(1).max(120),
    result: z.enum(["pass", "fail", "hold", "pending"]).default("pending"),
    aws_d11_reference: z.string().max(60).optional(),
    notes: z.string().max(2000).optional(),
    inspection_date: dateStr.optional(),
  }),

  paint_inspections: z.object({
    project_id: uuid.optional(),
    part_id: uuid.optional(),
    surface_prep: z.string().min(1).max(60),
    primer_dft: numeric.nonnegative(),
    topcoat_dft: numeric.nonnegative(),
    required_min: numeric.nonnegative().default(0),
    inspector_name: z.string().min(1).max(120),
    ambient_temp: numeric.optional(),
    humidity_pct: numeric.optional(),
    notes: z.string().max(2000).optional(),
    inspection_date: dateStr.optional(),
  }),

  aisc_checklist: z.object({
    project_id: uuid,
    section_ref: z.string().max(60),
    item_text: z.string().min(1).max(500),
    category: z.string().max(60),
    status: z.enum(["open", "done", "hold", "na"]).default("open"),
    notes: z.string().max(2000).optional(),
  }),

  ncr_reports: z.object({
    project_id: uuid.optional(),
    part_id: uuid.optional(),
    description: z.string().min(1).max(2000),
    root_cause: z.string().max(2000).optional(),
    corrective_action: z.string().max(2000).optional(),
    status: z.enum(["open", "in_progress", "re_inspected", "closed"]).default("open"),
    blocks_shipping: z.boolean().default(true),
    assigned_to: uuid.optional(),
  }),

  heat_numbers: z.object({
    heat_number: z.string().min(1).max(60),
    material_grade: z.string().min(1).max(40),
    mill_name: z.string().max(120).optional(),
    supplier: z.string().max(120).optional(),
    mtr_status: z.enum(["pending", "received", "verified"]).default("pending"),
    receipt_number: z.string().max(60).optional(),
  }),

  certifications: z.object({
    cert_type: z.string().min(1).max(120),
    holder_name: z.string().min(1).max(120),
    cert_number: z.string().max(60).optional(),
    issue_date: dateStr.optional(),
    expiry_date: dateStr,
    alert_days: intish.positive().default(30),
  }),

  osha_checklists: z.object({
    section_ref: z.string().max(60),
    item_text: z.string().min(1).max(500),
    category: z.string().max(60).optional(),
    status: z.enum(["open", "done", "hold", "na"]).default("open"),
  }),

  daily_production_log: z.object({
    project_id: uuid.optional(),
    log_date: dateStr,
    shift: z.string().max(20).optional(),
    station: z.string().min(1).max(60),
    operators: z.array(z.string()).optional(),
    parts_completed: intish.nonnegative().default(0),
    hours_worked: numeric.nonnegative().default(0),
    operation_type: z.string().max(60).optional(),
    notes: z.string().max(2000).optional(),
  }),

  cut_plans: z.object({
    project_id: uuid.optional(),
    profile: z.string().min(1).max(60),
    stock_length: numeric.positive(),
    kerf: numeric.nonnegative().default(0.125),
    min_remnant: numeric.nonnegative().default(6),
    cuts: z.array(z.unknown()).default([]),
    parameters_json: z.unknown().optional(),
  }),

  erection_sequence: z.object({
    project_id: uuid,
    sequence_number: intish.positive(),
    part_id: uuid.optional(),
    description: z.string().max(500).optional(),
    load_number: z.string().max(60).optional(),
    priority: intish.nonnegative().default(0),
    phase: z.string().max(20).optional(),
  }),

  shipping_tickets: z.object({
    project_id: uuid.optional(),
    load_number: z.string().max(60).optional(),
    truck_number: z.string().max(60).optional(),
    carrier: z.string().max(120).optional(),
    driver_name: z.string().max(120).optional(),
    ship_date: dateStr,
    destination: z.string().max(200).optional(),
    parts: z.array(z.unknown()).default([]),
    total_pieces: intish.nonnegative().default(0),
    total_weight: numeric.optional(),
    status: z.enum(["pending", "loaded", "in_transit", "delivered"]).default("pending"),
  }),

  estimates: z.object({
    project_name: z.string().min(1).max(200),
    gc_name: z.string().max(200).optional(),
    status: z.enum(["draft", "submitted", "under_review", "won", "lost", "withdrawn"]).default("draft"),
    total_amount: numeric.nonnegative().default(0),
    bid_per_lb: numeric.optional(),
    bid_per_ton: numeric.optional(),
    structural_tons: numeric.optional(),
    misc_metal_lbs: numeric.optional(),
    margin_pct: numeric.optional(),
    bid_due_date: dateStr.optional(),
    scenarios: z.array(z.unknown()).default([]),
    notes: z.string().max(2000).optional(),
    // Redesign columns
    architect_eor: z.string().max(200).optional(),
    project_location: z.string().max(300).optional(),
    bid_type: z.string().max(60).optional(),
    drawing_set_ref: z.string().max(200).optional(),
    unique_piece_marks: intish.nonnegative().optional(),
    connection_complexity: z.string().max(60).optional(),
    detailing_hours: numeric.nonnegative().optional(),
    fabrication_hours: numeric.nonnegative().optional(),
    erection_hours: numeric.nonnegative().optional(),
    labor_rate: numeric.nonnegative().optional(),
    freight_mill_to_shop: numeric.nonnegative().optional(),
    freight_shop_to_site: numeric.nonnegative().optional(),
    paint_coating_required: z.boolean().optional(),
    coating_type: z.string().max(100).optional(),
    coating_pricing_method: z.string().max(20).optional(),
    coating_price_per_ton: numeric.nonnegative().optional(),
    coating_lump_sum: numeric.nonnegative().optional(),
    contingency_pct: numeric.min(0).max(100).optional(),
    exclusions_qualifications: z.string().max(5000).optional(),
    materials_breakdown: z.array(z.object({
      shape: z.string(),
      tons: numeric.nonnegative(),
      price_per_ton: numeric.nonnegative(),
    })).optional(),
    alternates: z.array(z.object({
      description: z.string(),
      type: z.enum(["add", "deduct"]),
      amount: numeric,
    })).optional(),
  }),

  estimate_line_items: z.object({
    estimate_id: uuid,
    category: z.enum(["structural", "misc", "shop_labor", "field_labor", "detailing", "freight", "coating"]),
    description: z.string().min(1).max(500),
    quantity: numeric.positive().default(1),
    unit_cost: numeric.nonnegative().default(0),
    labor_hours: numeric.nonnegative().optional(),
    sort_order: intish.nonnegative().default(0),
  }),

  billing_applications: z.object({
    project_id: uuid,
    application_number: intish.positive(),
    period_to: dateStr,
    original_contract: numeric.nonnegative(),
    change_orders_total: numeric.nonnegative().default(0),
    completed_to_date: numeric.nonnegative(),
    materials_stored: numeric.nonnegative().default(0),
    retainage_percent: numeric.min(0).max(100).default(10),
    pct_complete: numeric.min(0).max(100),
    notes: z.string().max(2000).optional(),
    status: z.enum(["draft", "submitted", "certified", "paid"]).default("draft"),
  }),

  job_costs: z.object({
    project_id: uuid,
    cost_code: z.string().min(1).max(60),
    description: z.string().max(200).optional(),
    budget_amount: numeric.nonnegative().default(0),
    actual_amount: numeric.nonnegative().default(0),
    committed: numeric.nonnegative().default(0),
  }),

  purchase_orders: z.object({
    project_id: uuid.optional(),
    vendor: z.string().min(1).max(200),
    vendor_id: uuid.optional(),
    items: z.array(z.unknown()).default([]),
    total_amount: numeric.nonnegative().default(0),
    qty_ordered: numeric.optional(),
    qty_received: numeric.nonnegative().default(0),
    receiving_status: z.string().max(40).optional(),
    status: z.enum(["draft", "issued", "partial", "received", "closed"]).default("draft"),
    issued_date: dateStr.optional(),
    expected_date: dateStr.optional(),
    received_date: dateStr.optional(),
    notes: z.string().max(2000).optional(),
    // Vendor confirmation (Module 5) — set by whoever logs the vendor's
    // response to the PO; not required at PO creation time.
    confirmation_status: z.enum(["pending", "confirmed", "delayed", "rejected"]).optional(),
    confirmed_qty: numeric.optional(),
    confirmed_date: dateStr.optional(),
    mill_name: z.string().max(120).optional(),
    rolling_schedule: z.string().max(200).optional(),
  }),

  inventory: z.object({
    profile: z.string().min(1).max(80),
    grade: z.string().max(40).optional(),
    length: numeric.optional(),
    quantity: numeric.nonnegative(),
    location: z.string().max(60).optional(),
    reorder_point: numeric.nonnegative().default(0),
    max_stock: numeric.optional(),
    unit_cost: numeric.optional(),
  }),

  inventory_adjustments: z.object({
    inventory_id: uuid,
    adjustment_type: z.enum(["received", "consumed", "manual", "damaged"]),
    quantity_change: numeric,
    reason: z.string().max(500).optional(),
    reference_id: uuid.optional(),
    reference_type: z.string().max(60).optional(),
  }),

  notifications: z.object({
    user_id: uuid,
    type: z.enum(["cert_expiry", "inventory_low", "qc_failure", "ncr_created", "co_approved", "info"]).default("info"),
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(2000),
    entity_type: z.string().max(60).optional(),
    entity_id: uuid.optional(),
    entity_link: z.string().max(500).optional(),
  }),

  gc_contacts: z.object({
    project_id: uuid.optional(),
    gc_company: z.string().min(1).max(200),
    contact_name: z.string().min(1).max(120),
    role: z.string().max(60).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(30).optional(),
    notes: z.string().max(2000).optional(),
  }),

  // -------------------------------------------------------------------
  // Procurement & Material Traceability — Phase 1
  // Source: docs/procurement-material-traceability-spec.md §6
  // -------------------------------------------------------------------

  vendors: z.object({
    name: z.string().min(1).max(200),
    contact_name: z.string().max(120).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(30).optional(),
    address: z.string().max(400).optional(),
    payment_terms: z.string().max(200).optional(),
    status: z.enum(["active", "inactive", "blacklisted"]).default("active"),
    preferred: z.boolean().default(false),
    notes: z.string().max(2000).optional(),
  }),

  inbound_shipments: z.object({
    po_id: uuid,
    truck_number: z.string().max(60).optional(),
    carrier: z.string().max(120).optional(),
    bill_of_lading: z.string().max(120).optional(),
    status: z.enum(["scheduled", "shipped", "in_transit", "arrived", "received"]).default("scheduled"),
    scheduled_date: dateStr.optional(),
    shipped_date: dateStr.optional(),
    arrived_date: dateStr.optional(),
  }),

  // project_id is optional — a DB trigger (fn_receivings_before_insert)
  // derives it from po_id when the caller omits it, so the Global Project
  // Context can't be spoofed by a client-supplied mismatch. Same trigger
  // computes qty_remaining_on_po/qty_backordered/qty_over_delivered
  // server-side from the PO's qty_ordered, so they aren't client inputs.
  receivings: z.object({
    project_id: uuid.optional(),
    po_id: uuid,
    inbound_shipment_id: uuid.optional(),
    vendor_id: uuid.optional(),
    received_date: dateStr.optional(),
    qty_received: numeric.positive(),
    exceptions: z.string().max(2000).optional(),
  }),

  // project_id optional — derived from receiving_id by
  // fn_bundles_set_project_id when omitted.
  bundles: z.object({
    project_id: uuid.optional(),
    receiving_id: uuid,
    quantity: numeric.positive(),
    storage_location: z.string().max(120).optional(),
  }),

  // Direct writes to material_lots cover location/status corrections; the
  // primary creation path is the fn_assign_heat_to_bundle RPC (see
  // controllers/heatAssignment.ts), not this generic insert route.
  material_lots: z.object({
    project_id: uuid.optional(),
    bundle_id: uuid.optional(),
    heat_number_id: uuid,
    profile: z.string().min(1).max(80),
    grade: z.string().min(1).max(40),
    quantity: numeric.nonnegative(),
    original_quantity: numeric.nonnegative(),
    length: numeric.optional(),
    location: z.string().max(120).optional(),
    status: z.enum(["available", "reserved", "released", "consumed", "scrapped"]).optional(),
  }),

  mtr_documents: z.object({
    heat_number_id: uuid,
    file_attachment_id: uuid.optional(),
    yield_strength: numeric.optional(),
    tensile_strength: numeric.optional(),
    chemistry: z.record(z.string(), z.number()).optional(),
    mill_name: z.string().max(120).optional(),
    ocr_status: z.enum(["pending", "extracted", "manual_review", "verified"]).optional(),
    extracted_by: z.string().max(120).optional(),
  }),
} as const;

export type TableName = keyof typeof Schemas;

export function getInsertSchema(table: string) {
  return (Schemas as Record<string, z.ZodTypeAny>)[table];
}
export function getUpdateSchema(table: string) {
  const base = (Schemas as Record<string, z.ZodTypeAny>)[table];
  return base instanceof z.ZodObject ? base.partial() : base;
}
