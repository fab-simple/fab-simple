// Heat assignment (Module 9: Bundle -> Heat -> Lot) and lot recommendation
// (Module 12: Production Allocation). Spec: docs/procurement-material-traceability-spec.md §7.3-7.4
//
//   POST /bundles/:id/assign-heat        -> assigns a heat to a bundle, creates the material_lot
//   GET  /material-lots/recommend        -> best available lot for a profile/grade/min-length

import { z } from "https://esm.sh/zod@3.23.8";
import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { sanitize } from "../lib/sanitize.ts";
import { canRead } from "../lib/permissions.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

// Matches heat_numbers.insertable/updatable (owner/qc/foreman) plus pm, who
// oversees receiving but isn't in that list — bundle/heat assignment is a
// shop-floor + PM action, not a heat-number-record edit per se.
const ALLOWED_ROLES = ["owner", "pm", "foreman", "qc"];

const AssignHeatSchema = z.object({
  heat_number_id: z.string().uuid(),
  profile: z.string().min(1).max(80),
  grade: z.string().min(1).max(40),
  length: z.coerce.number().positive().optional(),
  location: z.string().max(120).optional(),
});

/** POST /bundles/:id/assign-heat */
export async function assignHeatToBundle(ctx: Ctx, bundleId: string): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const parsed = AssignHeatSchema.safeParse(sanitize(raw));
  if (!parsed.success) return err("Validation failed", 422, "validation");
  const body = parsed.data;

  // RLS-scoped reads confirm every referenced row belongs to the caller's company.
  const { data: bundle, error: bErr } = await ctx.sb
    .from("bundles").select("id, heat_number_id").eq("id", bundleId).maybeSingle();
  if (bErr) return err(bErr.message, 400, "db_error");
  if (!bundle) return err("Bundle not found", 404, "not_found");
  if (bundle.heat_number_id) return err("Bundle already has a heat assigned", 409, "already_assigned");

  const { data: heat, error: hErr } = await ctx.sb
    .from("heat_numbers").select("id").eq("id", body.heat_number_id).maybeSingle();
  if (hErr) return err(hErr.message, 400, "db_error");
  if (!heat) return err("Heat number not found", 404, "not_found");

  // The RPC touches bundles + material_lots + heat_numbers in one pass; it's
  // security definer (like next_sequence_number) so it runs via sbAdmin. No
  // project is involved anywhere here — material lots are company-wide
  // inventory; a project only ever holds a reservation against one (see
  // lotReservation.ts), never ownership.
  const { data: lotId, error: rpcErr } = await ctx.sbAdmin.rpc("fn_assign_heat_to_bundle", {
    p_bundle_id: bundleId,
    p_heat_number_id: body.heat_number_id,
    p_profile: body.profile,
    p_grade: body.grade,
    p_length: body.length ?? null,
    p_location: body.location ?? null,
  });
  if (rpcErr) return err(rpcErr.message, 400, "rpc_error");

  const { data: lot } = await ctx.sb.from("material_lots").select("*").eq("id", lotId as string).maybeSingle();

  await writeAudit(ctx, {
    action: "rpc",
    table_name: "material_lots",
    record_id: lotId as string,
    new_values: lot,
  });
  await writeActivity(ctx, {
    action: `assigned heat to bundle, created lot ${lot?.lot_number ?? ""}`.trim(),
    entity_type: "material_lots",
    entity_id: lotId as string,
    entity_label: (lot?.lot_number as string) ?? null,
  });

  return ok({ material_lot: lot });
}

/**
 * GET /material-lots/recommend?profile=&grade=&min_length=
 * Best available lot first: closest length over the requirement, then
 * oldest inventory — matches the PDF's "Closest length, Lowest waste,
 * Oldest inventory first." Read-only; not a generic-CRUD shape (custom
 * ordering/filtering), so it's a bespoke endpoint rather than a table route.
 * Company-wide — material lots have no project of their own (see §16).
 */
export async function recommendLots(ctx: Ctx): Promise<Response> {
  if (!canRead(ctx.user.role, "material_lots")) return err("Forbidden", 403, "forbidden");

  const profile = ctx.url.searchParams.get("profile");
  const grade = ctx.url.searchParams.get("grade");
  if (!profile || !grade) return err("profile and grade are required", 422, "validation");

  const minLengthRaw = ctx.url.searchParams.get("min_length");
  let minLength: number | null = null;
  if (minLengthRaw != null) {
    minLength = Number(minLengthRaw);
    if (!Number.isFinite(minLength)) return err("min_length must be numeric", 422, "validation");
  }

  let q = ctx.sb
    .from("material_lots")
    .select("*")
    .eq("status", "available")
    .eq("profile", profile)
    .eq("grade", grade)
    .gt("quantity", 0)
    .order("length", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(25);
  if (minLength != null) q = q.gte("length", minLength);

  const { data, error } = await q;
  if (error) return err(error.message, 400, "db_error");
  return ok(data ?? []);
}
