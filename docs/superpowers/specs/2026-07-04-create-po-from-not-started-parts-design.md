# Design: Create Purchase Order from not-started parts

**Date:** 2026-07-04
**Status:** Approved (design), pending implementation plan

## Problem

Procurement users need to turn a project's un-started fabrication parts into a
purchase order without re-keying material. Today a PO is created from a blank
form on the Purchase Orders page (`app/(dashboard)/dashboard/purchase-orders/page.tsx`),
with no link to the parts that drive the material demand.

## Goal

On the **Parts** page, add a **"Create PO"** action that, for the currently
selected project, aggregates all `not_started` parts by material and creates a
new **draft** purchase order, then marks those parts as `ordered`.

## Non-goals

- No costing/pricing engine. Parts carry no unit cost; `total_amount` stays an
  optional manual field.
- No separate PO line-item table. Line items live in the existing
  `purchase_orders.items` JSON column (denormalized, matching current model).
- No PO issuing/receiving workflow changes. The PO is created as `draft`; the
  existing PO page handles issuing/receiving.
- No multi-project POs. One PO targets exactly one project.

## User flow

```
[Top bar: Project = KEYSTONE-11B]
Parts page -> click "Create PO from not-started"
  -> Modal:
      - Project: KEYSTONE-11B (read-only)
      - Preview: not_started parts aggregated by profile + grade
        (e.g. W14x82 / A992 - 12 pcs - 24,108 lb)
      - Vendor*        [__________]
      - Expected date  [____]
      - Total amount ($) [____]  (optional)
      - Notes          [____]
  -> Confirm -> PO created (status: draft) + those parts flip to "ordered"
  -> toast "PO-0007 created from 152 parts"; parts list refetches
```

### Visibility & guards

- Button renders only for roles in `purchase_orders.insertable`: **owner / pm /
  accounting** (checked client-side via `getRole()`; enforced again server-side).
- Disabled when no specific project is selected ("All projects") with tooltip
  "Select a project first."
- If the selected project has zero `not_started` parts, the modal shows an empty
  state and Confirm is disabled.

## Architecture

### Backend — single transactional endpoint (chosen approach)

Doing this client-side (fetch parts -> create PO -> bulk-update statuses) means
multiple round-trips, no atomicity, and re-introduces the Edge Function
resource-limit (HTTP 546) risk seen with large CSV imports. Instead, add one
server endpoint that does the whole operation in a single, bounded pass.

**`POST /purchase-orders/from-parts`** — new controller
`supabase/functions/api/controllers/purchaseOrder.ts`, routed in
`supabase/functions/api/index.ts` **before** the generic `/{table}/{id}` route.

Request body:

```ts
interface CreatePoFromPartsBody {
  project_id: string;      // required, must belong to caller's company
  vendor: string;          // required, 1..200 chars
  expected_date?: string;  // optional ISO date
  total_amount?: number;   // optional, >= 0, default 0
  notes?: string;          // optional, <= 2000 chars
}
```

Server steps:

1. Role check (`owner | pm | accounting`) -> `403 forbidden` otherwise.
2. Validate body via a zod schema (`getInsertSchema`-style) -> `422 validation`.
3. Verify project belongs to caller's company via RLS-scoped `ctx.sb`
   -> `404 not_found` otherwise.
4. Fetch `not_started` parts for the project, selecting only
   `id, profile, grade, weight, quantity` (small payload, fast).
5. If zero parts -> `422 no_parts` ("No not-started parts to order").
6. Aggregate in JS by `profile + grade` (see Data shapes).
7. Generate `po_number` via the existing `next_sequence_number` RPC
   (prefix `PO`), matching the generic create path.
8. Insert the PO via `ctx.sb` (RLS-safe): `company_id`, `project_id`, `vendor`,
   `items` (aggregated array), `qty_ordered` (total pieces), `total_amount`,
   `status: 'draft'`, `expected_date`, `notes`.
9. One statement: `UPDATE parts SET status='ordered' WHERE project_id = ? AND
   status = 'not_started'` (no per-row loop).
