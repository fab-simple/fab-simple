-- ----------------------------------------------------------------------------
-- Add `name` column to parts table.
--
-- Tekla Structures exports a "Name" field that holds a structural-member
-- descriptor (e.g. "W-BEAM", "HSS-COLUMN", "BRACE").  Previously this was
-- crammed into `assembly_mark` as a fallback, which was semantically wrong —
-- assembly_mark identifies the parent assembly, name is the member type/label.
-- This migration gives Name its own first-class column so both values can be
-- stored independently after import.
-- ----------------------------------------------------------------------------

alter table parts
  add column if not exists name text;

comment on column parts.name is
  'Structural member name/label as exported from Tekla/SDS2 (e.g. W-BEAM, HSS-COLUMN, BRACE). '
  'Distinct from assembly_mark which identifies the parent fabrication assembly.';
