// Inventory Reservations — manual release endpoint.
//
// inventory_reservations are created automatically inside fn_create_rfq and
// released automatically when an RFQ is awarded (fn_award_vendor_quote) or
// cancelled (rfq_release_inventory_on_cancel trigger). This controller exists
// for exceptional cases where a PM needs to release a reservation manually
// (e.g. an RFQ was abandoned but not formally cancelled yet).
//
//   POST /inventory-reservations/:id/release  → release one active reservation

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
