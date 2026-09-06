// Receive-with-heat-splits — atomic endpoint that creates the receiving record
// AND the bundle+lot rows for every heat number in one server transaction.
// Spec: fabsimple_api_spec.md §6, migration 20260818000001.
//
//   POST /receivings/with-heat-splits
//
// This replaces the 2-step flow:
//   1. POST /receivings           (creates receiving)
//   2. POST /bundles/:id/assign-heat  (per-bundle heat assignment)
//
// Both steps still work independently (no regression) — this is additive.
// The client may choose either path. The new path is strictly preferred
// because it keeps the receiving + lot creation in one DB transaction,
// eliminating the orphaned-receiving-without-lots failure mode.

import { z } from "https://esm.sh/zod@3.23.8";
import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { sanitize } from "../lib/sanitize.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

// Same as receivings.insertable
const ALLOWED_ROLES = ["owner", "pm", "foreman"];

const HeatSplitSchema = z.object({
  heat_number_id: z.string().uuid(),
  profile:        z.string().min(1).max(80),
  grade:          z.string().min(1).max(40),
  quantity:       z.coerce.number().positive(),
  length:         z.coerce.number().positive().optional(),
  location:       z.string().max(120).optional(),
});

const ReceiveWithSplitsSchema = z.object({
  po_id:         z.string().uuid(),
  shipment_id:   z.string().uuid().optional(),   // links to inbound_shipments
  qty_received:  z.coerce.number().positive(),
  exceptions:    z.string().max(1000).optional(),
  // splits may be empty — caller can still use the old 2-step path
  splits: z.array(HeatSplitSchema).max(50).default([]),
});

/** POST /receivings/with-heat-splits */
export async function receiveWithHeatSplits(ctx: Ctx): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const parsed = ReceiveWithSplitsSchema.safeParse(sanitize(raw));
  if (!parsed.success) return err("Validation failed", 422, "validation");
  const body = parsed.data;

  // ── Validate PO access ───────────────────────────────────────────────────
  const { data: po, error: poErr } = await ctx.sb
    .from("purchase_orders")
    .select("id, po_number, vendor, vendor_id, status")
    .eq("id", body.po_id)
    .maybeSingle();
  if (poErr) return err(poErr.message, 400, "db_error");
  if (!po)   return err("Purchase order not found", 404, "not_found");
  if (!["issued", "partial"].includes(po.status)) {
    return err(`PO is ${po.status} — only issued or partial POs can receive material`, 409, "invalid_po_status");
  }

  // ── Validate all heat_number_ids before starting the RPC ─────────────────
  if (body.splits.length > 0) {
    const heatIds = body.splits.map((s) => s.heat_number_id);
    const { data: heats, error: heatsErr } = await ctx.sb
      .from("heat_numbers")
      .select("id, heat_number, status")
      .in("id", heatIds);
    if (heatsErr) return err(heatsErr.message, 400, "db_error");

    const foundIds = new Set((heats ?? []).map((h) => h.id));
    const missingId = heatIds.find((id) => !foundIds.has(id));
    if (missingId) {
      return err(`Heat number ${missingId} not found`, 404, "not_found");
    }
  }

  // ── Call the compound atomic RPC ─────────────────────────────────────────
  // fn_receive_with_heat_splits runs inside a single PG transaction, so:
  //   receiving INSERT → bundle INSERTs → lot INSERTs
  // all commit or all roll back together.
  const splitsJson = body.splits.map((s) => ({
    heat_number_id: s.heat_number_id,
    profile:        s.profile,
    grade:          s.grade,
    quantity:       s.quantity,
    length:         s.length ?? null,
    location:       s.location ?? null,
  }));

  const { data: receivingId, error: rpcErr } = await ctx.sbAdmin.rpc(
    "fn_receive_with_heat_splits",
    {
      p_company_id:   ctx.user.company_id,
      p_po_id:        body.po_id,
      p_shipment_id:  body.shipment_id ?? null,
      p_received_by:  ctx.user.id,
      p_qty_received: body.qty_received,
      p_exceptions:   body.exceptions ?? null,
      p_splits:       JSON.stringify(splitsJson),
    },
  );
  if (rpcErr) return err(rpcErr.message, 400, "rpc_error");

  // ── Fetch the created receiving + its lots for the response ──────────────
  const { data: receiving } = await ctx.sb
    .from("receivings")
    .select("*")
    .eq("id", receivingId as string)
    .maybeSingle();

  // Fetch lots created during this receiving (via bundles linkage)
  const { data: lots } = await ctx.sb
    .from("material_lots")
    .select("id, lot_number, profile, grade, quantity, location, status, heat_number_id")
    .in(
      "bundle_id",
      // bundle IDs that belong to this receiving
      (await ctx.sb
        .from("bundles")
        .select("id")
        .eq("receiving_id", receivingId as string)
        .then((r) => (r.data ?? []).map((b) => b.id))),
    );

  await writeAudit(ctx, {
    action: "rpc",
    table_name: "receivings",
    record_id: receivingId as string,
    new_values: {
      po_id:         body.po_id,
      qty_received:  body.qty_received,
      splits_count:  body.splits.length,
    },
  });
  await writeActivity(ctx, {
    action: `received ${body.qty_received} units on ${po.po_number} with ${body.splits.length} heat split(s)`,
    entity_type:  "receivings",
    entity_id:    receivingId as string,
    entity_label: receiving?.receiving_number as string ?? "",
    metadata: {
      po_number:    po.po_number,
      qty_received: body.qty_received,
      splits_count: body.splits.length,
      lots_created: (lots ?? []).length,
    },
  });

  return ok({
    receiving,
    lots_created: lots ?? [],
    splits_count: body.splits.length,
  });
}
