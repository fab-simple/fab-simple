// Sourcing Workflow (Module 1-3: Material Requirement -> RFQ -> Vendor Quotes
// -> Award). Spec: docs/procurement-material-traceability-spec.md §15.
//
//   POST /rfqs                          -> compound create: header + lines + vendors
//   POST /vendor-quotes                 -> compound create: quote header + per-line pricing
//   POST /vendor-quotes/:id/award       -> awards a quote, auto-creates a draft PO
//
// Compound creates run through security-definer RPCs (fn_create_rfq,
// fn_create_vendor_quote) so a partial failure never leaves an orphaned
// header row with no lines — same atomicity pattern as heatAssignment.ts's
// fn_assign_heat_to_bundle.

import { z } from "https://esm.sh/zod@3.23.8";
import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { sanitize } from "../lib/sanitize.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

// Matches rfqs/vendor_quotes RBAC (§15.14): Purchasing Manager persona = pm+accounting.
const ALLOWED_ROLES = ["owner", "pm", "accounting"];

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

const CreateRfqSchema = z.object({
  delivery_requirement: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(z.object({
    material_requirement_id: z.string().uuid(),
    quantity: z.coerce.number().positive(),
  })).min(1, "At least one material requirement is required"),
  vendor_ids: z.array(z.string().uuid()).min(1, "At least one vendor is required"),
});

const CreateVendorQuoteSchema = z.object({
  rfq_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  lead_time_days: z.coerce.number().int().nonnegative().optional(),
  freight_cost: z.coerce.number().nonnegative().optional(),
  validity_date: dateStr.optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(z.object({
    rfq_line_id: z.string().uuid(),
    unit_price: z.coerce.number().nonnegative(),
    mill_name: z.string().max(200).optional(),
    rolling_schedule: z.string().max(200).optional(),
  })).min(1, "At least one priced line is required"),
});

/** POST /rfqs */
export async function createRfq(ctx: Ctx): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const parsed = CreateRfqSchema.safeParse(sanitize(raw));
  if (!parsed.success) return err("Validation failed", 422, "validation");
  const body = parsed.data;

  // RLS-scoped reads confirm every referenced row belongs to the caller's
  // company — the RPC itself is security-definer and won't re-check this.
  const mrIds = body.lines.map((l) => l.material_requirement_id);
  const { data: mrs, error: mrErr } = await ctx.sb
    .from("material_requirements").select("id").in("id", mrIds);
  if (mrErr) return err(mrErr.message, 400, "db_error");
  if ((mrs ?? []).length !== new Set(mrIds).size) {
    return err("One or more material requirements not found", 404, "not_found");
  }

  const { data: vendorRows, error: vErr } = await ctx.sb
    .from("vendors").select("id").in("id", body.vendor_ids);
  if (vErr) return err(vErr.message, 400, "db_error");
  if ((vendorRows ?? []).length !== new Set(body.vendor_ids).size) {
    return err("One or more vendors not found", 404, "not_found");
  }

  const { data: seq, error: seqErr } = await ctx.sbAdmin.rpc("next_sequence_number", {
    p_company_id: ctx.user.company_id,
    p_table_name: "rfqs",
    p_prefix: "RFQ",
    p_width: 4,
  });
  if (seqErr) return err(`Sequence error: ${seqErr.message}`, 500, "sequence");

  const { data: rfqId, error: rpcErr } = await ctx.sbAdmin.rpc("fn_create_rfq", {
    p_company_id: ctx.user.company_id,
    p_rfq_number: seq,
    p_delivery_requirement: body.delivery_requirement ?? null,
    p_notes: body.notes ?? null,
    p_lines: body.lines,
    p_vendor_ids: body.vendor_ids,
    p_created_by: ctx.user.id,
  });
  if (rpcErr) return err(rpcErr.message, 400, "rpc_error");

  const { data: rfq } = await ctx.sb.from("rfqs").select("*").eq("id", rfqId as string).maybeSingle();

  await writeAudit(ctx, { action: "rpc", table_name: "rfqs", record_id: rfqId as string, new_values: rfq });
  await writeActivity(ctx, {
    action: `created RFQ ${rfq?.rfq_number ?? ""} for ${body.vendor_ids.length} vendor(s)`.trim(),
    entity_type: "rfqs",
    entity_id: rfqId as string,
    entity_label: (rfq?.rfq_number as string) ?? null,
  });

  return ok({ rfq });
}

