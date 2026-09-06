// Material Issue — hard-lock consumption of a material lot against a part.
// Spec: fabsimple_api_spec.md §8, fabsimple_schema.sql §material_issues.
//
// POST /parts/:id/issue-material   → consume a specific lot against a part
// POST /material-issues/:id/void   → void a mis-issue (never deletes)
// GET  /parts/:id/traceability     → full reverse chain via v_part_traceability
//
// Design: all writes are immutable once created. The only allowed UPDATE is
// flipping voided = true + supplying a void_reason. The DB trigger
// fn_material_issues_after_change handles qty reconciliation and
// reservation status transitions automatically.

import { z } from "https://esm.sh/zod@3.23.8";
import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { sanitize } from "../lib/sanitize.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

// Same audience as lot reservations — foreman issues material on the shop floor.
const ISSUE_ROLES  = ["owner", "pm", "foreman", "qc"];
// Voiding is an admin-level correction — only owner/pm
const VOID_ROLES   = ["owner", "pm"];
// Anyone who can read parts can read the traceability chain
const READ_ROLES   = ["owner", "pm", "foreman", "qc", "estimator", "accounting"];

const IssueSchema = z.object({
  lot_id:    z.string().uuid(),
  quantity:  z.coerce.number().positive(),
  notes:     z.string().max(500).optional(),
});

const VoidSchema = z.object({
  void_reason: z.string().min(1).max(500),
});

