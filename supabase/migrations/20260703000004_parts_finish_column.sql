-- ----------------------------------------------------------------------------
-- Add `finish` column to parts table.
--
-- Shop finish specification from Bill of Materials (BOM) in shop drawings
-- (e.g. "SHOP PRIMER", "GALVANIZED", "PAINT", "NO PAINT").
-- ----------------------------------------------------------------------------

alter table parts
  add column if not exists finish text;

comment on column parts.finish is
  'Shop finish specification from BOM (e.g. SHOP PRIMER, GALVANIZED, PAINT, NO PAINT).';
