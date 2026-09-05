// RBAC matrix. The DB layer (RLS) is the source of truth for security; this
// matrix is API-layer pre-flight so we can return clear 403s and reject
// requests before they hit the DB.
//
// Source of truth: FabSimple v5 spec "Role-Based Access Matrix".
// `readable`   → roles that can SELECT rows of this table
// `insertable` → roles that can POST new rows ("Full" / "Create" cells)
// `updatable`  → roles that can PATCH rows ("Full" cells; some "Approve")
// `deletable`  → roles that can DELETE rows (intentionally tight; usually owner only)
//
// Roles strictly omitted from `readable` cannot even fetch lists (the API
// returns 403 before hitting Postgres) — this is what makes pages truly
// hidden, not just CTAs.

import type { Role, TableConfig } from "./types.ts";

const ALL_NON_WORKER: Role[] = ["owner", "pm", "estimator", "foreman", "qc", "accounting"];
const ALL_READ: Role[] = [...ALL_NON_WORKER, "worker"];

export const TABLES: Record<string, TableConfig> = {
  // Projects: Owner Full · Estimator View · PM Full · Foreman View · QC View · Accounting View
  projects: {
    table: "projects",
    insertable: ["owner", "pm"],
    updatable: ["owner", "pm"],
    deletable: ["owner"],
    readable: [...ALL_NON_WORKER],
    hasCompanyId: true,
    sequence: { prefix: "PRJ-YYYY", field: "number" },
    activity: { entity_type: "projects", label_field: "name" },
  },
  // Parts: Owner Full · PM Full · Foreman Full · QC View · Worker View
  parts: {
    table: "parts",
    insertable: ["owner", "pm", "foreman"],
    // Worker updates part status from the mobile worker view.
    updatable: ["owner", "pm", "foreman", "qc", "worker"],
    deletable: ["owner", "pm"],
    readable: ["owner", "pm", "foreman", "qc", "worker"],
    hasCompanyId: true,
    activity: { entity_type: "parts", label_field: "part_mark" },
  },
  // Assemblies: Owner Full · PM Full · Foreman Full · QC View
  assemblies: {
    table: "assemblies",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner", "pm", "foreman"],
    deletable: ["owner", "pm"],
    readable: ["owner", "pm", "foreman", "qc"],
    hasCompanyId: true,
    activity: { entity_type: "assemblies", label_field: "assembly_mark" },
  },
  // Drawings: Owner Full · PM Full · Foreman View · QC View · Worker View
  drawings: {
    table: "drawings",
    insertable: ["owner", "pm"],
    updatable: ["owner", "pm"],
    deletable: ["owner", "pm"],
    readable: ["owner", "pm", "foreman", "qc", "worker"],
    hasCompanyId: true,
    activity: { entity_type: "drawings", label_field: "drawing_number" },
  },
  // Change Orders: Owner Full · PM Full · Accounting View (accounting needs
  // to see approved COs in order to bill them).
  change_orders: {
    table: "change_orders",
    insertable: ["owner", "pm"],
    updatable: ["owner", "pm"],
    deletable: ["owner"],
    readable: ["owner", "pm", "accounting"],
    hasCompanyId: true,
    sequence: { prefix: "CO", field: "co_number" },
    activity: { entity_type: "change_orders", label_field: "co_number" },
  },
  // RFIs: Owner Full · PM Full · Foreman View · QC View
  rfis: {
    table: "rfis",
    insertable: ["owner", "pm"],
    updatable: ["owner", "pm"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman", "qc"],
    hasCompanyId: true,
    sequence: { prefix: "RFI", field: "rfi_number" },
    activity: { entity_type: "rfis", label_field: "rfi_number" },
  },
  // Weld Log: Owner Full · PM View · QC Full
  weld_inspections: {
    table: "weld_inspections",
    insertable: ["owner", "qc"],
    updatable: ["owner", "qc"],
    deletable: ["owner"],
    readable: ["owner", "pm", "qc"],
    hasCompanyId: true,
    sequence: { prefix: "WLD", field: "weld_number" },
    activity: { entity_type: "weld_inspections", label_field: "weld_number" },
  },
  // Paint Inspection: Owner Full · PM View · QC Full
  paint_inspections: {
    table: "paint_inspections",
    insertable: ["owner", "qc"],
    updatable: ["owner", "qc"],
    deletable: ["owner"],
    readable: ["owner", "pm", "qc"],
    hasCompanyId: true,
    sequence: { prefix: "PI", field: "insp_number" },
    activity: { entity_type: "paint_inspections", label_field: "insp_number" },
  },
  // AISC 303 Checklist: Owner Full · PM Full · Foreman View · QC Full
  aisc_checklist: {
    table: "aisc_checklist",
    insertable: ["owner", "qc", "pm"],
    updatable: ["owner", "qc", "pm"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman", "qc"],
    hasCompanyId: true,
  },
  // NCR Reports: Owner Full · PM View · Foreman View · QC Full
  ncr_reports: {
    table: "ncr_reports",
    insertable: ["owner", "qc"],
    updatable: ["owner", "qc"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman", "qc"],
    hasCompanyId: true,
    sequence: { prefix: "NCR", field: "ncr_number" },
    activity: { entity_type: "ncr_reports", label_field: "ncr_number" },
  },
  // Heat Numbers: Owner Full · PM View · QC Full · Foreman Full (widened per
  // procurement-traceability spec §13 D6 — receiving clerks assign heats to
  // bundles on the shop floor without routing through QC. RLS already
  // permitted foreman here; this brings the API pre-flight check in line).
  heat_numbers: {
    table: "heat_numbers",
    insertable: ["owner", "qc", "foreman"],
    updatable: ["owner", "qc", "foreman"],
    deletable: ["owner"],
    readable: ["owner", "pm", "qc", "foreman"],
    hasCompanyId: true,
    activity: { entity_type: "heat_numbers", label_field: "heat_number" },
  },
  // Certifications: Owner Full · PM View · QC Full
  certifications: {
    table: "certifications",
    insertable: ["owner", "qc"],
    updatable: ["owner", "qc"],
    deletable: ["owner"],
    readable: ["owner", "pm", "qc"],
    hasCompanyId: true,
  },
  // OSHA Checklist: Owner Full · PM Full · Foreman Full · QC View
  osha_checklists: {
    table: "osha_checklists",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner", "pm", "foreman"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman", "qc"],
    hasCompanyId: true,
  },
  // Daily Log: Owner Full · PM Full · Foreman Full
  daily_production_log: {
    table: "daily_production_log",
    insertable: ["owner", "foreman", "pm"],
    updatable: ["owner", "foreman", "pm"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman"],
    hasCompanyId: true,
    activity: { entity_type: "daily_production_log", label_field: "station" },
  },
  // Cut Plans: Owner Full · PM Full · Foreman Full
  cut_plans: {
    table: "cut_plans",
    insertable: ["owner", "foreman", "pm"],
    updatable: ["owner", "foreman", "pm"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman"],
    hasCompanyId: true,
  },
  // Erection Sequence: Owner Full · PM Full · Foreman Full
  erection_sequence: {
    table: "erection_sequence",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner", "pm", "foreman"],
    deletable: ["owner", "pm"],
    readable: ["owner", "pm", "foreman"],
    hasCompanyId: true,
  },
  // Shipping Tickets: Owner Full · PM Full · Foreman Create · Accounting View
  shipping_tickets: {
    table: "shipping_tickets",
    insertable: ["owner", "pm", "foreman"],
    // Foreman is Create-only — editing/deletion stays with Owner/PM.
    updatable: ["owner", "pm"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman", "accounting"],
    hasCompanyId: true,
    sequence: { prefix: "L", field: "ticket_number" },
    activity: { entity_type: "shipping_tickets", label_field: "ticket_number" },
  },
  // Estimating: Owner Full · Estimator Full · PM View · Accounting (needs to bill)
  estimates: {
    table: "estimates",
    insertable: ["owner", "estimator"],
    updatable: ["owner", "estimator"],
    deletable: ["owner"],
    readable: ["owner", "estimator", "pm", "accounting"],
    hasCompanyId: true,
    sequence: { prefix: "EST", field: "estimate_number" },
    activity: { entity_type: "estimates", label_field: "estimate_number" },
  },
  estimate_line_items: {
    table: "estimate_line_items",
    insertable: ["owner", "estimator"],
    updatable: ["owner", "estimator"],
    deletable: ["owner", "estimator"],
    readable: ["owner", "estimator", "pm", "accounting"],
    hasCompanyId: true,
  },
  // AIA G702 Billing: Owner Approve · PM View · Accounting Full
  billing_applications: {
    table: "billing_applications",
    insertable: ["owner", "accounting"],
    // Owner has "Approve" — keep updatable on owner+accounting.
    updatable: ["owner", "accounting"],
    deletable: ["owner"],
    readable: ["owner", "pm", "accounting"],
    hasCompanyId: true,
    activity: { entity_type: "billing_applications", label_field: "application_number" },
  },
  // G703 Schedule-of-Values line items. Estimators can manage these so the
  // estimate → billing handoff is editable post-conversion. Owner/Accounting
  // are the canonical owners; PM reads for context.
  billing_line_items: {
    table: "billing_line_items",
    insertable: ["owner", "accounting", "estimator"],
    updatable: ["owner", "accounting", "estimator"],
    deletable: ["owner", "accounting"],
    readable: ["owner", "pm", "accounting", "estimator"],
    hasCompanyId: true,
    activity: { entity_type: "billing_line_items", label_field: "description" },
  },
  // Job Cost: Owner Full · Estimator View · PM Full · Accounting Full
  job_costs: {
    table: "job_costs",
    insertable: ["owner", "pm", "accounting"],
    updatable: ["owner", "pm", "accounting"],
    deletable: ["owner"],
    readable: ["owner", "pm", "accounting", "estimator"],
    hasCompanyId: true,
  },
  // Purchase Orders: Owner Full · PM Full · Foreman View · Accounting Full
  purchase_orders: {
    table: "purchase_orders",
    insertable: ["owner", "pm", "accounting"],
    updatable: ["owner", "pm", "accounting"],
    deletable: ["owner"],
    readable: ["owner", "pm", "accounting", "foreman"],
    hasCompanyId: true,
    sequence: { prefix: "PO", field: "po_number" },
    activity: { entity_type: "purchase_orders", label_field: "po_number" },
  },
  // Inventory: Owner Full · Estimator View · PM Full · Foreman View · Accounting View
  inventory: {
    table: "inventory",
    insertable: ["owner", "pm"],
    updatable: ["owner", "pm"],
    deletable: ["owner"],
    readable: ["owner", "estimator", "pm", "foreman", "accounting"],
    hasCompanyId: true,
  },
  // Material Receiving log: Owner Full · PM Full · Foreman Full · Accounting View
  inventory_adjustments: {
    table: "inventory_adjustments",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman", "accounting"],
    hasCompanyId: true,
  },
  // Notifications fan out to every signed-in user — keep readable broad.
  notifications: {
    table: "notifications",
    insertable: ["owner"], // most inserts come from triggers/cron
    updatable: ALL_READ,    // user can mark their own as read
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  // GC Contacts: Owner Full · Estimator Full · PM Full
  gc_contacts: {
    table: "gc_contacts",
    insertable: ["owner", "pm", "estimator"],
    updatable: ["owner", "pm", "estimator"],
    deletable: ["owner"],
    readable: ["owner", "pm", "estimator"],
    hasCompanyId: true,
  },
  // AI Copilot — same audience as Dashboard (everyone but worker).
  ai_insights: {
    table: "ai_insights",
    insertable: ["owner"], // primarily written by AI Copilot
    updatable: [...ALL_NON_WORKER],
    deletable: ["owner"],
    readable: [...ALL_NON_WORKER],
    hasCompanyId: true,
  },
  ai_chat_history: {
    table: "ai_chat_history",
    insertable: [...ALL_NON_WORKER],
    updatable: [...ALL_NON_WORKER],
    deletable: [...ALL_NON_WORKER],
    readable: [...ALL_NON_WORKER],
    hasCompanyId: true,
  },
  // Users & Roles: Owner only.
  users: {
    table: "users",
    insertable: ["owner"],
    updatable: ["owner"],
    deletable: ["owner"],
    // Other roles need to look up display names (parts.assigned_to → user) so
    // keep read broad — but no writes.
    readable: ALL_READ,
    hasCompanyId: true,
  },
  // Audit Log: Owner / PM / Accounting.
  audit_log: {
    table: "audit_log",
    insertable: [],
    updatable: [],
    deletable: [],
    readable: ["owner", "pm", "accounting"],
    hasCompanyId: true,
  },
  // Activity Feed: every signed-in user (used for the realtime header).
  activity_feed: {
    table: "activity_feed",
    insertable: [],
    updatable: [],
    deletable: [],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  // Receiving log entries — same audience as Material Receiving page.
  receiving_logs: {
    table: "receiving_logs",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner", "pm", "foreman"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman", "accounting"],
    hasCompanyId: true,
  },
  // Attachments piggyback off whatever entity they're tied to.
  file_attachments: {
    table: "file_attachments",
    insertable: ALL_READ,
    updatable: ALL_READ,
    deletable: ALL_READ,
    readable: ALL_READ,
    hasCompanyId: true,
  },

  // ---------------------------------------------------------------------
  // Procurement & Material Traceability — Phase 1
  // Source: docs/procurement-material-traceability-spec.md §7.1
  // ---------------------------------------------------------------------

  // Vendors: Owner Full · PM Full · Accounting Full (company-wide master data)
  vendors: {
    table: "vendors",
    insertable: ["owner", "pm", "accounting"],
    updatable: ["owner", "pm", "accounting"],
    deletable: ["owner"],
    readable: [...ALL_NON_WORKER],
    hasCompanyId: true,
    activity: { entity_type: "vendors", label_field: "name" },
  },
  // Inbound Shipments (vendor -> shop): Owner Full · PM Full · Foreman Full · Accounting Full
  inbound_shipments: {
    table: "inbound_shipments",
    insertable: ["owner", "pm", "foreman", "accounting"],
    updatable: ["owner", "pm", "foreman", "accounting"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman", "accounting"],
    hasCompanyId: true,
    sequence: { prefix: "SHP", field: "shipment_number" },
    activity: { entity_type: "inbound_shipments", label_field: "shipment_number" },
  },
  // Receivings: append-only in spirit — Foreman can create, only Owner/PM
  // correct history (§13 D9). RLS enforces the same split at the DB layer.
  receivings: {
    table: "receivings",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner", "pm"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman", "accounting"],
    hasCompanyId: true,
    sequence: { prefix: "REC", field: "receiving_number" },
    activity: { entity_type: "receivings", label_field: "receiving_number" },
  },
  // Bundles: Owner Full · PM Full · Foreman Full
  bundles: {
    table: "bundles",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner", "pm", "foreman"],
    deletable: ["owner"],
    readable: ["owner", "pm", "foreman", "qc"],
    hasCompanyId: true,
    sequence: { prefix: "BND", field: "bundle_number" },
    activity: { entity_type: "bundles", label_field: "bundle_number" },
  },
  // Material Lots: Owner Full · PM Full · Foreman Full · QC Full · Estimator View
  material_lots: {
    table: "material_lots",
    insertable: ["owner", "pm", "foreman", "qc"],
    updatable: ["owner", "pm", "foreman", "qc"],
    deletable: ["owner"],
    readable: ["owner", "estimator", "pm", "foreman", "qc"],
    hasCompanyId: true,
    sequence: { prefix: "LOT", field: "lot_number" },
    activity: { entity_type: "material_lots", label_field: "lot_number" },
  },
  // MTR Documents: Foreman can attach + trigger OCR; only QC/Owner verify
  // (§13 D5 — verification is what lifts heat quarantine).
  mtr_documents: {
    table: "mtr_documents",
    insertable: ["owner", "qc", "foreman"],
    updatable: ["owner", "qc"],
    deletable: ["owner"],
    readable: ["owner", "pm", "qc", "foreman"],
    hasCompanyId: true,
    activity: { entity_type: "mtr_documents", label_field: "mill_name" },
  },
  // Lot Reservations (§16) — the only place a project ever touches material.
  // Writes are deliberately blocked here: creating/releasing a reservation
  // requires an availability check the generic CRUD handler can't do, so
  // both go through dedicated endpoints (POST /material-lots/:id/reserve,
  // POST /lot-reservations/:id/release in controllers/lotReservation.ts).
  // This entry exists so GET list/get (for the Inventory page) works.
  lot_reservations: {
    table: "lot_reservations",
    insertable: [],
    updatable: [],
    deletable: [],
    readable: ["owner", "estimator", "pm", "foreman", "qc"],
    hasCompanyId: true,
  },
  // Inventory Reservations — soft holds on bulk stock created atomically
  // inside fn_create_rfq and released/consumed by fn_award_vendor_quote.
  // Manual release goes through POST /inventory-reservations/:id/release
  // in controllers/inventoryReservation.ts. Same read-only CRUD pattern
  // as lot_reservations: this entry exists only for GET list/get so the
  // Inventory page can display Reserved / Available columns.
  inventory_reservations: {
    table: "inventory_reservations",
    insertable: [],
    updatable: [],
    deletable: [],
    readable: ["owner", "estimator", "pm", "foreman", "accounting"],
    hasCompanyId: true,
  },
  // Material Issues — hard-lock / consumption records. Insertable is blocked
  // here because issueMaterial() performs an availability check + heat
  // quarantine guard that the generic CRUD handler can't replicate. The void
  // path is similarly behind POST /material-issues/:id/void. This entry
  // enables GET list/get so the traceability tab and part detail can surface
  // issue history without a bespoke query.
  material_issues: {
    table: "material_issues",
    insertable: [],    // enforced through POST /parts/:id/issue-material
    updatable: [],     // enforced through POST /material-issues/:id/void
    deletable: [],     // intentional — material_issues are immutable
    readable: ["owner", "pm", "foreman", "qc", "estimator", "accounting"],
    hasCompanyId: true,
  },

  // Phase 2 — Sourcing Workflow (§15). Material Requirements is a plain
  // single-table record (estimator raises requirements during takeoff), so
  // it stays fully generic-CRUD.
  material_requirements: {
    table: "material_requirements",
    insertable: ["owner", "pm", "estimator"],
    updatable: ["owner", "pm", "estimator"],
    deletable: ["owner", "pm"],
    readable: ["owner", "pm", "estimator", "foreman", "accounting"],
    hasCompanyId: true,
    sequence: { prefix: "MR", field: "mr_number" },
    activity: { entity_type: "material_requirements", label_field: "mr_number" },
  },
  // rfqs/vendor_quotes: insertable is deliberately empty — a compound create
  // (header + lines + vendors, or header + priced lines) can only produce a
  // valid row via the RPC-backed endpoints in controllers/rfq.ts. A bare
  // generic insert would create a useless orphaned header with no lines.
  // updatable stays open for simple corrections (e.g. "mark as sent").
  rfqs: {
    table: "rfqs",
    insertable: [],
    updatable: ["owner", "pm", "accounting"],
    deletable: ["owner"],
    readable: ["owner", "pm", "accounting", "estimator"],
    hasCompanyId: true,
    activity: { entity_type: "rfqs", label_field: "rfq_number" },
  },
  rfq_lines: {
    table: "rfq_lines",
    insertable: [],
    updatable: [],
    deletable: [],
    readable: ["owner", "pm", "accounting", "estimator"],
    hasCompanyId: true,
  },
  rfq_vendors: {
    table: "rfq_vendors",
    insertable: [],
    updatable: [],
    deletable: [],
    readable: ["owner", "pm", "accounting", "estimator"],
    hasCompanyId: true,
  },
  vendor_quotes: {
    table: "vendor_quotes",
    insertable: [],
    updatable: ["owner", "pm", "accounting"],
    deletable: [],
    readable: ["owner", "pm", "accounting", "estimator"],
    hasCompanyId: true,
  },
  vendor_quote_lines: {
    table: "vendor_quote_lines",
    insertable: [],
    updatable: [],
    deletable: [],
    readable: ["owner", "pm", "accounting", "estimator"],
    hasCompanyId: true,
  },
  // Read-only view (Phase 1, §11) — never registered generically until now.
  // The RFQ comparison table surfaces on_time_pct/exception_count per vendor
  // read-only, reusing this view as-is rather than inventing a new score.
  vendor_performance: {
    table: "vendor_performance",
    insertable: [],
    updatable: [],
    deletable: [],
    readable: ["owner", "pm", "accounting", "estimator"],
    hasCompanyId: true,
  },
};

export function tableConfig(table: string): TableConfig | undefined {
  return TABLES[table];
}

export function canRead(role: Role, table: string): boolean {
  return tableConfig(table)?.readable.includes(role) ?? false;
}
export function canInsert(role: Role, table: string): boolean {
  return tableConfig(table)?.insertable.includes(role) ?? false;
}
export function canUpdate(role: Role, table: string): boolean {
  return tableConfig(table)?.updatable.includes(role) ?? false;
}
export function canDelete(role: Role, table: string): boolean {
  return tableConfig(table)?.deletable.includes(role) ?? false;
}
