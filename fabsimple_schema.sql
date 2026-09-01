-- ============================================================================
-- FabSimple v5 — Database Schema
-- Scope: Job Award → Detailer BOM → Procurement → Receiving → Inventory →
--        Job Pull → Shop Production → QC → Shipping → Erection
--
-- Engine: PostgreSQL 14+
-- Design principle: heat_number is a first-class part of the primary key
-- chain everywhere it appears. Never merge two heats into one row.
-- ============================================================================

CREATE TYPE user_role AS ENUM
  ('admin','pm','estimator','detailer','purchasing','yard','shop_foreman',
   'fitter','welder','qc_inspector','shipping','field_erector');

CREATE TYPE job_status AS ENUM
  ('awarded','bom_pending','bom_validated','material_ordered',
   'in_production','shipped','erecting','closed');

CREATE TYPE bom_status AS ENUM
  ('submitted','validating','validated','rejected','superseded');

CREATE TYPE validation_result AS ENUM ('pass','fail','warning','overridden');

CREATE TYPE po_status AS ENUM
  ('draft','issued','partially_received','received','closed','cancelled');

CREATE TYPE lot_status AS ENUM
  ('available','reserved','partially_consumed','consumed','on_hold');

CREATE TYPE piece_status AS ENUM
  ('planned','material_locked','cut','fit','welded','qc_pending',
   'qc_passed','qc_failed','painted','staged','shipped','erected');

CREATE TYPE qc_result AS ENUM ('pass','fail','repair','n_a');

-- ============================================================================
-- CORE / IDENTITY
-- ============================================================================

