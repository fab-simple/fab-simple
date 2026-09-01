# FabSimple v5 — API Specification

Companion to `fabsimple_schema.sql`. REST/JSON conventions. Auth (bearer token, role-based) assumed on every endpoint — omitted below for brevity. All list endpoints support `?job_id=`, `?page=`, `?limit=`.

---

## 1. Jobs

| Method | Path | Purpose |
|---|---|---|
| POST | `/jobs` | Create job on award |
| GET | `/jobs/:job_id` | Job detail incl. status, tonnage, dates |
| PATCH | `/jobs/:job_id/status` | Advance job status |
| GET | `/jobs/:job_id/dashboard` | Single-pane pipeline summary (see §9) |

**POST /jobs** request:
```json
{
  "job_number": "4471",
  "project_name": "Westside Distribution Center",
  "client_name": "ABC Developers",
  "eor_name": "Smith Engineering",
  "contract_tonnage": 340.5,
  "target_ship_date": "2026-11-01"
}
```

---

## 2. Detailer BOM Intake

| Method | Path | Purpose |
|---|---|---|
| POST | `/jobs/:job_id/boms` | Upload new BOM revision (file or manual) |
| POST | `/jobs/:job_id/boms/import` | Import parsed Tekla/SDS2/IFC export |
| GET | `/jobs/:job_id/boms` | List all revisions |
| GET | `/boms/:bom_id/diff/:previous_bom_id` | Diff two revisions — added/removed/changed lines |
| GET | `/boms/:bom_id/lines` | List BOM lines for a revision |

**POST /jobs/:job_id/boms/import** — multipart file upload. Response includes parsed line count and any parse warnings before validation even runs:
```json
{
  "bom_id": "uuid",
  "revision": 1,
  "lines_parsed": 214,
  "parse_warnings": []
}
```

---

## 3. Validation

| Method | Path | Purpose |
|---|---|---|
| POST | `/boms/:bom_id/validate` | Run all validation checks against every line |
| GET | `/boms/:bom_id/validation-results` | Return pass/fail/warning per line |
| POST | `/validation-checks/:check_id/override` | PM manually clears a warning/fail with a reason |

**GET /boms/:bom_id/validation-results** response:
```json
{
  "bom_id": "uuid",
  "overall_status": "validated",
  "checks": [
    {
      "bom_line_id": "uuid",
      "piece_mark": "B12",
      "check_type": "weight_variance",
      "result": "pass"
    },
    {
      "bom_line_id": "uuid",
      "piece_mark": "PL9",
      "check_type": "mill_length_overrun",
      "result": "warning",
      "message": "Length 68'-0\" exceeds standard 60' mill length — splice required"
    }
  ]
}
```

A BOM cannot generate material requirements while any line has `result: fail` and no override on record.

---

## 4. Material Requirements

| Method | Path | Purpose |
|---|---|---|
| POST | `/boms/:bom_id/generate-requirements` | Net validated BOM against stock/open POs, produce requirement rows |
| GET | `/jobs/:job_id/requirements` | List requirements for a job |
| POST | `/requirements/:requirement_id/approve` | PM approves — feeds PO generation |

**POST /boms/:bom_id/generate-requirements** response — this is the "PM opens FabSimple and sees it already populated" screen:
```json
{
  "requirements": [
    {
      "requirement_id": "uuid",
      "shape": "W12X26",
      "grade": "A992",
      "qty_needed_lb": 40000,
      "qty_netted_lb": 8000,
      "qty_to_order_lb": 32000,
      "suggested_vendor_id": "uuid",
      "netted_from": [{"lot_id": "uuid", "heat_number": "A1120099", "job_id": null}]
    }
  ]
}
```

---

## 5. Procurement

| Method | Path | Purpose |
|---|---|---|
| POST | `/purchase-orders` | Create PO (can bundle requirements from multiple jobs by vendor) |
| POST | `/purchase-orders/:po_id/issue` | Lock and send PO to vendor |
| GET | `/purchase-orders/:po_id` | PO detail with line status |
| POST | `/purchase-orders/:po_id/lines/:po_line_id/shipments` | Log an inbound shipment against a line |

**POST /purchase-orders** request — note `requirement_ids` can span jobs, this is real MRP batching:
```json
{
  "vendor_id": "uuid",
  "requirement_ids": ["uuid-job-4471-line3", "uuid-job-4502-line1"],
  "expected_delivery": "2026-09-10"
}
```

---

## 6. Receiving — the critical join

| Method | Path | Purpose |
|---|---|---|
| POST | `/po-lines/:po_line_id/receive` | Log receiving event, **accepts array of heat splits** |
| POST | `/inventory-lots/:lot_id/mill-cert` | Attach mill cert file to a specific heat |
| GET | `/po-lines/:po_line_id/receiving-status` | Ordered vs received vs remaining |