/** POST /vendor-quotes */
export async function createVendorQuote(ctx: Ctx): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const parsed = CreateVendorQuoteSchema.safeParse(sanitize(raw));
  if (!parsed.success) return err("Validation failed", 422, "validation");
  const body = parsed.data;

  const { data: rfq, error: rfqErr } = await ctx.sb
    .from("rfqs").select("id").eq("id", body.rfq_id).maybeSingle();
  if (rfqErr) return err(rfqErr.message, 400, "db_error");
  if (!rfq) return err("RFQ not found", 404, "not_found");

  const { data: vendor, error: vErr } = await ctx.sb
    .from("vendors").select("id").eq("id", body.vendor_id).maybeSingle();
  if (vErr) return err(vErr.message, 400, "db_error");
  if (!vendor) return err("Vendor not found", 404, "not_found");

  const { data: existing, error: existErr } = await ctx.sb
    .from("vendor_quotes").select("id").eq("rfq_id", body.rfq_id).eq("vendor_id", body.vendor_id).maybeSingle();
  if (existErr) return err(existErr.message, 400, "db_error");
  if (existing) return err("This vendor already has a quote on this RFQ", 409, "already_exists");

  const lineIds = body.lines.map((l) => l.rfq_line_id);
  const { data: rfqLines, error: rlErr } = await ctx.sb
    .from("rfq_lines").select("id").in("id", lineIds);
  if (rlErr) return err(rlErr.message, 400, "db_error");
  if ((rfqLines ?? []).length !== new Set(lineIds).size) {
    return err("One or more RFQ lines not found", 404, "not_found");
  }

  const { data: quoteId, error: rpcErr } = await ctx.sbAdmin.rpc("fn_create_vendor_quote", {
    p_company_id: ctx.user.company_id,
    p_rfq_id: body.rfq_id,
    p_vendor_id: body.vendor_id,
    p_lead_time_days: body.lead_time_days ?? null,
    p_freight_cost: body.freight_cost ?? null,
    p_validity_date: body.validity_date ?? null,
    p_notes: body.notes ?? null,
    p_lines: body.lines,
    p_created_by: ctx.user.id,
  });
  if (rpcErr) return err(rpcErr.message, 400, "rpc_error");

  const { data: quote } = await ctx.sb.from("vendor_quotes").select("*").eq("id", quoteId as string).maybeSingle();

  await writeAudit(ctx, { action: "rpc", table_name: "vendor_quotes", record_id: quoteId as string, new_values: quote });
  await writeActivity(ctx, {
    action: "entered a vendor quote",
    entity_type: "vendor_quotes",
    entity_id: quoteId as string,
  });

  return ok({ vendor_quote: quote });
}

/** POST /vendor-quotes/:id/award */
export async function awardVendorQuote(ctx: Ctx, quoteId: string): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  const { data: quote, error: qErr } = await ctx.sb
    .from("vendor_quotes").select("id, status").eq("id", quoteId).maybeSingle();
  if (qErr) return err(qErr.message, 400, "db_error");
  if (!quote) return err("Vendor quote not found", 404, "not_found");
  if (!["pending", "submitted"].includes(quote.status)) {
    return err(`Quote is not awardable (status=${quote.status})`, 409, "not_awardable");
  }

  const { data: poId, error: rpcErr } = await ctx.sbAdmin.rpc("fn_award_vendor_quote", {
    p_vendor_quote_id: quoteId,
  });
  if (rpcErr) return err(rpcErr.message, 400, "rpc_error");

  const { data: po } = await ctx.sb.from("purchase_orders").select("*").eq("id", poId as string).maybeSingle();

  await writeAudit(ctx, { action: "rpc", table_name: "purchase_orders", record_id: poId as string, new_values: po });
  await writeActivity(ctx, {
    action: `awarded a vendor quote, created draft PO ${po?.po_number ?? ""}`.trim(),
    entity_type: "purchase_orders",
    entity_id: poId as string,
    entity_label: (po?.po_number as string) ?? null,
  });

  return ok({ purchase_order: po });
}