10. `writeAudit` (action `create_po_from_parts`) + `writeActivity`.
11. Return `{ purchase_order, summary: { parts_ordered, line_items, total_weight_lb } }`.

**Accepted edge case:** a part inserted between steps 4 and 9 could be flipped to
`ordered` without appearing in `items`. Rare; bounded by the `status='not_started'`
filter. Documented, not guarded.

### Client

- `lib/api.ts`: `FabAPI.createPoFromParts(body): Promise<CreatePoFromPartsResult>`.
- `hooks/useResource.ts` (or a small dedicated hook): `useCreatePoFromParts()`
  mutation that invalidates the `parts` and `purchase_orders` query keys on success.
- Parts page (`app/(dashboard)/dashboard/parts/page.tsx`):
  - "Create PO" button (role- and project-guarded).
  - `CreatePoModal` component. Preview aggregation is computed **client-side**
    for display by fetching `not_started` parts via the existing `listAll` helper
    (`FabAPI.listAll("parts", { status: "not_started", project_id })`); the server
    remains the source of truth for the actual PO contents.

### Data shapes

`purchase_orders.items[]` (existing JSON column, no schema change):

```jsonc
items: [
  { "profile": "W14x82",     "grade": "A992",   "qty": 12, "piece_count": 12, "total_weight_lb": 24108 },
  { "profile": "HSS6x6x3/8", "grade": "A500-C", "qty": 40, "piece_count": 40, "total_weight_lb": 21600 }
]
```

Aggregation rule (per `profile + grade` group; `grade` null -> grouped as
`"(no grade)"`, stored as null):

- `qty` = sum of `quantity`
- `piece_count` = sum of `quantity` (alias kept for clarity in UI)
- `total_weight_lb` = sum of `weight * quantity`, treating null `weight` as 0

PO-level: `qty_ordered` = total pieces across all groups.

### New `ordered` part status (app-wide change)

`part_status` is a Postgres enum shared by `parts` and referenced in other tables
(`supabase/migrations/20260524000001_schema.sql:15`). Touch points:

1. **Migration** (new file): `ALTER TYPE part_status ADD VALUE IF NOT EXISTS
   'ordered' AFTER 'not_started';`
2. **Edge function** `schemas/validation.ts`: add `'ordered'` to the parts
   status enum (insert and update schemas).
3. **Frontend**:
   - `STATUS_OPTIONS` in `app/(dashboard)/dashboard/parts/page.tsx` (status
     filter + edit modal).
   - `statusToClass` in `lib/utils.ts`: add `ordered: "pill-blue"` (else it
     falls back to neutral `pill-ns`).
4. **Audit during implementation**: grep worker views
   (`app/worker/parts/**`) and dashboard status groupings
   (`controllers/dashboard.ts`) for hard-coded status lists that should include
   `ordered`.

## Error handling

| Condition | Behavior |
|-----------|----------|
| No project selected | Button disabled (client guard) |
| No `not_started` parts | `422 no_parts`; modal empty state, Confirm disabled |
| Vendor empty | Client `required` + server zod `422` |
| Forbidden role | Button hidden; server `403` |
| PO insert / parts update fails | Mutation error surfaced in modal |

## Testing

- **Aggregation unit test**: mixed profiles/grades/quantities -> correct grouped
  `qty` and `total_weight_lb`; null `weight` treated as 0; null `grade` grouped.
- **Endpoint**: creates PO with correct `po_number`; flips exactly the
  `not_started` parts to `ordered`, leaves others untouched; empty set -> 422;
  wrong role -> 403; cross-company project -> 404.
- **UI**: button visibility by role; disabled with no project; preview matches
  aggregation; success triggers parts refetch and toast.

## Deployment

Ships DB + edge-function changes, not just frontend:

1. `supabase db push` (enum migration) against the remote project.
2. `supabase functions deploy api` (validation + new controller).
3. Frontend deploy (Vercel).

Order: DB migration first, then edge function, then frontend.

## Open questions

None. Design approved 2026-07-04: PO is created as `draft`; `total_amount` is an
optional manual field.
