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

// Column aliases for the canonical fields we store on `parts`. Every entry is
// matched case-insensitively and ignores whitespace, punctuation, and
// underscores — so "Mark", "MARK", "part_mark", and "Part Mark" all resolve
// to `part_mark`, and "Ext. Weight" / "ext weight" / "ExtWeight" all resolve
// to `weight`. See `normaliseHeader` below.
//
// Tekla Structures and SDS2 BOM templates seen in the wild:
//   Mark | Qty | Profile | NAME | Ext. Area | Unit. Weight | Ext. Weight | Finish
//   Piecemark | Quantity | Section | Material | Length | Weight | Phase
//   PART_POS | QUANTITY | PROFILE | MATERIAL | LENGTH | WEIGHT
//
// Notes on the trickier ones:
//   • Ext. Weight = "extended weight" = qty × unit_weight × length. This is the
//     **total** weight of the line and is what we want on `parts.weight`.
//   • Unit. Weight = weight per unit length (lb/ft or kg/m). We don't store
//     it; it's intentionally NOT aliased to `weight` so it never wins by
//     accident.
//   • NAME (Tekla) is usually a free-text descriptor ("BEAM", "BRACE", a
//     drawing label). We map it as a fallback for `assembly_mark` so the
//     value isn't dropped — it's preferable to lose `assembly_mark` than to
//     lose `part_mark`, so `Mark` always wins.
//   • Ext. Area and Finish describe paint coverage / coating; we don't store
//     them on `parts` yet. They are silently ignored (logged in summary).
const COL_ALIASES: Record<string, string[]> = {
  part_mark:     ["part_mark", "partmark", "part mark", "piecemark", "piece mark", "part id", "partid", "part_pos", "mark", "member_mark", "member mark"],
  assembly_mark: ["assembly_mark", "assemblymark", "assembly mark", "assembly", "asm", "assembly_pos", "main_part", "main part", "name"],
  profile:       ["profile", "section", "shape", "size", "profile_name", "section_size"],
  grade:         ["grade", "material", "material grade", "material_grade", "spec", "matl"],
  length:        ["length", "len", "length_mm", "length_in", "length_ft", "cut_length", "cut length"],
  // `ext_weight` covers Tekla "Ext. Weight" / SDS2 "Extended Weight" — total
  // line weight, which is exactly what `parts.weight` expects.
  weight:        ["weight", "wt", "weight_lbs", "weight_kg", "weight_ea", "ext_weight", "ext weight", "extended_weight", "extended weight", "total_weight"],
  quantity:      ["quantity", "qty", "count", "pcs", "pieces", "no_of_pieces"],
  phase:         ["phase", "lot", "sequence", "seq", "lot_number"],
  heat_number:   ["heat_number", "heat", "heat no", "heat number", "heat_no", "heatno"],
};

// Strips everything that isn't a-z0-9 and lower-cases — so headers like
// "Ext. Weight", "ext_weight", and "EXTWEIGHT " all normalise to the same
// string. This is the single source of truth used to build both the row's
// header map and the alias lookups.
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Build a header → value map for a row keyed by the normalised header. We do
// this once per row so picking N fields stays O(N) rather than O(N × headers).
function buildLookup(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s === "") continue;
    out[normaliseHeader(k)] = s;
  }
  return out;
}

function pickFrom(lookup: Record<string, string>, key: string): string | undefined {
  for (const alias of COL_ALIASES[key] ?? [key]) {
    const hit = lookup[normaliseHeader(alias)];
    if (hit != null && hit !== "") return hit;
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

  // Pre-build the per-row lookup once so we can iterate fields in O(1) each.
  const lookups = body.rows.map(buildLookup);

  // Compute which canonical fields are populated by *some* header and which
  // raw headers we have no slot for. Lets the UI tell the user "Ext. Area
  // and Finish columns were ignored — we don't store paint surface area
  // yet" instead of silently dropping them.
  const allNormalisedAliases = new Set<string>();
  for (const aliases of Object.values(COL_ALIASES)) {
    for (const a of aliases) allNormalisedAliases.add(normaliseHeader(a));
  }
  const matchedFields = new Set<string>();
  const unmappedHeaders = new Set<string>();
  if (body.rows.length > 0) {
    const headerSample = body.rows[0];
    for (const rawHeader of Object.keys(headerSample)) {
      const norm = normaliseHeader(rawHeader);
      if (!norm) continue;
      if (allNormalisedAliases.has(norm)) {
        // Figure out *which* canonical field this header satisfied
        for (const [canon, aliases] of Object.entries(COL_ALIASES)) {
          if (aliases.some((a) => normaliseHeader(a) === norm)) {
            matchedFields.add(canon);
            break;
          }
        }
      } else {
        unmappedHeaders.add(rawHeader);
      }
    }
  }

  // Auto-detect units from the first row with a length value > 50 → metric.
  // For BOMs without a length column (e.g. the user's Tekla template with
  // only Ext. Weight), the loop yields no sample so we stay on imperial,
  // which is the right default for North American shops.
  let units = body.units ?? "auto";
  if (units === "auto") {
    const sample = lookups.find((l) => pickFrom(l, "length"));
    const len = sample ? Number(pickFrom(sample, "length")) : 0;
    units = len > 50 ? "metric" : "imperial";
  }
  const mmToIn = (v: number) => v / 25.4;
  const kgToLb = (v: number) => v * 2.20462;

  const inserted: Record<string, unknown>[] = [];
  const skipped: { row: number; part_mark?: string; reason: string }[] = [];
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < body.rows.length; i++) {
    const lookup = lookups[i];
    const part_mark = pickFrom(lookup, "part_mark");
    if (!part_mark) { errors.push({ row: i, reason: "missing part_mark" }); continue; }

    const lengthRaw = Number(pickFrom(lookup, "length"));
    const weightRaw = Number(pickFrom(lookup, "weight"));
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
      const incomingProfile = pickFrom(lookup, "profile");
      const profileChanged = incomingProfile && (existing.profile as string) !== incomingProfile;
      if (progressed && profileChanged) {
        skipped.push({ row: i, part_mark, reason: "part has progressed; geometry change blocked" });
        continue;
      }
      // update non-geometry fields
      await ctx.sb.from("parts").update({
        grade: pickFrom(lookup, "grade") ?? existing["grade" as keyof typeof existing] ?? null,
        heat_number: pickFrom(lookup, "heat_number") ?? null,
        phase: pickFrom(lookup, "phase") ?? null,
      }).eq("id", existing.id);
      continue;
    }

    const row = {
      company_id: ctx.user.company_id,
      project_id: body.project_id,
      part_mark,
      assembly_mark: pickFrom(lookup, "assembly_mark") ?? null,
      profile: pickFrom(lookup, "profile") ?? "UNKNOWN",
      grade: pickFrom(lookup, "grade") ?? null,
      length, weight,
      quantity: Number(pickFrom(lookup, "quantity") ?? "1"),
      phase: pickFrom(lookup, "phase") ?? null,
      heat_number: pickFrom(lookup, "heat_number") ?? null,
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
    mapping: {
      matched_fields: Array.from(matchedFields).sort(),
      unmapped_headers: Array.from(unmappedHeaders).sort(),
    },
  });
}
