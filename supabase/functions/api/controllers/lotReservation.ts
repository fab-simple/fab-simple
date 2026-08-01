// Lot reservations (Module 12: Production Allocation — "Reserve Lot" / "Release
// Lot"). Spec: docs/procurement-material-traceability-spec.md §16.
//
// Material lots are company-wide inventory with no project of their own. A
// project only ever holds a partial, releasable *claim* against a lot via a
// row here — never ownership. One lot can carry active reservations for
// several projects at once; "available to reserve" = lot.quantity minus the
// sum of its active reservations.
//
//   POST /material-lots/:id/reserve       -> claim a quantity for a project
//   POST /lot-reservations/:id/release    -> release one claim back to the pool

import { z } from "https://esm.sh/zod@3.23.8";
import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { sanitize } from "../lib/sanitize.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

// Matches material_lots.insertable/updatable — the same people who can
// register a lot can claim or release a reservation against one.
const ALLOWED_ROLES = ["owner", "pm", "foreman", "qc"];

const ReserveSchema = z.object({
  project_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  notes: z.string().max(500).optional(),
});

/** POST /material-lots/:id/reserve */
export async function reserveLot(ctx: Ctx, lotId: string): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const parsed = ReserveSchema.safeParse(sanitize(raw));
  if (!parsed.success) return err("Validation failed", 422, "validation");
  const body = parsed.data;

  // RLS-scoped reads confirm the lot and project both belong to the caller's company.
  const { data: lot, error: lotErr } = await ctx.sb
    .from("material_lots").select("id, quantity, lot_number").eq("id", lotId).maybeSingle();
  if (lotErr) return err(lotErr.message, 400, "db_error");
  if (!lot) return err("Material lot not found", 404, "not_found");

  const { data: project, error: pErr } = await ctx.sb
    .from("projects").select("id, name").eq("id", body.project_id).maybeSingle();
  if (pErr) return err(pErr.message, 400, "db_error");
  if (!project) return err("Project not found", 404, "not_found");

  // Pre-check for a clean error message; fn_lot_reservations_before_insert
  // enforces the same rule at the DB layer regardless (defense in depth).
  const { data: activeReservations, error: resErr } = await ctx.sb
    .from("lot_reservations").select("quantity").eq("material_lot_id", lotId).eq("status", "active");
  if (resErr) return err(resErr.message, 400, "db_error");
  const alreadyReserved = (activeReservations ?? []).reduce((s, r) => s + Number(r.quantity), 0);
  const available = Number(lot.quantity) - alreadyReserved;
  if (body.quantity > available) {
    return err(`Only ${available} of ${lot.quantity} is unreserved on this lot`, 409, "insufficient_quantity");
  }

  const { data: reservation, error: insErr } = await ctx.sb
    .from("lot_reservations")
    .insert({
      company_id: ctx.user.company_id,
      material_lot_id: lotId,
      project_id: body.project_id,
      quantity: body.quantity,
      reserved_by: ctx.user.id,
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (insErr) return err(insErr.message, 400, "db_error");

  await writeAudit(ctx, {
    action: "insert",
    table_name: "lot_reservations",
    record_id: reservation.id as string,
    new_values: reservation,
  });
  await writeActivity(ctx, {
    action: `reserved ${body.quantity} of lot ${lot.lot_number} for ${project.name}`,
    entity_type: "lot_reservations",
    entity_id: reservation.id as string,
    entity_label: lot.lot_number as string,
  });

  return ok({ reservation });
}

/** POST /lot-reservations/:id/release */
export async function releaseLotReservation(ctx: Ctx, reservationId: string): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  const { data: reservation, error: findErr } = await ctx.sb
    .from("lot_reservations").select("id, status, material_lot_id, quantity").eq("id", reservationId).maybeSingle();
  if (findErr) return err(findErr.message, 400, "db_error");
  if (!reservation) return err("Reservation not found", 404, "not_found");
  if (reservation.status !== "active") return err("Reservation is not active", 409, "not_active");

  const { data: updated, error: updErr } = await ctx.sb
    .from("lot_reservations")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("id", reservationId)
    .select()
    .single();
  if (updErr) return err(updErr.message, 400, "db_error");

  await writeAudit(ctx, {
    action: "update",
    table_name: "lot_reservations",
    record_id: reservationId,
    old_values: reservation,
    new_values: updated,
  });
  await writeActivity(ctx, {
    action: `released a reservation of ${reservation.quantity} back to available inventory`,
    entity_type: "lot_reservations",
    entity_id: reservationId,
  });

  return ok({ reservation: updated });
}
