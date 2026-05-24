// RBAC matrix. The DB layer (RLS) is the source of truth for security; this
// matrix is API-layer pre-flight so we can return clear 403s and reject
// requests before they hit the DB.

import type { Role, TableConfig } from "./types.ts";

const ALL_READ: Role[] = ["owner", "pm", "estimator", "foreman", "qc", "accounting", "worker"];

export const TABLES: Record<string, TableConfig> = {
  projects: {
    table: "projects",
    insertable: ["owner", "pm"],
    updatable: ["owner", "pm"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
    sequence: { prefix: "PRJ-YYYY", field: "number" },
    activity: { entity_type: "projects", label_field: "name" },
  },
  parts: {
    table: "parts",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner", "pm", "foreman", "qc", "worker"],
    deletable: ["owner", "pm"],
    readable: ALL_READ,
    hasCompanyId: true,
    activity: { entity_type: "parts", label_field: "part_mark" },
  },
  assemblies: {
    table: "assemblies",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner", "pm", "foreman"],
    deletable: ["owner", "pm"],
    readable: ALL_READ,
    hasCompanyId: true,
    activity: { entity_type: "assemblies", label_field: "assembly_mark" },
  },
  drawings: {
    table: "drawings",
    insertable: ["owner", "pm"],
    updatable: ["owner", "pm"],
    deletable: ["owner", "pm"],
    readable: ALL_READ,
    hasCompanyId: true,
    activity: { entity_type: "drawings", label_field: "drawing_number" },
  },
  change_orders: {
    table: "change_orders",
    insertable: ["owner", "pm"],
    updatable: ["owner", "pm"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
    sequence: { prefix: "CO", field: "co_number" },
    activity: { entity_type: "change_orders", label_field: "co_number" },
  },
  rfis: {
    table: "rfis",
    insertable: ["owner", "pm", "foreman", "qc"],
    updatable: ["owner", "pm", "foreman", "qc"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
    sequence: { prefix: "RFI", field: "rfi_number" },
    activity: { entity_type: "rfis", label_field: "rfi_number" },
  },
  weld_inspections: {
    table: "weld_inspections",
    insertable: ["owner", "qc"],
    updatable: ["owner", "qc"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
    sequence: { prefix: "WLD", field: "weld_number" },
    activity: { entity_type: "weld_inspections", label_field: "weld_number" },
  },
  paint_inspections: {
    table: "paint_inspections",
    insertable: ["owner", "qc"],
    updatable: ["owner", "qc"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
    sequence: { prefix: "PI", field: "insp_number" },
    activity: { entity_type: "paint_inspections", label_field: "insp_number" },
  },
  aisc_checklist: {
    table: "aisc_checklist",
    insertable: ["owner", "qc", "pm"],
    updatable: ["owner", "qc", "pm"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  ncr_reports: {
    table: "ncr_reports",
    insertable: ["owner", "qc", "pm"],
    updatable: ["owner", "qc", "pm"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
    sequence: { prefix: "NCR", field: "ncr_number" },
    activity: { entity_type: "ncr_reports", label_field: "ncr_number" },
  },
  heat_numbers: {
    table: "heat_numbers",
    insertable: ["owner", "qc", "accounting", "foreman"],
    updatable: ["owner", "qc", "accounting", "foreman"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
    activity: { entity_type: "heat_numbers", label_field: "heat_number" },
  },
  certifications: {
    table: "certifications",
    insertable: ["owner", "qc"],
    updatable: ["owner", "qc"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  osha_checklists: {
    table: "osha_checklists",
    insertable: ["owner", "qc", "foreman"],
    updatable: ["owner", "qc", "foreman"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  daily_production_log: {
    table: "daily_production_log",
    insertable: ["owner", "foreman", "pm"],
    updatable: ["owner", "foreman", "pm"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
    activity: { entity_type: "daily_production_log", label_field: "station" },
  },
  cut_plans: {
    table: "cut_plans",
    insertable: ["owner", "foreman", "pm"],
    updatable: ["owner", "foreman", "pm"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  erection_sequence: {
    table: "erection_sequence",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner", "pm", "foreman"],
    deletable: ["owner", "pm"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  shipping_tickets: {
    table: "shipping_tickets",
    insertable: ["owner", "pm", "accounting"],
    updatable: ["owner", "pm", "accounting"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
    sequence: { prefix: "L", field: "ticket_number" },
    activity: { entity_type: "shipping_tickets", label_field: "ticket_number" },
  },
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
  billing_applications: {
    table: "billing_applications",
    insertable: ["owner", "accounting"],
    updatable: ["owner", "accounting"],
    deletable: ["owner"],
    readable: ["owner", "pm", "accounting"],
    hasCompanyId: true,
    activity: { entity_type: "billing_applications", label_field: "application_number" },
  },
  job_costs: {
    table: "job_costs",
    insertable: ["owner", "accounting"],
    updatable: ["owner", "accounting"],
    deletable: ["owner"],
    readable: ["owner", "pm", "accounting", "estimator"],
    hasCompanyId: true,
  },
  purchase_orders: {
    table: "purchase_orders",
    insertable: ["owner", "accounting"],
    updatable: ["owner", "accounting"],
    deletable: ["owner"],
    readable: ["owner", "pm", "accounting", "foreman"],
    hasCompanyId: true,
    sequence: { prefix: "PO", field: "po_number" },
    activity: { entity_type: "purchase_orders", label_field: "po_number" },
  },
  inventory: {
    table: "inventory",
    insertable: ["owner", "foreman", "accounting"],
    updatable: ["owner", "foreman", "accounting"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  inventory_adjustments: {
    table: "inventory_adjustments",
    insertable: ["owner", "foreman", "accounting"],
    updatable: ["owner"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  notifications: {
    table: "notifications",
    insertable: ["owner"], // most inserts come from triggers/cron
    updatable: ALL_READ,    // user can mark their own as read
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  gc_contacts: {
    table: "gc_contacts",
    insertable: ["owner", "pm", "estimator"],
    updatable: ["owner", "pm", "estimator"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  ai_insights: {
    table: "ai_insights",
    insertable: ["owner"], // primarily written by AI Copilot
    updatable: ALL_READ,
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  ai_chat_history: {
    table: "ai_chat_history",
    insertable: ALL_READ,
    updatable: ALL_READ,
    deletable: ALL_READ,
    readable: ALL_READ,
    hasCompanyId: true,
  },
  users: {
    table: "users",
    insertable: ["owner"],
    updatable: ["owner"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  audit_log: {
    table: "audit_log",
    insertable: [],
    updatable: [],
    deletable: [],
    readable: ["owner", "pm", "accounting"],
    hasCompanyId: true,
  },
  activity_feed: {
    table: "activity_feed",
    insertable: [],
    updatable: [],
    deletable: [],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  receiving_logs: {
    table: "receiving_logs",
    insertable: ["owner", "pm", "foreman"],
    updatable: ["owner", "pm", "foreman"],
    deletable: ["owner"],
    readable: ALL_READ,
    hasCompanyId: true,
  },
  file_attachments: {
    table: "file_attachments",
    insertable: ALL_READ,
    updatable: ALL_READ,
    deletable: ALL_READ,
    readable: ALL_READ,
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