/** POST /parts/:id/issue-material */
export async function issueMaterial(ctx: Ctx, partId: string): Promise<Response> {
  if (!ISSUE_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const parsed = IssueSchema.safeParse(sanitize(raw));
  if (!parsed.success) return err("Validation failed", 422, "validation");
  const body = parsed.data;

  // ── Validate the part exists and belongs to this company ─────────────────
  const { data: part, error: partErr } = await ctx.sb
    .from("parts")
    .select("id, mark, name, profile, project_id, status, material_lot_id")
    .eq("id", partId)
    .maybeSingle();
  if (partErr) return err(partErr.message, 400, "db_error");
  if (!part)   return err("Part not found", 404, "not_found");

  // Idempotency guard: a part already issued cannot be re-issued until voided
  const { data: existingIssue } = await ctx.sb
    .from("material_issues")
    .select("id")
    .eq("part_id", partId)
    .eq("voided", false)
    .maybeSingle();
  if (existingIssue) {
    return err("This part already has a live material issue. Void the existing issue before re-issuing.", 409, "already_issued");
  }

  // ── Validate the lot and check availability ──────────────────────────────
  const { data: lot, error: lotErr } = await ctx.sb
    .from("material_lots")
    .select("id, lot_number, quantity, status, heat_number_id, profile, grade")
    .eq("id", body.lot_id)
    .maybeSingle();
  if (lotErr) return err(lotErr.message, 400, "db_error");
  if (!lot)   return err("Material lot not found", 404, "not_found");
  if (lot.status === "consumed") return err("Lot is fully consumed", 409, "lot_consumed");

  // Check available quantity (lot.quantity minus sum of active reservations)
  const { data: activeRes } = await ctx.sb
    .from("lot_reservations")
    .select("quantity")
    .eq("material_lot_id", body.lot_id)
    .eq("status", "active");
  const reservedQty  = (activeRes ?? []).reduce((s, r) => s + Number(r.quantity), 0);
  const availableQty = Number(lot.quantity) - reservedQty;
  if (body.quantity > Number(lot.quantity)) {
    return err(
      `Cannot issue ${body.quantity} — lot only has ${lot.quantity} remaining (${availableQty} unreserved)`,
      409,
      "insufficient_quantity",
    );
  }

  // ── Resolve the heat number for denormalization ──────────────────────────
  const { data: heat, error: heatErr } = await ctx.sb
    .from("heat_numbers")
    .select("id, heat_number, status")
    .eq("id", lot.heat_number_id)
    .maybeSingle();
  if (heatErr) return err(heatErr.message, 400, "db_error");
  if (!heat)   return err("Heat number not found for this lot", 404, "not_found");
  if (heat.status === "quarantine") {
    return err(
      "Material is quarantined — MTR must be human-verified before issuing",
      409,
      "lot_quarantined",
    );
  }

  // ── Insert the material issue (trigger handles qty decrement + reservation) ─
  const { data: issue, error: insErr } = await ctx.sb
    .from("material_issues")
    .insert({
      company_id:      ctx.user.company_id,
      material_lot_id: body.lot_id,
      part_id:         partId,
      heat_number:     heat.heat_number,
      quantity:        body.quantity,
      issued_by:       ctx.user.id,
    })
    .select()
    .single();
  if (insErr) return err(insErr.message, 400, "db_error");

  // ── Link the lot back to the part (existing FK column) ───────────────────
  // fn_sync_part_heat_number trigger denormalizes heat_number onto parts.heat_number
  await ctx.sb
    .from("parts")
    .update({ material_lot_id: body.lot_id, status: "in_progress" })
    .eq("id", partId);

  await writeAudit(ctx, {
    action: "insert",
    table_name: "material_issues",
    record_id: issue.id as string,
    new_values: issue,
  });
  await writeActivity(ctx, {
    action: `issued ${body.quantity} of lot ${lot.lot_number} (heat ${heat.heat_number}) to part ${part.mark ?? partId}`,
    entity_type: "material_issues",
    entity_id:   issue.id as string,
    entity_label: `${part.mark ?? partId} ← ${lot.lot_number}`,
    metadata: {
      lot_id:        body.lot_id,
      lot_number:    lot.lot_number,
      heat_number:   heat.heat_number,
      part_id:       partId,
      part_mark:     part.mark,
      project_id:    part.project_id,
    },
  });

  return ok({ issue, lot_number: lot.lot_number, heat_number: heat.heat_number });
}

/** POST /material-issues/:id/void */
export async function voidMaterialIssue(ctx: Ctx, issueId: string): Promise<Response> {
  if (!VOID_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const parsed = VoidSchema.safeParse(sanitize(raw));
  if (!parsed.success) return err("Validation failed", 422, "validation");
  const body = parsed.data;

  const { data: issue, error: findErr } = await ctx.sb
    .from("material_issues")
    .select("id, voided, material_lot_id, part_id, quantity, heat_number")
    .eq("id", issueId)
    .maybeSingle();
  if (findErr) return err(findErr.message, 400, "db_error");
  if (!issue)  return err("Material issue not found", 404, "not_found");
  if (issue.voided) return err("Issue is already voided", 409, "already_voided");

  // The immutable guard trigger on material_issues only allows voided/void_reason
  // to change — it rejects any edit to heat_number/lot/part/quantity.
  const { data: voided, error: updErr } = await ctx.sb
    .from("material_issues")
    .update({
      voided:     true,
      void_reason: body.void_reason,
      voided_by:  ctx.user.id,
      voided_at:  new Date().toISOString(),
    })
    .eq("id", issueId)
    .select()
    .single();
  if (updErr) return err(updErr.message, 400, "db_error");

  // Clear the lot link from the part so it can be re-issued
  await ctx.sb
    .from("parts")
    .update({ material_lot_id: null, heat_number: null, status: "not_started" })
    .eq("id", issue.part_id);

  await writeAudit(ctx, {
    action: "update",
    table_name: "material_issues",
    record_id: issueId,
    old_values: issue,
    new_values: voided,
  });
  await writeActivity(ctx, {
    action: `voided material issue for part — reason: ${body.void_reason}`,
    entity_type: "material_issues",
    entity_id:   issueId,
    metadata: {
      void_reason:     body.void_reason,
      part_id:         issue.part_id,
      material_lot_id: issue.material_lot_id,
      heat_number:     issue.heat_number,
      qty_returned:    issue.quantity,
    },
  });

  return ok({ issue: voided });
}

/** GET /parts/:id/traceability
 *  Returns the full reverse chain from the v_part_traceability view.
 *  Includes all issues (live + voided) so the PM can see the complete history.
 */
export async function getPartTraceability(ctx: Ctx, partId: string): Promise<Response> {
  if (!READ_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  // Confirm the part belongs to this company via RLS-scoped read
  const { data: part, error: partErr } = await ctx.sb
    .from("parts")
    .select("id, mark, name, profile, project_id")
    .eq("id", partId)
    .maybeSingle();
  if (partErr) return err(partErr.message, 400, "db_error");
  if (!part)   return err("Part not found", 404, "not_found");

  // The view is not RLS-protected directly (it's a view over RLS-protected tables)
  // so we use sbAdmin but gate on the company-owned part check above.
  const { data: chain, error: viewErr } = await ctx.sbAdmin
    .from("v_part_traceability")
    .select("*")
    .eq("part_id", partId)
    .order("issued_at", { ascending: false });
  if (viewErr) return err(viewErr.message, 400, "db_error");

  return ok({ part_id: partId, chain: chain ?? [] });
}
