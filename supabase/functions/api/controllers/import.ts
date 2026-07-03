// Tekla / SDS2 CSV import. Auto-detects column name variations and
// imperial/metric units. Returns summary + skipped + errors arrays.
//
// Supported sheet columns (and their aliases):
//   QTY / Quantity  → quantity
//   Mark / Part Mark → part_mark
//   Profile / Section → profile
//   Name            → name  (structural member label, e.g. "W-BEAM", "COLUMN")
//   Length          → length (stored in inches internally)
//   Grade / Material → grade
//   Part Weight / Weight → weight (per-piece weight, stored in lb)
//   Heat Number / Heat No → heat_number

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

interface ImportBody {
  project_id: string;
  rows: Record<string, string>[];
  units?: "imperial" | "metric" | "auto";
}

// ---------------------------------------------------------------------------
// Column alias registry
// ---------------------------------------------------------------------------
// Each key is a DB column on `parts`. The value list is ordered by priority —
// the first alias that matches a header in the uploaded sheet wins. All
// comparisons are normalised (lowercase, non-alphanumeric stripped) so
// "Part Weight", "part_weight", "PARTWEIGHT" all resolve identically.
//
// Mapping decisions:
//   • "Name" gets its own field (parts.name). Tekla's Name column holds a
//     structural member descriptor ("W-BEAM", "HSS-COLUMN") — it is NOT the
//     assembly mark. Removed "name" from assembly_mark aliases.
//   • "Part Weight" is the per-piece weight and wins over "Ext. Weight"
//     (total line weight) because our parts table stores one row per piece,
//     not one row per BOM line.
//   • "QTY" is the canonical Tekla header for quantity and listed first.
//   • "Mark" is the canonical Tekla header for part_mark and listed first.
//   • "Heat Number" is the exact column label from the target sheet.
// ---------------------------------------------------------------------------
const COL_ALIASES: Record<string, string[]> = {
  quantity:      ["qty", "quantity", "count", "pcs", "pieces", "no_of_pieces", "no of pieces"],
  part_mark:     ["mark", "part mark", "part_mark", "partmark", "piecemark", "piece mark", "part id", "partid", "part_pos", "member_mark", "member mark"],
  profile:       ["profile", "section", "shape", "size", "profile_name", "section_size", "profilename"],
  name:          ["name", "member_name", "member name", "member type", "membertype", "description", "desc", "type"],
  length:        ["length", "len", "length_mm", "length_in", "length_ft", "cut_length", "cut length"],
  grade:         ["grade", "material", "material grade", "material_grade", "spec", "matl"],
  // "Part Weight" (per-piece weight) is highest priority. "Ext. Weight" /
  // "Extended Weight" are total-line weights and intentionally listed after so
  // they act only as a fallback when the sheet has no per-piece weight column.
  weight:        ["part weight", "part_weight", "partweight", "weight", "wt", "weight_lbs", "weight_lb", "weight_kg", "weight_ea", "unit_weight", "unit weight", "unitweight", "ext_weight", "ext weight", "extended_weight", "extended weight", "total_weight"],
  heat_number:   ["heat number", "heat_number", "heat no", "heat_no", "heat", "heatno", "heat#"],
  assembly_mark: ["assembly_mark", "assemblymark", "assembly mark", "assembly", "asm", "assembly_pos", "main_part", "main part"],
  phase:         ["phase", "lot", "sequence", "seq", "lot_number", "lotnumber"],
};

// Strips everything that isn't a-z0-9 and lower-cases — so "Part Weight",
// "part_weight", and "PARTWEIGHT " all normalise to the same string.
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Build a header → value map for a row keyed by the normalised header.
// Done once per row so picking N fields stays O(N) rather than O(N × headers).
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

// ---------------------------------------------------------------------------
// Length parser
// ---------------------------------------------------------------------------
// Tekla exports length in several formats depending on the project template:
//   • Feet-inches:  17'-9"  |  17'9"  |  17' 9"  |  17'-9  |  17'  |  9"
//   • Decimal inches (imperial): 213.00
//   • Millimetres  (metric):     5400
//
// Returns { inches, wasFeetInches } so the caller knows whether a unit
// conversion is still needed (plain numbers) or whether the value is already
// in inches (feet-inches strings are inherently imperial).
interface ParsedLength { inches: number; wasFeetInches: boolean; }

