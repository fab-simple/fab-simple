-- ----------------------------------------------------------------------------
-- Align inventory table with parts table: add `name` column and convert
-- `length` from numeric(10,3) to free-form text.
--
-- Reasoning:
--   1. `name` — same structural-member descriptor as parts.name (e.g.
--      "W-BEAM", "HSS-COLUMN", "BRACE"). Gives bulk stock a human-readable
--      label beyond the raw profile string.
--   2. `length` — same reasoning as 20260717000001_parts_length_text: KISS/EJE
--      and Tekla sheets export length in mixed feet-inches-fraction formats
--      (e.g. 26'-9 9/16"). Storing as text avoids lossy conversions and keeps
--      the inventory table consistent with how parts and material_requirements
--      already handle length.
-- ----------------------------------------------------------------------------

-- Add name column (nullable, same as parts.name)
alter table inventory
  add column if not exists name text;

comment on column inventory.name is
  'Structural member name/label (e.g. W-BEAM, HSS-COLUMN, BRACE). '
  'Same role as parts.name — a human-readable descriptor beyond the raw profile.';

-- Convert length from numeric to text (same as parts table)
alter table inventory
  alter column length type text using length::text;

comment on column inventory.length is
  'Free-form length as entered or imported (e.g. 17''-9", 240.5). '
  'Stored as text to avoid lossy conversion of mixed-format inputs, '
  'matching the parts table convention.';
