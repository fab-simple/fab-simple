-- parts.length moves from numeric(10,3) decimal-inches to free-form text.
-- Tekla/SDS2 sheets export length in mixed formats (feet-inches "17'-9\"",
-- decimal inches, or millimetres) and the BOM importer no longer parses/
-- converts it — it stores whatever the mapped column contained verbatim.
ALTER TABLE parts ALTER COLUMN length TYPE text USING length::text;