**POST /po-lines/:po_line_id/receive** — this is the endpoint that implements the heat-split. The request body is an array, not a single object, on purpose:
```json
{
  "shipment_id": "uuid",
  "received_by": "uuid",
  "heat_splits": [
    { "heat_number": "A1123456", "qty_received_lb": 22000, "bin_location": "Yard-B4" },
    { "heat_number": "A1123890", "qty_received_lb": 12500, "bin_location": "Yard-B4" },
    { "heat_number": "A1124017", "qty_received_lb": 5500,  "bin_location": "Yard-B4" }
  ]
}
```
Response: creates one `inventory_lots` row per split, updates `po_lines.qty_received_lb`, sets `line_status` to `partial` or `complete` based on sum vs ordered qty.

---

## 7. Inventory & Reservation

| Method | Path | Purpose |
|---|---|---|
| GET | `/inventory/lots?shape=&grade=&job_id=&status=` | Search available/reserved lots |
| POST | `/inventory/lots/:lot_id/reserve` | Soft-reserve qty for a job |
| POST | `/reservations/:reservation_id/release` | Release a soft reservation |
| GET | `/bundles/:bundle_id` | Bundle contents (references lots, doesn't own material) |

**GET /inventory/lots?shape=W12X26&grade=A992** response drives the "Job Pull" screen — this is the query that must return multiple heat options when they exist:
```json
{
  "lots": [
    { "lot_id": "uuid", "heat_number": "A1123456", "qty_available_lb": 22000, "job_id": null, "bin_location": "Yard-B4" },
    { "lot_id": "uuid", "heat_number": "A1123890", "qty_available_lb": 12500, "job_id": null, "bin_location": "Yard-B4" }
  ]
}
```

---

## 8. Job Pull / Material Issue — the hard lock

| Method | Path | Purpose |
|---|---|---|
| POST | `/piece-marks/:piece_mark_id/issue-material` | Consume a specific heat against a piece mark |
| POST | `/material-issues/:issue_id/void` | Correct a mis-issue — writes a void, never deletes |
| GET | `/piece-marks/:piece_mark_id/traceability` | Full reverse chain — piece mark → mill cert |

**POST /piece-marks/:piece_mark_id/issue-material** request:
```json
{
  "lot_id": "uuid",
  "heat_number": "A1123456",
  "qty_consumed_lb": 620,
  "issued_by": "uuid"
}
```
Server-side: decrements `inventory_lots.qty_available_lb`, sets `piece_marks.status = 'material_locked'`, writes immutable `material_issues` row.

**GET /piece-marks/:piece_mark_id/traceability** — backed directly by `v_piece_mark_traceability` view:
```json
{
  "piece_mark": "B12",
  "job_number": "4471",
  "heat_number": "A1123456",
  "lot_id": "uuid",
  "po_number": "4471-A",
  "vendor_name": "Gulf Coast Steel Supply",
  "mill_cert_url": "https://.../MTR-A1123456.pdf"
}
```

---

## 9. Shop Floor Traveler (scan-based)

| Method | Path | Purpose |
|---|---|---|
| POST | `/traveler/scan` | Single endpoint for all station scans (cut/fit/weld/QC/paint/stage) |
| GET | `/piece-marks/:piece_mark_id/traveler` | Full station history for a piece |
| POST | `/piece-marks/:piece_mark_id/qc` | Log QC/NDT result |

**POST /traveler/scan** — designed for a tablet/handheld scanning a QR tag, minimal payload:
```json
{
  "qr_tag_code": "PM-4471-B12-1",
  "station_name": "Weld",
  "event_type": "station_in",
  "scanned_by": "uuid"
}
```

---

## 10. Shipping & Erection

| Method | Path | Purpose |
|---|---|---|
| POST | `/jobs/:job_id/shipments` | Create outbound shipment, ordered by erection sequence |
| POST | `/shipments/:shipment_out_id/load` | Add piece marks to a load |
| POST | `/piece-marks/:piece_mark_id/erect` | Field confirms erection (mobile, optionally GPS + photo) |

---

## 11. Dashboard (PM single-pane view)

| Method | Path | Purpose |
|---|---|---|
| GET | `/jobs/:job_id/dashboard` | Pipeline status rollup |

```json
{
  "job_number": "4471",
  "status": "in_production",
  "pieces_total": 214,
  "pieces_by_status": {
    "material_locked": 40, "cut": 90, "welded": 52, "qc_passed": 48,
    "shipped": 20, "erected": 12
  },
  "tonnage_shipped": 41.2,
  "tonnage_contract": 340.5
}
```

This endpoint is a read-optimized rollup — implement as a materialized view or cached aggregate, not a live join across every table, or it will get slow once a job has thousands of piece marks.
