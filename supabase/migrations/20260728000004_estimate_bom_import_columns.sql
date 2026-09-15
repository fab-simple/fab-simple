-- Migration: Add additional_costs, import_summary, building_sqft columns to estimates table

ALTER TABLE estimates 
  ADD COLUMN IF NOT EXISTS additional_costs jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS import_summary jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS building_sqft numeric;

COMMENT ON COLUMN estimates.additional_costs IS 'Array of additional cost items (hardware, subbed erection/detailing, crane, tax, bond)';
COMMENT ON COLUMN estimates.import_summary IS 'Metadata summary when estimate is populated from CAD/BOM file import (KISS, EJE, CSV, XLSX)';
COMMENT ON COLUMN estimates.building_sqft IS 'Building square footage for calculating $/SF metric';
