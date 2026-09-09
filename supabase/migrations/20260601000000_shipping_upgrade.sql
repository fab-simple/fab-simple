-- ─── Shipping Ticket / Bill of Lading Upgrade Migration ──────────────────────
-- Migration: 20260601000000_shipping_upgrade.sql

-- 1. Create shipping enums if not exist
DO $$ BEGIN
  CREATE TYPE shipping_load_status AS ENUM (
    'DRAFT',
    'BUILDING',
    'STAGED',
    'READY_TO_SHIP',
    'IN_TRANSIT',
    'SHIPPED',
    'DELIVERED',
    'PARTIAL_DELIVERED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE shipping_trailer_type AS ENUM (
    'FLATBED',
    'STEP_DECK',
    'LOWBOY',
    'RGN',
    'STRETCH_TRAILER',
    'HOT_SHOT',
    'DRY_VAN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Shipping Carriers Table
CREATE TABLE IF NOT EXISTS shipping_carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  dot_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Shipping Trailers Table
CREATE TABLE IF NOT EXISTS shipping_trailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trailer_number TEXT NOT NULL UNIQUE,
  trailer_type shipping_trailer_type NOT NULL DEFAULT 'FLATBED',
  max_weight_lbs INTEGER NOT NULL DEFAULT 48000,
  deck_length_ft INTEGER DEFAULT 48,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Customer Branding Table
CREATE TABLE IF NOT EXISTS shipping_customer_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  tagline TEXT,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  primary_color TEXT DEFAULT '#0f172a',
  secondary_color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Shipping Loads Table (Replaces basic shipping_tickets if needed or extends)
CREATE TABLE IF NOT EXISTS shipping_loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_name TEXT,
  job_number TEXT,
  status shipping_load_status NOT NULL DEFAULT 'DRAFT',
  
  -- Route & Contact info
  origin_name TEXT NOT NULL DEFAULT 'Main Fabrication Facility',
  origin_address TEXT,
  destination_name TEXT NOT NULL DEFAULT 'Jobsite',
  destination_address TEXT,
  destination_contact TEXT,
  destination_phone TEXT,

  -- Carrier & Driver info
  carrier_id UUID REFERENCES shipping_carriers(id) ON DELETE SET NULL,
  carrier_name TEXT,
  dot_number TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  truck_number TEXT,
  trailer_number TEXT,
  trailer_type shipping_trailer_type DEFAULT 'FLATBED',

  -- Weights
  max_weight_lbs INTEGER NOT NULL DEFAULT 48000,
  gross_weight_lbs INTEGER,
  tare_weight_lbs INTEGER,
  net_weight_lbs INTEGER,

  -- Notes & Timestamps
  bol_notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Signature & Receipt
  signed_by TEXT,
  signed_at TIMESTAMPTZ,
  signature_url TEXT
);

-- 6. Shipping Load Items (Steel Assemblies)
CREATE TABLE IF NOT EXISTS shipping_load_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES shipping_loads(id) ON DELETE CASCADE,
  assembly_id UUID REFERENCES assemblies(id) ON DELETE SET NULL,
  mark TEXT NOT NULL,
  qty_on_load INTEGER NOT NULL CHECK (qty_on_load > 0),
  unit_weight_lbs NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_weight_lbs NUMERIC(10,2) NOT NULL DEFAULT 0,
  main_material TEXT,
  length_ft_in TEXT,
  finish TEXT,
  sequence TEXT,
  drawing_no TEXT,
  bay_location TEXT,
  status shipping_load_status NOT NULL DEFAULT 'DRAFT',
  qc_inspected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Shipping Additional Items (Bolts, Paint, Dunnage)
CREATE TABLE IF NOT EXISTS shipping_additional_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES shipping_loads(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit TEXT NOT NULL DEFAULT 'PCS',
  weight_lbs NUMERIC(10,2) DEFAULT 0,
  category TEXT DEFAULT 'HARDWARE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Shipping Receipts (Delivery proof)
CREATE TABLE IF NOT EXISTS shipping_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES shipping_loads(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'COMPLETE',
  damage_reported BOOLEAN NOT NULL DEFAULT false,
  signature_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Shipping Audit Logs
CREATE TABLE IF NOT EXISTS shipping_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES shipping_loads(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_name TEXT NOT NULL,
  details TEXT
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_shipping_loads_project ON shipping_loads(project_id);
CREATE INDEX IF NOT EXISTS idx_shipping_loads_status ON shipping_loads(status);
CREATE INDEX IF NOT EXISTS idx_shipping_load_items_load ON shipping_load_items(load_id);
CREATE INDEX IF NOT EXISTS idx_shipping_additional_items_load ON shipping_additional_items(load_id);
