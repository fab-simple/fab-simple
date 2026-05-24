// Tekla / SDS2 CSV import. Auto-detects 9 common column name variations and
// imperial/metric units. Returns summary + skipped + errors arrays.

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

interface ImportBody {
  project_id: string;
  rows: Record<string, string>[];
  units?: "imperial" | "metric" | "auto";
}

const COL_ALIASES: Record<string, string[]> = {
  part_mark:     ["part_mark", "part mark", "piecemark", "part id", "mark"],
  assembly_mark: ["assembly_mark", "assembly mark", "assembly", "asm"],
  profile:       ["profile", "section", "shape", "size"],
  grade:         ["grade", "material", "material grade", "spec"],
  length:        ["length", "len", "length_mm", "length_in"],
  weight:        ["weight", "wt", "weight_lbs", "weight_kg"],
  quantity:      ["quantity", "qty", "count", "pcs"],
  phase:         ["phase", "lot", "sequence"],
  heat_number:   ["heat_number", "heat", "heat no", "heat number"],
};

function pick(row: Record<string, string>, key: string): string | undefined {
  for (const k of COL_ALIASES[key] ?? [key]) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v != null && v !== "") return String(v).trim();
  }
  return undefined;
}

export async function importCsv(ctx: Ctx): Promise<Response> {
  if (!["owner", "pm", "estimator", "foreman"].includes(ctx.user.role)) {
    return err("Forbidden", 403, "forbidden");
  }
  let body: ImportBody;
  try { body = await ctx.req.json(); } catch { return err("Invalid JSON", 400, "bad_json"); }
  if (!body.project_id || !Array.isArray(body.rows)) {
    return err("project_id and rows required", 422, "validation");
  }

  // Verify project belongs to caller's company (RLS will reject otherwise too)
  const { data: project, error: pErr } = await ctx.sb.from("projects")
    .select("id,name").eq("id", body.project_id).maybeSingle();
  if (pErr || !project) return err("Project not found", 404, "not_found");

  // Auto-detect units from first row that has a 'length' value > 50 → mm
  let units = body.units ?? "auto";
  if (units === "auto") {
    const sample = body.rows.find((r) => pick(r, "length"));
    const len = sample ? Number(pick(sample, "length")) : 0;
    units = len > 50 ? "metric" : "imperial";
  }
  const mmToIn = (v: number) => v / 25.4;
  const kgToLb = (v: number) => v * 2.20462;

  const inserted: Record<string, unknown>[] = [];
  const skipped: { row: number; part_mark?: string; reason: string }[] = [];
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < body.rows.length; i++) {
    const r = body.rows[i];
    const part_mark = pick(r, "part_mark");
    if (!part_mark) { errors.push({ row: i, reason: "missing part_mark" }); continue; }

    const lengthRaw = Number(pick(r, "length"));
    const weightRaw = Number(pick(r, "weight"));
    const length = isFinite(lengthRaw) ? (units === "metric" ? mmToIn(lengthRaw) : lengthRaw) : null;
    const weight = isFinite(weightRaw) ? (units === "metric" ? kgToLb(weightRaw) : weightRaw) : null;

    // Conflict policy: progressed parts not auto-updated
    const { data: existing } = await ctx.sb.from("parts")
      .select("id,status,profile")
      .eq("project_id", body.project_id)
      .eq("part_mark", part_mark)
      .maybeSingle();

    if (existing) {
      const progressed = ["in_progress", "complete", "shipped"].includes((existing.status as string));
      const profileChanged = pick(r, "profile") && (existing.profile as string) !== pick(r, "profile");
      if (progressed && profileChanged) {
        skipped.push({ row: i, part_mark, reason: "part has progressed; geometry change blocked" });
        continue;
      }
      // update non-geometry fields
      await ctx.sb.from("parts").update({
        grade: pick(r, "grade") ?? existing["grade" as keyof typeof existing] ?? null,
        heat_number: pick(r, "heat_number") ?? null,
        phase: pick(r, "phase") ?? null,
      }).eq("id", existing.id);
      continue;
    }

    const row = {
      company_id: ctx.user.company_id,
      project_id: body.project_id,
      part_mark,
      assembly_mark: pick(r, "assembly_mark") ?? null,
      profile: pick(r, "profile") ?? "UNKNOWN",
      grade: pick(r, "grade") ?? null,
      length, weight,
      quantity: Number(pick(r, "quantity") ?? "1"),
      phase: pick(r, "phase") ?? null,
      heat_number: pick(r, "heat_number") ?? null,
      status: "not_started",
    };
    const { data, error } = await ctx.sb.from("parts").insert(row).select().single();
    if (error) { errors.push({ row: i, reason: error.message }); continue; }
    inserted.push(data);
  }

  await writeAudit(ctx, { action: "import", table_name: "parts", new_values: { project_id: body.project_id, inserted: inserted.length, skipped: skipped.length, errors: errors.length } });
  await writeActivity(ctx, {
    action: `imported ${inserted.length} parts from CSV`,
    entity_type: "projects",
    entity_id: body.project_id,
    entity_label: project.name as string,
    metadata: { units, skipped: skipped.length, errors: errors.length },
  });

  return ok({
    summary: { inserted: inserted.length, updated: 0, skipped: skipped.length, errors: errors.length, units },
    skipped,
    errors,
  });
}
