// Material Requirements bulk import (KISS/EJE/Tekla/SDS2-style material list
// sheets). Spec: docs/procurement-material-traceability-spec.md §15.19.
//
//   POST /material-requirements/import
//
// Division of labor matches the existing Tekla BOM importer
// (controllers/import.ts): the client parses the sheet, auto-detects/lets the
// user override column mapping, and — because Material Requirements are a
// per-(profile, grade, length) aggregate rather than a per-piece record like
// `parts` — aggregates piece-level rows into one row per unique combination
// before sending. The server only validates and bulk-inserts; no per-row
// upsert-by-mark logic is needed since every row here is a fresh requirement.

import { z } from "https://esm.sh/zod@3.23.8";
import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { sanitize } from "../lib/sanitize.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

// Matches material_requirements.insertable.
const ALLOWED_ROLES = ["owner", "pm", "estimator"];

// Hard cap on a single import — well above any real material list (the
// sample KISS/EJE sheets this was built against aggregate to well under 100
// rows even from an 88-piece BOM) but bounded so a malformed upload can't
// fan out into hundreds of sequential inserts in one request.
const MAX_ROWS = 500;

const ImportRowSchema = z.object({
  profile: z.string().min(1).max(80),
  name: z.string().max(120).optional(),
  grade: z.string().max(40).optional(),
  quantity: z.coerce.number().positive(),
  length: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
});

const ImportBodySchema = z.object({
  project_id: z.string().uuid(),
  rows: z.array(ImportRowSchema).min(1).max(MAX_ROWS),
});

/** POST /material-requirements/import */
export async function importMaterialRequirements(ctx: Ctx): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const parsed = ImportBodySchema.safeParse(sanitize(raw));
  if (!parsed.success) return err("Validation failed", 422, "validation");
  const body = parsed.data;

  // RLS-scoped read confirms the project belongs to the caller's company.
  const { data: project, error: pErr } = await ctx.sb
    .from("projects").select("id, name").eq("id", body.project_id).maybeSingle();
  if (pErr) return err(pErr.message, 400, "db_error");
  if (!project) return err("Project not found", 404, "not_found");

  const inserted: Record<string, unknown>[] = [];
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < body.rows.length; i++) {
    const line = body.rows[i];

    // Sequence numbers are fetched one at a time (same RPC the generic
    // create path and the from-parts PO flow both use) — a few dozen extra
    // round-trips inside one Edge Function invocation is a non-issue at
    // this row count, and it keeps the numbering scheme identical to every
    // other path that creates a material_requirements row.
    const { data: seq, error: seqErr } = await ctx.sbAdmin.rpc("next_sequence_number", {
      p_company_id: ctx.user.company_id,
      p_table_name: "material_requirements",
      p_prefix: "MR",
      p_width: 4,
    });
    if (seqErr) { errors.push({ row: i, reason: `Sequence error: ${seqErr.message}` }); continue; }

    const { data, error } = await ctx.sb
      .from("material_requirements")
      .insert({
        company_id: ctx.user.company_id,
        project_id: body.project_id,
        mr_number: seq,
        profile: line.profile,
        name: line.name ?? null,
        grade: line.grade ?? null,
        quantity: line.quantity,
        length: line.length ?? null,
        notes: line.notes ?? null,
      })
      .select()
      .single();
    if (error) { errors.push({ row: i, reason: error.message }); continue; }
    inserted.push(data);
  }

  await writeAudit(ctx, {
    action: "import",
    table_name: "material_requirements",
    new_values: { project_id: body.project_id, inserted: inserted.length, errors: errors.length },
  });
  await writeActivity(ctx, {
    action: `imported ${inserted.length} material requirement(s) from a sheet`,
    entity_type: "projects",
    entity_id: body.project_id,
    entity_label: project.name as string,
    metadata: { inserted: inserted.length, errors: errors.length },
  });

  return ok({
    summary: { inserted: inserted.length, errors: errors.length },
    inserted,
    errors,
  });
}