function parseLengthRaw(raw: string): ParsedLength | null {
  const s = raw.trim();
  if (!s) return null;

  // 17'-9"  |  17'9"  |  17' 9"  |  17'-9  (feet + inches, decimal ok)
  const ftIn = s.match(/^(\d+(?:\.\d+)?)'[-\s]*(\d+(?:\.\d+)?)"?$/);
  if (ftIn) {
    const in_ = Number(ftIn[1]) * 12 + Number(ftIn[2]);
    return in_ > 0 ? { inches: in_, wasFeetInches: true } : null;
  }

  // 17'  (feet only)
  const ftOnly = s.match(/^(\d+(?:\.\d+)?)'$/);
  if (ftOnly) {
    const in_ = Number(ftOnly[1]) * 12;
    return in_ > 0 ? { inches: in_, wasFeetInches: true } : null;
  }

  // 9"  (inches only with unit symbol)
  const inOnly = s.match(/^(\d+(?:\.\d+?)?)"$/);
  if (inOnly) {
    const in_ = Number(inOnly[1]);
    return in_ > 0 ? { inches: in_, wasFeetInches: true } : null;
  }

  // Plain number — caller decides metric vs imperial.
  const num = Number(s);
  if (!isFinite(num)) return null;
  return { inches: num, wasFeetInches: false };
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

  // Pre-build the per-row lookup once so field picking is O(1) per row.
  const lookups = body.rows.map(buildLookup);

  // Compute which canonical fields are populated by some header and which
  // raw headers we have no slot for — reported in the UI mapping summary.
  const allNormalisedAliases = new Set<string>();
  for (const aliases of Object.values(COL_ALIASES)) {
    for (const a of aliases) allNormalisedAliases.add(normaliseHeader(a));
  }
  const matchedFields = new Set<string>();
  const unmappedHeaders = new Set<string>();
  if (body.rows.length > 0) {
    for (const rawHeader of Object.keys(body.rows[0])) {
      const norm = normaliseHeader(rawHeader);
      if (!norm) continue;
      if (allNormalisedAliases.has(norm)) {
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

  // Auto-detect units.
  // • If any row has a feet-inches length value → the sheet is already in
  //   imperial inches; no conversion will be applied to plain numbers either.
  // • Otherwise: plain number > 50 → treat as metric mm; ≤ 50 → imperial in.
  // • Default: imperial (North American shops).
  let units = body.units ?? "auto";
  if (units === "auto") {
    const sampleRaw = lookups.map((l) => pickFrom(l, "length")).find(Boolean) ?? "";
    const sampleParsed = sampleRaw ? parseLengthRaw(sampleRaw) : null;
    if (sampleParsed?.wasFeetInches) {
      units = "imperial"; // feet-inches strings are inherently imperial
    } else if (sampleParsed && sampleParsed.inches > 0) {
      units = sampleParsed.inches > 50 ? "metric" : "imperial";
    } else {
      units = "imperial";
    }
  }
  const mmToIn = (v: number) => v / 25.4;
  const kgToLb = (v: number) => v * 2.20462;

  const inserted: Record<string, unknown>[] = [];
  const updated:  Record<string, unknown>[] = [];
  const skipped: { row: number; part_mark?: string; reason: string }[] = [];
  const errors:  { row: number; reason: string }[] = [];

  for (let i = 0; i < body.rows.length; i++) {
    const lookup = lookups[i];
    const part_mark = pickFrom(lookup, "part_mark");
    if (!part_mark) { errors.push({ row: i, reason: "missing part mark (Mark / Part Mark column not found or empty)" }); continue; }

    // Parse length — handles decimal inches, metric mm, and feet-inches (17'-9").
    const rawLenStr = pickFrom(lookup, "length");
    const lenParsed = rawLenStr ? parseLengthRaw(rawLenStr) : null;
    let length: number | null = null;
    if (lenParsed && lenParsed.inches > 0) {
      // Feet-inches strings are already in inches; plain numbers need unit conversion.
      length = lenParsed.wasFeetInches ? lenParsed.inches
             : (units === "metric" ? mmToIn(lenParsed.inches) : lenParsed.inches);
    }

    const weightRaw = Number(pickFrom(lookup, "weight"));
    const weight = isFinite(weightRaw) && weightRaw > 0 ? (units === "metric" ? kgToLb(weightRaw) : weightRaw) : null;

    const { data: existing } = await ctx.sb.from("parts")
      .select("id,status,profile")
      .eq("project_id", body.project_id)
      .eq("part_mark", part_mark)
      .maybeSingle();

    if (existing) {
      const progressed    = ["in_progress", "complete", "shipped"].includes((existing.status as string));
      const incomingProfile = pickFrom(lookup, "profile");
      const profileChanged  = incomingProfile && (existing.profile as string) !== incomingProfile;

      // Block geometry changes on parts already in production.
      // Profile is the single field that drives CNC and cutting — changing it
      // after the part has been cut or welded is a real shop-floor hazard.
      if (progressed && profileChanged) {
        skipped.push({ row: i, part_mark, reason: "part has progressed — profile change blocked" });
        continue;
      }

      // Re-import updates ALL fields. Profile + length + weight are refreshed
      // for idle parts (not_started / on_hold). Metadata (name, grade, heat,
      // phase) is always refreshed regardless of status.
      const patch: Record<string, unknown> = {
        name:         pickFrom(lookup, "name")          ?? null,
        grade:        pickFrom(lookup, "grade")         ?? null,
        heat_number:  pickFrom(lookup, "heat_number")   ?? null,
        phase:        pickFrom(lookup, "phase")         ?? null,
        quantity:     Number(pickFrom(lookup, "quantity") ?? "1"),
      };
      if (!progressed) {
        // Only update geometry for idle parts.
        if (incomingProfile)  patch.profile = incomingProfile;
        if (length !== null)  patch.length  = length;
        if (weight !== null)  patch.weight  = weight;
      }

      const { data: updatedRow } = await ctx.sb.from("parts")
        .update(patch).eq("id", existing.id).select().single();
      if (updatedRow) updated.push(updatedRow);
      continue;
    }

    // New part — insert with all fields.
    const row = {
      company_id:    ctx.user.company_id,
      project_id:    body.project_id,
      part_mark,
      assembly_mark: pickFrom(lookup, "assembly_mark") ?? null,
      profile:       pickFrom(lookup, "profile")       ?? "UNKNOWN",
      name:          pickFrom(lookup, "name")          ?? null,
      grade:         pickFrom(lookup, "grade")         ?? null,
      length,
      weight,
      quantity:      Number(pickFrom(lookup, "quantity") ?? "1"),
      phase:         pickFrom(lookup, "phase")         ?? null,
      heat_number:   pickFrom(lookup, "heat_number")   ?? null,
      status:        "not_started",
    };
    const { data, error } = await ctx.sb.from("parts").insert(row).select().single();
    if (error) { errors.push({ row: i, reason: error.message }); continue; }
    inserted.push(data);
  }

  await writeAudit(ctx, {
    action: "import",
    table_name: "parts",
    new_values: { project_id: body.project_id, inserted: inserted.length, skipped: skipped.length, errors: errors.length },
  });
  await writeActivity(ctx, {
    action: `imported ${inserted.length} parts, updated ${updated.length} from CSV`,
    entity_type: "projects",
    entity_id: body.project_id,
    entity_label: project.name as string,
    metadata: { units, inserted: inserted.length, updated: updated.length, skipped: skipped.length, errors: errors.length },
  });

  return ok({
    summary: { inserted: inserted.length, updated: updated.length, skipped: skipped.length, errors: errors.length, units },
    skipped,
    errors,
    mapping: {
      matched_fields:   Array.from(matchedFields).sort(),
      unmapped_headers: Array.from(unmappedHeaders).sort(),
    },
  });
}
