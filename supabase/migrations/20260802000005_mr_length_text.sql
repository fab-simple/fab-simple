-- ============================================================================
-- material_requirements — sheet-import readiness (Module 1 upload,
-- docs/procurement-material-traceability-spec.md §15.19).
--
-- 1. length moves from numeric(10,3) decimal-inches to free-form text —
--    exact same reasoning as 20260717000001_parts_length_text: KISS/EJE and
--    Tekla/SDS2-style material list exports carry length in mixed
--    feet-inches-fraction formats (e.g. 26'-9 9/16") stored verbatim rather
--    than parsed/converted.
-- 2. New `name` column — the structural member descriptor (e.g. "COLUMN",
--    "CRANE_BEAM"), same role as parts.name. Promoted to its own first-class
--    field rather than folded into `notes`, since it's a primary
--    classification attribute on these sheets, not incidental metadata.
-- ============================================================================

alter table material_requirements alter column length type text using length::text;
alter table material_requirements add column if not exists name text;
