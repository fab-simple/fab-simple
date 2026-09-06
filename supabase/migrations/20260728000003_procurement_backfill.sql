-- ============================================================================
-- FabSimple — Procurement & Material Traceability, Phase 1 — backfill
-- Links existing free-text purchase_orders.vendor strings to the new
-- vendors master table. Exact match only (per §13 — no fuzzy matching);
-- anything that doesn't match exactly stays as free text for manual cleanup.
-- ============================================================================

-- One vendor row per distinct (company_id, vendor) pair seen historically.
insert into vendors (company_id, name)
select distinct po.company_id, po.vendor
from purchase_orders po
where po.vendor is not null and length(trim(po.vendor)) > 0
on conflict (company_id, name) do nothing;

-- Link every PO whose free-text vendor exactly matches a vendor name in the
-- same company.
update purchase_orders po
set vendor_id = v.id
from vendors v
where v.company_id = po.company_id
  and v.name = po.vendor
  and po.vendor_id is null;

-- heat_numbers.status keeps its column default ('available') for all
-- pre-existing rows — no historical receiving/MTR trail exists to judge
-- quarantine status retroactively, and defaulting to available is the safe
-- choice (it doesn't retroactively block fabrication on existing demo/prod
-- data that was never subject to this rule).
