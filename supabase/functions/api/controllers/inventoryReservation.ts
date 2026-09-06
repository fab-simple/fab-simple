// Inventory Reservations — manual release + fulfill-from-stock endpoints.
//
// inventory_reservations are created automatically inside fn_create_rfq and
// released automatically when an RFQ is awarded (fn_award_vendor_quote) or
// cancelled (rfq_release_inventory_on_cancel trigger). Two additional manual
// flows are handled here:
//
//   POST /inventory-reservations/:id/release
//       Exceptional release when a PM needs to release a reservation manually
//       (e.g. an RFQ was abandoned but not formally cancelled yet).
//
//   POST /inventory-reservations/fulfill-from-stock
//       Mark a Material Requirement as fulfilled from existing bulk stock
//       without raising an RFQ. Creates the inventory_reservation row via
//       sbAdmin (service-role) — the same privilege level used by fn_create_rfq
//       — and updates the MR status to "fulfilled" in the same request so the
//       two writes are effectively atomic from the caller's perspective.
//       The generic POST /inventory_reservations is intentionally blocked
//       (insertable: [] in permissions.ts) because bare generic inserts would
//       skip the availability check; this endpoint does it explicitly.

import { z } from "https://esm.sh/zod@3.23.8";
import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

const ALLOWED_ROLES = ["owner", "pm", "accounting"];

/** POST /inventory-reservations/:id/release */
export async function releaseInventoryReservation(
  ctx: Ctx,
  reservationId: string,
): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  const { data: reservation, error: findErr } = await ctx.sb
    .from("inventory_reservations")
    .select("id, status, inventory_id, quantity")
    .eq("id", reservationId)
    .maybeSingle();

  if (findErr) return err(findErr.message, 400, "db_error");
  if (!reservation) return err("Reservation not found", 404, "not_found");
  if (reservation.status !== "active") {
    return err("Reservation is not active", 409, "not_active");
  }

  const { data: updated, error: updErr } = await ctx.sb
    .from("inventory_reservations")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("id", reservationId)
    .select()
    .single();

  if (updErr) return err(updErr.message, 400, "db_error");

  await writeAudit(ctx, {
    action: "update",
    table_name: "inventory_reservations",
    record_id: reservationId,
    old_values: reservation,
    new_values: updated,
  });
  await writeActivity(ctx, {
    action: `manually released an inventory reservation of ${reservation.quantity} units back to available stock`,
    entity_type: "inventory_reservations",
    entity_id: reservationId,
  });

  return ok({ reservation: updated });
}

// ---------------------------------------------------------------------------
// POST /inventory-reservations/fulfill-from-stock
//
// Marks a Material Requirement as fulfilled from existing bulk inventory stock
// without raising an RFQ. Steps (in order, fail-fast):
//   1. Verify the inventory row exists and has sufficient unreserved stock.
//   2. Write the inventory_reservation row via sbAdmin (service-role) —
//      same privilege as fn_create_rfq so it bypasses the intentionally
//      read-only RLS on this table.
//   3. Update the MR status to "fulfilled" via the user-scoped client
//      (so RLS confirms the MR belongs to the caller's company).
// ---------------------------------------------------------------------------

const FulfillFromStockSchema = z.object({
  material_requirement_id: z.string().uuid(),
  inventory_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  project_id: z.string().uuid(),
});

/** POST /inventory-reservations/fulfill-from-stock */
export async function fulfillMrFromStock(ctx: Ctx): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const parsed = FulfillFromStockSchema.safeParse(raw);
  if (!parsed.success) return err("Validation failed", 422, "validation");
  const { material_requirement_id, inventory_id, quantity, project_id } = parsed.data;

  // ── 1. Availability check ────────────────────────────────────────────────
  // Read the inventory row + sum of active reservations to get truly available.
  const { data: inv, error: invErr } = await ctx.sb
    .from("inventory")
    .select("id, quantity, profile, name, grade")
    .eq("id", inventory_id)
    .maybeSingle();
  if (invErr) return err(invErr.message, 400, "db_error");
  if (!inv) return err("Inventory item not found", 404, "not_found");

  const { data: reservations, error: resErr } = await ctx.sb
    .from("inventory_reservations")
    .select("quantity")
    .eq("inventory_id", inventory_id)
    .eq("status", "active");
  if (resErr) return err(resErr.message, 400, "db_error");

  const totalReserved = (reservations ?? []).reduce((s, r) => s + Number(r.quantity), 0);
  const available = Number(inv.quantity) - totalReserved;
  if (available < quantity) {
    return err(
      `Insufficient stock: ${available} available, ${quantity} requested`,
      409,
      "insufficient_stock",
    );
  }

  // ── 2. Write the inventory reservation (service-role — same as fn_create_rfq) ──
  const { data: reservation, error: createErr } = await ctx.sbAdmin
    .from("inventory_reservations")
    .insert({
      company_id: ctx.user.company_id,
      inventory_id,
      project_id,
      rfq_id: null,
      quantity,
      status: "active",
      reserved_by: ctx.user.id,
      reserved_at: new Date().toISOString(),
      notes: `Fulfilled from stock — MR ${material_requirement_id}`,
    })
    .select()
    .single();
  if (createErr) return err(createErr.message, 400, "db_error");

  // ── 3. Update MR status (user-scoped — RLS confirms company ownership) ──
  const { error: mrErr } = await ctx.sb
    .from("material_requirements")
    .update({ status: "fulfilled" })
    .eq("id", material_requirement_id);
  if (mrErr) {
    // Reservation created but MR update failed — best-effort rollback.
    await ctx.sbAdmin.from("inventory_reservations").delete().eq("id", reservation.id);
    return err(`MR update failed: ${mrErr.message}`, 400, "db_error");
  }

  await writeAudit(ctx, {
    action: "insert",
    table_name: "inventory_reservations",
    record_id: reservation.id,
    new_values: reservation,
  });
  await writeActivity(ctx, {
    action: `fulfilled MR from stock — reserved ${quantity} units of ${inv.profile}${inv.name ? " " + inv.name : ""}${inv.grade ? " " + inv.grade : ""}`,
    entity_type: "inventory_reservations",
    entity_id: reservation.id,
  });

  return ok({ reservation });
}