CREATE TABLE users (
  user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  role            user_role NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vendors (
  vendor_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  vendor_type     TEXT,               -- mill, service_center, misc_supplier
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  payment_terms   TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE jobs (
  job_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number      TEXT UNIQUE NOT NULL,      -- shop's internal job number, stamped everywhere
  project_name    TEXT NOT NULL,
  client_name     TEXT,
  general_contractor TEXT,
  eor_name        TEXT,                       -- engineer of record
  contract_tonnage NUMERIC(10,2),
  contract_value  NUMERIC(14,2),
  awarded_date    DATE,
  target_ship_date DATE,
  status          job_status NOT NULL DEFAULT 'awarded',
  aisc_cert_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES users(user_id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_documents (
  document_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(job_id),
  doc_type        TEXT NOT NULL,   -- ifc_drawing, erection_drawing, spec, contract, mill_cert
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  uploaded_by     UUID REFERENCES users(user_id),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- DETAILER BOM INTAKE (versioned, never overwritten)
-- ============================================================================

CREATE TABLE detailer_boms (
  bom_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(job_id),
  revision        INT NOT NULL,               -- Rev 0, Rev 1, Rev 2...
  source_file_name TEXT,
  source_format   TEXT,                       -- tekla_csv, sds2_export, ifc, manual
  submitted_by    UUID REFERENCES users(user_id),  -- detailer, or import bot
  status          bom_status NOT NULL DEFAULT 'submitted',
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, revision)
);

CREATE TABLE assemblies (
  assembly_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id          UUID NOT NULL REFERENCES detailer_boms(bom_id),
  assembly_mark   TEXT NOT NULL,     -- e.g. "A-3"
  erection_sequence INT,             -- drives shipping/load order
  drawing_ref     TEXT
);

CREATE TABLE bom_lines (
  bom_line_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id          UUID NOT NULL REFERENCES detailer_boms(bom_id),
  assembly_id     UUID REFERENCES assemblies(assembly_id),
  piece_mark      TEXT NOT NULL,      -- e.g. "B12"
  shape           TEXT NOT NULL,      -- e.g. "W12X26"
  grade           TEXT NOT NULL,      -- e.g. "A992"
  length_in       NUMERIC(10,3),
  qty             INT NOT NULL,
  unit_weight_lb  NUMERIC(10,3),      -- theoretical weight per piece (for validation)
  stated_weight_lb NUMERIC(10,3),     -- weight as stated in the BOM export
  spec_notes      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- VALIDATION GATE (runs before a BOM line can generate a material requirement)
-- ============================================================================

CREATE TABLE validation_checks (
  check_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_line_id     UUID NOT NULL REFERENCES bom_lines(bom_line_id),
  check_type      TEXT NOT NULL,   -- spec_compliance, weight_variance, duplicate_mark,
                                    -- mill_length_overrun, stock_netting
  result          validation_result NOT NULL,
  message         TEXT,
  resolved_by     UUID REFERENCES users(user_id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- MATERIAL REQUIREMENTS (post-validation, netted against stock/open POs)
-- ============================================================================

CREATE TABLE material_requirements (
  requirement_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_line_id     UUID NOT NULL REFERENCES bom_lines(bom_line_id),
  job_id          UUID NOT NULL REFERENCES jobs(job_id),
  shape           TEXT NOT NULL,
  grade           TEXT NOT NULL,
  qty_needed_lb   NUMERIC(12,3) NOT NULL,
  qty_netted_lb   NUMERIC(12,3) NOT NULL DEFAULT 0,   -- covered by existing stock/open PO
  qty_to_order_lb NUMERIC(12,3) NOT NULL,
  suggested_vendor_id UUID REFERENCES vendors(vendor_id),
  status          TEXT NOT NULL DEFAULT 'pending',    -- pending, approved, ordered
  approved_by     UUID REFERENCES users(user_id),
  approved_at     TIMESTAMPTZ
);

-- ============================================================================
-- PROCUREMENT
-- ============================================================================

CREATE TABLE purchase_orders (
  po_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number       TEXT UNIQUE NOT NULL,
  vendor_id       UUID NOT NULL REFERENCES vendors(vendor_id),
  status          po_status NOT NULL DEFAULT 'draft',
  issued_by       UUID REFERENCES users(user_id),
  issued_at       TIMESTAMPTZ,
  expected_delivery DATE,
  notes           TEXT
);

CREATE TABLE po_lines (
  po_line_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           UUID NOT NULL REFERENCES purchase_orders(po_id),
  requirement_id  UUID REFERENCES material_requirements(requirement_id),
  job_id          UUID REFERENCES jobs(job_id),   -- NULL = general stock, not job-specific
  shape           TEXT NOT NULL,
  grade           TEXT NOT NULL,
  spec_standard   TEXT,             -- e.g. ASTM A992
  qty_ordered_lb  NUMERIC(12,3) NOT NULL,
  unit_price      NUMERIC(10,4),
  qty_received_lb NUMERIC(12,3) NOT NULL DEFAULT 0,   -- running total, updated by receiving
  line_status     TEXT NOT NULL DEFAULT 'open'         -- open, partial, complete
);

CREATE TABLE inbound_shipments (
  shipment_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           UUID NOT NULL REFERENCES purchase_orders(po_id),
  carrier         TEXT,
  tracking_ref    TEXT,
  eta             DATE,
  status          TEXT NOT NULL DEFAULT 'in_transit',   -- in_transit, arrived, checked_in
  arrived_at      TIMESTAMPTZ
);

-- ============================================================================
-- RECEIVING — THE CRITICAL JOIN: one PO line splits into N heat-numbered lots
-- ============================================================================

CREATE TABLE material_receiving (
  receiving_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id     UUID REFERENCES inbound_shipments(shipment_id),
  po_line_id      UUID NOT NULL REFERENCES po_lines(po_line_id),
  received_by     UUID REFERENCES users(user_id),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT
);

-- Each receiving event can produce multiple lots (one per heat).
-- THIS is the table that must never be collapsed to one-row-per-PO-line.
CREATE TABLE inventory_lots (
  lot_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_id    UUID NOT NULL REFERENCES material_receiving(receiving_id),
  po_line_id      UUID NOT NULL REFERENCES po_lines(po_line_id),
  job_id          UUID REFERENCES jobs(job_id),        -- NULL = general/stock lot
  heat_number     TEXT NOT NULL,
  shape           TEXT NOT NULL,
  grade           TEXT NOT NULL,
  qty_received_lb NUMERIC(12,3) NOT NULL,
  qty_available_lb NUMERIC(12,3) NOT NULL,             -- decremented on consumption
  bin_location    TEXT,
  status          lot_status NOT NULL DEFAULT 'available',
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (po_line_id, heat_number)
);

CREATE TABLE mill_certificates (
  cert_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id          UUID NOT NULL REFERENCES inventory_lots(lot_id),
  heat_number     TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  chemistry_data  JSONB,             -- optional structured parse of MTR chemistry/mechanical props
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bundles (
  bundle_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_tag      TEXT UNIQUE NOT NULL,
  bin_location    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bundles are a PACKAGING layer only — they reference lots, never replace them
CREATE TABLE bundle_items (
  bundle_item_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id       UUID NOT NULL REFERENCES bundles(bundle_id),
  lot_id          UUID NOT NULL REFERENCES inventory_lots(lot_id),
  qty_lb          NUMERIC(12,3) NOT NULL
);

-- ============================================================================
-- RESERVATION (soft lock) vs. ISSUE (hard lock/consumption)
-- ============================================================================

CREATE TABLE material_reservations (
  reservation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id          UUID NOT NULL REFERENCES inventory_lots(lot_id),
  job_id          UUID NOT NULL REFERENCES jobs(job_id),
  bom_line_id     UUID REFERENCES bom_lines(bom_line_id),
  qty_reserved_lb NUMERIC(12,3) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',   -- active, released, consumed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at     TIMESTAMPTZ
);

CREATE TABLE piece_marks (
  piece_mark_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_line_id     UUID NOT NULL REFERENCES bom_lines(bom_line_id),
  job_id          UUID NOT NULL REFERENCES jobs(job_id),
  assembly_id     UUID REFERENCES assemblies(assembly_id),
  piece_mark      TEXT NOT NULL,
  sequence_no     INT NOT NULL DEFAULT 1,      -- distinguishes multiple pieces of same mark, e.g. qty 4
  status          piece_status NOT NULL DEFAULT 'planned',
  qr_tag_code     TEXT UNIQUE,                 -- printed on the physical shop tag
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hard lock: this is the permanent, immutable record tying a physical
-- heat of steel to a physical piece. This table is the backbone of your
-- CMTR package generation at project closeout. Never allow UPDATE on
-- heat_number/lot_id here once written — corrections are a new row + void.
CREATE TABLE material_issues (
  issue_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id          UUID NOT NULL REFERENCES inventory_lots(lot_id),
  piece_mark_id   UUID NOT NULL REFERENCES piece_marks(piece_mark_id),
  heat_number     TEXT NOT NULL,
  qty_consumed_lb NUMERIC(12,3) NOT NULL,
  issued_by       UUID REFERENCES users(user_id),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided          BOOLEAN NOT NULL DEFAULT FALSE,
  void_reason     TEXT
);

-- ============================================================================
-- SHOP FLOOR TRAVELER
-- ============================================================================

CREATE TABLE shop_stations (
  station_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_name    TEXT UNIQUE NOT NULL,   -- Cut, Fit, Weld, QC, Paint, Stage, Ship
  sequence_order  INT NOT NULL
);

CREATE TABLE traveler_events (
  event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_mark_id   UUID NOT NULL REFERENCES piece_marks(piece_mark_id),
  station_id      UUID NOT NULL REFERENCES shop_stations(station_id),
  scanned_by      UUID REFERENCES users(user_id),
  event_type      TEXT NOT NULL,     -- station_in, station_out
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT
);

CREATE TABLE qc_records (
  qc_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_mark_id   UUID NOT NULL REFERENCES piece_marks(piece_mark_id),
  inspection_type TEXT NOT NULL,     -- visual, UT, MT, dimensional
  result          qc_result NOT NULL,
  inspector_id    UUID REFERENCES users(user_id),
  wps_ref         TEXT,              -- welding procedure spec reference
  inspected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  report_file_url TEXT
);

-- ============================================================================
-- SHIPPING & ERECTION
-- ============================================================================

CREATE TABLE shipments (
  shipment_out_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(job_id),
  truck_ref       TEXT,
  planned_date    DATE,
  shipped_at      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'planned'   -- planned, loaded, shipped, delivered
);

CREATE TABLE shipment_items (
  shipment_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_out_id  UUID NOT NULL REFERENCES shipments(shipment_out_id),
  piece_mark_id    UUID NOT NULL REFERENCES piece_marks(piece_mark_id),
  load_sequence    INT     -- matches erection_sequence from assemblies table
);

CREATE TABLE erection_events (
  erection_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_mark_id   UUID NOT NULL REFERENCES piece_marks(piece_mark_id),
  erected_by      TEXT,           -- field crew / GC reference, may not be a system user
  erected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  gps_lat         NUMERIC(9,6),
  gps_lng         NUMERIC(9,6),
  photo_url       TEXT
);

-- ============================================================================
-- INDEXES — the ones that matter for the traceability query path
-- ============================================================================

CREATE INDEX idx_lots_heat_number ON inventory_lots(heat_number);
CREATE INDEX idx_lots_job ON inventory_lots(job_id);
CREATE INDEX idx_lots_shape_grade_status ON inventory_lots(shape, grade, status);
CREATE INDEX idx_issues_piece_mark ON material_issues(piece_mark_id);
CREATE INDEX idx_issues_lot ON material_issues(lot_id);
CREATE INDEX idx_traveler_piece_mark ON traveler_events(piece_mark_id);
CREATE INDEX idx_bom_lines_bom ON bom_lines(bom_id);
CREATE INDEX idx_po_lines_job ON po_lines(job_id);

-- ============================================================================
-- REFERENCE VIEW — the reverse traceability query, pre-built
-- Given a piece_mark_id, walk all the way back to the mill certificate.
-- ============================================================================

CREATE VIEW v_piece_mark_traceability AS
SELECT
  pm.piece_mark_id,
  pm.piece_mark,
  pm.job_id,
  j.job_number,
  mi.heat_number,
  mi.qty_consumed_lb,
  il.lot_id,
  il.bin_location,
  pl.po_line_id,
  po.po_number,
  v.name AS vendor_name,
  mc.file_url AS mill_cert_url
FROM piece_marks pm
JOIN material_issues mi ON mi.piece_mark_id = pm.piece_mark_id AND mi.voided = FALSE
JOIN inventory_lots il ON il.lot_id = mi.lot_id
JOIN po_lines pl ON pl.po_line_id = il.po_line_id
JOIN purchase_orders po ON po.po_id = pl.po_id
JOIN vendors v ON v.vendor_id = po.vendor_id
JOIN jobs j ON j.job_id = pm.job_id
LEFT JOIN mill_certificates mc ON mc.lot_id = il.lot_id AND mc.heat_number = mi.heat_number;
