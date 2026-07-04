-- Add an 'ordered' value to the shared part_status enum.
--
-- Used by the "Create PO from not-started parts" flow: when a purchase order is
-- generated for a project's not_started parts, those parts move not_started ->
-- ordered so they drop out of the procurement pool and can't be re-ordered.
--
-- ADD VALUE IF NOT EXISTS is idempotent and (PG12+) safe inside the migration
-- transaction because the new value is not *used* in this same transaction.
-- Positioned right after 'not_started' to keep the lifecycle order readable.
alter type part_status add value if not exists 'ordered' after 'not_started';
