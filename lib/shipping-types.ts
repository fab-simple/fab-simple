// ─── Shipping Module Types ──────────────────────────────────────────────────
// All TypeScript interfaces for the upgraded Shipping Ticket / Bill of Lading module.

// ─── Enums ──────────────────────────────────────────────────────────────────

export type ShipLoadStatus =
  | "draft"
  | "assigned"
  | "loaded"
  | "shipped"
  | "received"
  | "on_hold"
  | "partial"
  | "cancelled"
  | "staged"
  | "in_transit"
  | "delivered"
  | "BUILDING"
  | "STAGED"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "DELIVERED"
  | "PARTIAL_DELIVERED";

export type ShipItemStatus =
  | "available"
  | "assigned"
  | "loaded"
  | "shipped"
  | "received"
  | "on_hold"
  | "BUILDING"
  | "STAGED"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "DELIVERED";

export type ReceiptStatus = "complete" | "partial" | "shortage" | "damaged";

// ─── Core Entities ──────────────────────────────────────────────────────────

export interface ShippingLoad {
  id: string;
  project_id?: string;
  ticket_number: string;
  load_number?: string;
  destination?: string;
  destination_name?: string | null;
  destination_address?: string | null;
  destination_contact?: string | null;
  destination_phone?: string | null;
  origin?: string | null;
  origin_name?: string | null;
  origin_address?: string | null;
  carrier_id?: string | null;
  carrier_name?: string | null;
  truck_number?: string | null;
  trailer_id?: string | null;
  trailer_number?: string | null;
  trailer_type?: string | null;
  trailer_capacity_lbs?: number | null;
  max_weight_lbs?: number | null;
  gross_weight_lbs?: number | null;
  tare_weight_lbs?: number | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  dot_number?: string | null;
  planned_ship_date?: string;
  actual_ship_date?: string | null;
  actual_arrival_date?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  signed_by?: string | null;
  signed_at?: string | null;
  signature_url?: string | null;
  status: ShipLoadStatus;
  total_pieces?: number;
  total_weight_lbs?: number;
  additional_weight_lbs?: number;
  net_weight_lbs?: number;
  utilization_pct?: number;
  sequence?: string | null;
  area?: string | null;
  zone?: string | null;
  work_package?: string | null;
  notes?: string | null;
  bol_notes?: string | null;
  internal_notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
  // Joined fields
  project_name?: string;
  project_number?: string;
  job_number?: string;
  customer_name?: string;
  gc_name?: string;
  site_contact?: string;
  site_phone?: string;
  erector_name?: string;
  items?: ShippingLoadItem[];
  additional_items?: ShippingAdditionalItem[];
}

export interface ShippingLoadItem {
  id: string;
  load_id: string;
  piece_id?: string | null;
  assembly_id?: string | null;
  assembly_mark?: string;
  mark?: string;
  piece_mark?: string | null;
  description?: string;
  profile?: string | null;
  main_material?: string;
  length_ft_in?: string;
  finish?: string;
  drawing_no?: string;
  bay_location?: string;
  qc_inspected?: boolean;
  quantity?: number;
  qty_on_load?: number;
  unit_weight_lbs?: number;
  weight_lbs?: number;
  total_weight_lbs?: number;
  sequence?: string | null;
  area?: string | null;
  zone?: string | null;
  grid?: string | null;
  level?: string | null;
  work_package?: string | null;
  status?: ShipItemStatus;
  loaded_at?: string | null;
  loaded_by?: string | null;
}

export interface ShippingAdditionalItem {
  id: string;
  load_id: string;
  description: string;
  quantity?: number;
  qty?: number;
  unit?: string;
  weight_lbs: number;
  category?: "BOLTS" | "TOUCHUP_PAINT" | "DUNNAGE" | "ANCHOR_RODS" | "HARDWARE" | string;
  notes?: string;
  created_at?: string;
}

