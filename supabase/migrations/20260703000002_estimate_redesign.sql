-- Migration: estimate_redesign
-- Rebuilds Estimating module + Award-to-Project flow support

-- 1. Alter projects to make number nullable (blank Job Number upon initial award)
ALTER TABLE projects ALTER COLUMN number DROP NOT NULL;

-- 2. Add detailed estimating columns to estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS architect_eor text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS project_location text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS bid_type text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS drawing_set_ref text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS unique_piece_marks integer;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS connection_complexity text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS detailing_hours numeric(12,2);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS fabrication_hours numeric(12,2);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS erection_hours numeric(12,2);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS labor_rate numeric(12,2) default 75.00;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS freight_mill_to_shop numeric(12,2);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS freight_shop_to_site numeric(12,2);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS paint_coating_required boolean default false;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS coating_type text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS coating_pricing_method text; -- 'per_ton' | 'lump_sum'
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS coating_price_per_ton numeric(12,2);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS coating_lump_sum numeric(12,2);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS contingency_pct numeric(5,2) default 0.00;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS exclusions_qualifications text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS materials_breakdown jsonb default '[]'::jsonb;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS alternates jsonb default '[]'::jsonb;

-- 3. Add baseline/handover columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS architect_eor text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_location text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS unique_piece_marks integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS baseline_budget jsonb default '{}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS drawing_set_ref text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS exclusions_qualifications text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimate_id uuid references estimates(id) on delete set null;

-- 4. Add company default template column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_exclusions_qualifications text;