export interface ShippingReceipt {
  id: string;
  load_id: string;
  ticket_number?: string;
  received_by?: string | null;
  received_by_name?: string | null;
  received_at: string;
  status?: ReceiptStatus;
  condition?: string;
  damage_reported?: boolean;
  signature_url?: string | null;
  pieces_expected?: number;
  pieces_received?: number;
  missing_marks?: string[];
  damaged_marks?: string[];
  comments?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface ShippingAuditEntry {
  id: string;
  load_id: string;
  action: string;
  detail?: string | null;
  user_name: string | null;
  created_at: string;
}

export interface ShippingAuditLog {
  id: string;
  load_id: string;
  action: string;
  timestamp?: string;
  created_at?: string;
  user_name: string;
  details?: string;
  detail?: string | null;
}

// ─── Reference Tables ───────────────────────────────────────────────────────

export interface Carrier {
  id: string;
  name: string;
  contact_name?: string | null;
  phone: string | null;
  email: string | null;
  address?: string | null;
  dot_number: string | null;
  active?: boolean;
  is_active?: boolean;
}

export type ShippingCarrier = Carrier;

export interface Trailer {
  id: string;
  trailer_number: string;
  type?: string;
  trailer_type?: string;
  capacity_lbs?: number;
  max_weight_lbs?: number;
  length_ft?: number | null;
  deck_length_ft?: number | null;
  active?: boolean;
  is_active?: boolean;
}

export type ShippingTrailer = Trailer;

export interface CustomerBranding {
  id: string;
  customer_name?: string;
  company_name?: string;
  tagline?: string;
  website?: string;
  primary_color?: string;
  secondary_color?: string;
  logo_url: string | null;
  address: string | null;
  contact_name?: string | null;
  phone: string | null;
  email: string | null;
}

// ─── Computed / View Models ─────────────────────────────────────────────────

export interface LoadReadiness {
  fabrication_complete: boolean;
  qc_complete: boolean;
  coating_complete: boolean;
  hardware_available: boolean;
  released_for_shipping: boolean;
  all_ready: boolean;
  issues: string[];
}

export interface LoadCompleteness {
  pieces_required: number;
  pieces_assigned: number;
  pieces_loaded: number;
  pieces_remaining: number;
  weight_required: number;
  weight_assigned: number;
  weight_loaded: number;
  is_complete: boolean;
  missing_marks: string[];
}

export interface ErectionPackageStatus {
  package_id: string | null;
  area: string;
  level: string | null;
  grid: string | null;
  sequences: string;
  work_package: string | null;
  total_pieces: number;
  shipped_pieces: number;
  completion_pct: number;
  missing_marks: string[];
}

export interface LoadTotals {
  total_pieces: number;
  totalPieces?: number;
  steel_weight_lbs: number;
  additional_weight_lbs: number;
  net_weight_lbs: number;
  totalWeightLbs?: number;
  trailer_capacity_lbs: number;
  remaining_capacity_lbs: number;
  utilization_pct: number;
  weightPercentage?: number;
  is_overweight: boolean;
  isOverweight?: boolean;
  is_warning: boolean; // > 90%
}

export interface ShippingDashboardKPIs {
  total_loads: number;
  ready_to_ship: number;
  shipped_today: number;
  received_today: number;
  loads_on_hold: number;
  partial_loads: number;
  total_tons_shipped: number;
  total_pieces_shipped: number;
  avg_utilization_pct: number;
}

// ─── PDF Data ───────────────────────────────────────────────────────────────

export interface ShippingTicketPdfData {
  // Branding
  client_logo_url: string | null;
  fabsimple_logo_url: string | null;

  // Header
  ticket_number: string;
  date: string;

  // Project Info
  project_name: string;
  project_number: string;
  customer_name: string;
  gc_name: string | null;
  contract_po: string | null;
  origin: string;
  destination: string;
  site_contact: string | null;
  site_phone: string | null;
  erector_name: string | null;

  // Carrier Info
  load_number: string;
  carrier: string;
  truck_number: string | null;
  trailer_number: string | null;
  trailer_capacity_lbs: number | null;
  driver: string | null;
  planned_ship_date: string;

  // Material
  items: Array<{
    assembly_mark: string;
    piece_mark: string | null;
    description: string;
    sequence: string | null;
    area: string | null;
    grid: string | null;
    qty: number;
    weight_lbs: number;
    weight_tons: number;
  }>;

  // Additional Items
  additional_items: Array<{
    description: string;
    quantity: number;
    weight_lbs: number;
  }>;

  // Totals
  totals: LoadTotals;

  // Erection Info
  erection_info: {
    area: string;
    level: string | null;
    grid: string | null;
    sequences: string;
    work_package: string | null;
    completion_pct: number;
  } | null;

  // Readiness
  readiness: LoadReadiness;

  // QR
  qr_url: string;

  // Load Status
  status: ShipLoadStatus;
}

// ─── Eligible Material (for load builder) ───────────────────────────────────

export interface EligibleAssembly {
  id: string;
  assembly_mark: string;
  description: string | null;
  total_weight: number;
  total_parts: number;
  completed_parts: number;
  status: string;
  sequence: string | null;
  area: string | null;
  zone: string | null;
  grid: string | null;
  level: string | null;
  work_package: string | null;
  is_ready: boolean;
  ready_issues: string[];
  already_shipped: boolean;
  assigned_load: string | null;
}

export interface EligiblePart {
  id: string;
  part_mark: string;
  assembly_mark: string | null;
  profile: string;
  weight: number;
  quantity: number;
  status: string;
  phase: string | null;
  is_ready: boolean;
  already_shipped: boolean;
  assigned_load: string | null;
}
