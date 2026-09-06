// Tekla / SDS2 CSV import. Auto-detects column name variations and
// imperial/metric units. Returns summary + skipped + errors arrays.
//
// Supported sheet columns (and their aliases):
//   QTY / Quantity           → quantity
//   Mark / Part Mark         → part_mark
//   Profile Size / Profile / Section → profile  (Tekla: "Profile Size" = e.g. W12X26)
//   Profile name / Name      → name    (Tekla: "Profile name" = e.g. "W-BEAM", "COLUMN")
//   Length                   → length (stored verbatim as text — no unit parsing/conversion)
//   Grade / Material         → grade
//   Part Weight / Weight     → weight (per-piece weight, stored in lb)
//   Heat Number / Heat No    → heat_number

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
  quantity: ["qty", "quantity", "count", "pcs", "pieces", "no_of_pieces", "no of pieces"],
  part_mark: ["mark", "part mark", "part_mark", "partmark", "piecemark", "piece mark", "part id", "partid", "part_pos", "member_mark", "member mark"],
  profile: ["profile size", "profile", "section", "shape", "size", "profile_name", "section_size", "profilename", "profilesize"],
  name: ["profile name", "name", "member_name", "member name", "member type", "membertype", "description", "desc", "type"],
  length: ["length", "len", "length_mm", "length_in", "length_ft", "cut_length", "cut length"],
  grade: ["grade", "material", "material grade", "material_grade", "spec", "matl"],
  // "Part Weight" (per-piece weight) is highest priority. "Ext. Weight" /
  // "Extended Weight" are total-line weights and intentionally listed after so
  // they act only as a fallback when the sheet has no per-piece weight column.
  weight: ["part weight", "part_weight", "partweight", "weight", "wt", "weight_lbs", "weight_lb", "weight_kg", "weight_ea", "unit_weight", "unit weight", "unitweight", "ext_weight", "ext weight", "extended_weight", "extended weight", "total_weight"],
  heat_number: ["heat number", "heat_number", "heat no", "heat_no", "heat", "heatno", "heat#"],
  assembly_mark: ["assembly_mark", "assemblymark", "assembly mark", "assembly", "asm", "assembly_pos", "main_part", "main part"],
  phase: ["phase", "lot", "sequence", "seq", "lot_number", "lotnumber"],
};

// Strips everything that isn't a-z0-9 and lower-cases — so "Part Weight",
// "part_weight", and "PARTWEIGHT " all normalise to the same string.
function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Build a header → value map for a row keyed by the normalised header.
// Done once per row so picking N fields stays O(1) rather than O(N × headers).
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
// `parts.length` is stored verbatim as text — this parser is NOT used to
// convert/store the length value itself. It only samples the raw length
// column to heuristically guess imperial vs metric for `units: "auto"`,
// which still drives the *weight* conversion (kg → lb) below.
//
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
  const ftIn = s.match(/^(\d+(?:\.\d+)?)'[-\s]*(\d+(?:\.\d+?)?)"?$/);
  if (ftIn) {
    const in_ = Number(ftIn[1]) * 12 + Number(ftIn[2]);
    return in_ > 0 ? { inches: in_, wasFeetInches: true } : null;
  }

  // 17'  (feet only)
  const ftOnly = s.match(/^(\d+(?:\.\d+?)?)'$/);
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

// ---------------------------------------------------------------------------
// Batch-size constants
// ---------------------------------------------------------------------------
// Supabase/PostgREST can handle large payloads but we chunk conservatively
// to stay well under the default 1 MB body limit and Postgres param limits.
const INSERT_CHUNK = 500; // rows per INSERT batch
const UPDATE_CHUNK = 50;  // parallel UPDATE concurrency per Promise.all batch
const PAGE_SIZE = 1000;   // PostgREST max rows per page

// Helper to paginate through all rows matching a query, bypassing PostgREST's default 1,000-row limit.
async function fetchAllRows<T>(
  fetcher: (rangeFrom: number, rangeTo: number) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await fetcher(from, from + pageSize - 1);
    if (error) {
      console.error("fetchAllRows error:", error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
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
    for (const rawHeader of Object.keys(body.rows[0]!)) {
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
      units = "imperial";
    } else if (sampleParsed && sampleParsed.inches > 0) {
      units = sampleParsed.inches > 50 ? "metric" : "imperial";
    } else {
      units = "imperial";
    }
  }
  const kgToLb = (v: number) => v * 2.20462;

  // -------------------------------------------------------------------------
  // QUERY 1 — Load ALL existing parts for this project with pagination.
  // PostgREST limits results to 1,000 rows by default; fetchAllRows pages
  // through all records so projects with >1,000 parts are fully loaded.
  // Keyed by part_mark so subsequent lookup is O(1) per incoming row.
  // -------------------------------------------------------------------------
  const existingParts = await fetchAllRows<{
    id: string;
    part_mark: string;
    status: string;
    profile: string;
    quantity: number;
  }>((from, to) =>
    ctx.sb.from("parts")
      .select("id, part_mark, status, profile, quantity")
      .eq("company_id", ctx.user.company_id)
      .eq("project_id", body.project_id)
      .order("id", { ascending: true })
      .range(from, to)
  );

  const existingMap = new Map<string, { id: string; status: string; profile: string; quantity: number }>(
    existingParts.map((p) => [
      String(p.part_mark).trim(),
      {
        id: String(p.id),
        status: String(p.status ?? ""),
        profile: String(p.profile ?? ""),
        quantity: Number(p.quantity ?? 1),
      },
    ]),
  );

  // -------------------------------------------------------------------------
  // Classify all rows in-memory — zero DB round-trips in this loop.
  // Tracks pending inserts and updates in maps keyed by part_mark / part id.
  // If the same part_mark appears across multiple rows in the uploaded file:
  //   1. Quantities are merged (summed).
  //   2. Metadata (assembly, profile, name, grade, length, weight, phase, heat)
  //      is enriched with any non-empty values.
  //   3. A notice is logged in `skipped` so users know rows were merged.
  // This completely prevents PostgreSQL duplicate key violations on
  // `parts_company_mark_idx` (unique on company_id, project_id, part_mark).
  // -------------------------------------------------------------------------
  const pendingInsertMap = new Map<string, Record<string, unknown>>();
  const pendingUpdateMap = new Map<string, { id: string; part_mark: string; patch: Record<string, unknown> }>();
  const skipped: { row: number; part_mark?: string; reason: string }[] = [];
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < lookups.length; i++) {
    const lookup = lookups[i]!;
    const rawMark = pickFrom(lookup, "part_mark");
    const part_mark = rawMark?.trim();
    if (!part_mark) {
      errors.push({ row: i, reason: "missing part mark (Mark / Part Mark column not found or empty)" });
      continue;
    }

    // Stored verbatim as text — no unit parsing/conversion.
    const length = pickFrom(lookup, "length") ?? null;
    const weightRaw = Number(pickFrom(lookup, "weight"));
    const weight = isFinite(weightRaw) && weightRaw > 0
      ? (units === "metric" ? kgToLb(weightRaw) : weightRaw)
      : null;
    const rawQty = Number(pickFrom(lookup, "quantity") ?? "1");
    const incomingQty = isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
    const incomingProfile = pickFrom(lookup, "profile") ?? null;
    const incomingName = pickFrom(lookup, "name") ?? null;
    const incomingGrade = pickFrom(lookup, "grade") ?? null;
    const incomingPhase = pickFrom(lookup, "phase") ?? null;
    const incomingHeat = pickFrom(lookup, "heat_number") ?? null;
    const incomingAsm = pickFrom(lookup, "assembly_mark") ?? null;

    const existing = existingMap.get(part_mark);

    if (existing) {
      const progressed = ["in_progress", "complete", "shipped"].includes(existing.status);
      const profileChanged = incomingProfile && existing.profile !== incomingProfile;

      // Block geometry changes on parts already in production.
      // Profile is the single field that drives CNC and cutting — changing it
      // after the part has been cut or welded is a real shop-floor hazard.
      if (progressed && profileChanged) {
        skipped.push({ row: i, part_mark, reason: "part has progressed — profile change blocked" });
        continue;
      }

      const existingUpdate = pendingUpdateMap.get(existing.id);
      if (existingUpdate) {
        // Seen earlier in this same import file — merge quantity and metadata
        existingUpdate.patch.quantity = (Number(existingUpdate.patch.quantity) || 0) + incomingQty;
        if (!existingUpdate.patch.name && incomingName) existingUpdate.patch.name = incomingName;
        if (!existingUpdate.patch.grade && incomingGrade) existingUpdate.patch.grade = incomingGrade;
        if (!existingUpdate.patch.heat_number && incomingHeat) existingUpdate.patch.heat_number = incomingHeat;
        if (!existingUpdate.patch.phase && incomingPhase) existingUpdate.patch.phase = incomingPhase;
        if (!progressed) {
          if (incomingProfile) existingUpdate.patch.profile = incomingProfile;
          if (length !== null) existingUpdate.patch.length = length;
          if (weight !== null) existingUpdate.patch.weight = weight;
        }
        skipped.push({
          row: i,
          part_mark,
          reason: `duplicate part mark in file — merged quantity (+${incomingQty}) with earlier row`,
        });
      } else {
        // First occurrence in this file for an existing part.
        const patch: Record<string, unknown> = {
          name: incomingName,
          grade: incomingGrade,
          heat_number: incomingHeat,
          phase: incomingPhase,
          quantity: incomingQty,
        };
        if (!progressed) {
          if (incomingProfile) patch.profile = incomingProfile;
          if (length !== null) patch.length = length;
          if (weight !== null) patch.weight = weight;
        }
        pendingUpdateMap.set(existing.id, { id: existing.id, part_mark, patch });
      }
    } else {
      const existingPending = pendingInsertMap.get(part_mark);
      if (existingPending) {
        // Seen earlier in this same import file for a new part — merge quantity and metadata
        existingPending.quantity = (Number(existingPending.quantity) || 0) + incomingQty;
        if (!existingPending.assembly_mark && incomingAsm) existingPending.assembly_mark = incomingAsm;
        if ((!existingPending.profile || existingPending.profile === "UNKNOWN") && incomingProfile) {
          existingPending.profile = incomingProfile;
        }
        if (!existingPending.name && incomingName) existingPending.name = incomingName;
        if (!existingPending.grade && incomingGrade) existingPending.grade = incomingGrade;
        if (existingPending.length == null && length !== null) existingPending.length = length;
        if (existingPending.weight == null && weight !== null) existingPending.weight = weight;
        if (!existingPending.phase && incomingPhase) existingPending.phase = incomingPhase;
        if (!existingPending.heat_number && incomingHeat) existingPending.heat_number = incomingHeat;

        skipped.push({
          row: i,
          part_mark,
          reason: `duplicate part mark in file — merged quantity (+${incomingQty}) with earlier row`,
        });
      } else {
        pendingInsertMap.set(part_mark, {
          company_id: ctx.user.company_id,
          project_id: body.project_id,
          part_mark,
          assembly_mark: incomingAsm,
          profile: incomingProfile ?? "UNKNOWN",
          name: incomingName,
          grade: incomingGrade,
          length,
          weight,
          quantity: incomingQty,
          phase: incomingPhase,
          heat_number: incomingHeat,
          status: "not_started",
        });
      }
    }
  }

  const toInsert = Array.from(pendingInsertMap.values());
  const toUpdate = Array.from(pendingUpdateMap.values());

  // -------------------------------------------------------------------------
  // QUERIES 2…K — Batch UPSERT new parts in INSERT_CHUNK-row chunks.
  // One round-trip per chunk; typically just 1 query for a normal BOM.
  // Using upsert with onConflict on (company_id, project_id, part_mark) provides
  // an additional layer of protection against race conditions and duplicates.
  // -------------------------------------------------------------------------
  const insertedRows: Record<string, unknown>[] = [];
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    const { data, error } = await ctx.sb.from("parts")
      .upsert(chunk, {
        onConflict: "company_id,project_id,part_mark",
        ignoreDuplicates: false,
      })
      .select();
    if (error) {
      console.error("Batch upsert parts error:", error);
      errors.push({ row: i, reason: error.message });
    } else if (data) {
      insertedRows.push(...(data as Record<string, unknown>[]));
    }
  }

  // -------------------------------------------------------------------------
  // QUERIES K+1…M — Batch UPDATE existing parts.
  // Supabase JS doesn't support multi-row UPDATE with different per-row values
  // natively, so we parallelise them in chunks of UPDATE_CHUNK using
  // Promise.all — still far fewer round-trips than the old one-at-a-time loop.
  // -------------------------------------------------------------------------
  const updatedRows: Record<string, unknown>[] = [];
  for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK) {
    const chunk = toUpdate.slice(i, i + UPDATE_CHUNK);
    const results = await Promise.all(
      chunk.map(({ id, patch }) =>
        ctx.sb.from("parts").update(patch).eq("id", id).select().single()
      ),
    );
    for (const { data } of results) {
      if (data) updatedRows.push(data as Record<string, unknown>);
    }
  }

  // -------------------------------------------------------------------------
  // QUERY M+1 — Load all project parts with pagination to compute assembly
  // aggregates in-memory. Replaces 6 queries × N unique assembly marks.
  // -------------------------------------------------------------------------
  const allProjectParts = await fetchAllRows<{
    assembly_mark: string | null;
    profile: string | null;
    weight: number | null;
    quantity: number | null;
    status: string | null;
  }>((from, to) =>
    ctx.sb.from("parts")
      .select("assembly_mark, profile, weight, quantity, status")
      .eq("company_id", ctx.user.company_id)
      .eq("project_id", body.project_id)
      .order("id", { ascending: true })
      .range(from, to)
  );

  // Aggregate assembly stats entirely in-memory
  interface AsmStats {
    total: number;
    completed: number;
    totalWeight: number;
    sampleProfile: string;
  }
  const asmStatsMap = new Map<string, AsmStats>();
  for (const p of allProjectParts ?? []) {
    const asm = p.assembly_mark ? String(p.assembly_mark).trim() : null;
    if (!asm) continue;
    const stats = asmStatsMap.get(asm) ?? { total: 0, completed: 0, totalWeight: 0, sampleProfile: "" };
    const qty = Number(p.quantity) || 1;
    stats.total += qty;
    if (["complete", "shipped"].includes(String(p.status ?? ""))) {
      stats.completed += qty;
    }
    stats.totalWeight += (Number(p.weight) || 0) * qty;
    if (!stats.sampleProfile && p.profile) stats.sampleProfile = String(p.profile);
    asmStatsMap.set(asm, stats);
  }

  // Build upsert rows for assemblies
  const assemblyUpsertRows = Array.from(asmStatsMap.entries()).map(([asm_mark, stats]) => {
    const asmStatus = stats.total > 0 && stats.completed >= stats.total ? "complete"
      : stats.completed > 0 ? "in_progress"
      : "not_started";
    return {
      company_id: ctx.user.company_id,
      project_id: body.project_id,
      assembly_mark: asm_mark,
      description: stats.sampleProfile
        ? `${stats.sampleProfile} assembly`
        : `Assembly ${asm_mark}`,
      total_weight: Math.round(stats.totalWeight * 100) / 100,
      total_parts: stats.total,
      completed_parts: stats.completed,
      status: asmStatus,
    };
  });

  // -------------------------------------------------------------------------
  // QUERY M+2 — Fetch existing assembly marks to count creates vs updates,
  // then QUERY M+3 — upsert assemblies in one batch.
  // -------------------------------------------------------------------------
  let assembliesCreated = 0;
  let assembliesUpdated = 0;
  if (assemblyUpsertRows.length > 0) {
    const { data: existingAsms } = await ctx.sb.from("assemblies")
      .select("assembly_mark")
      .eq("company_id", ctx.user.company_id)
      .eq("project_id", body.project_id)
      .in("assembly_mark", assemblyUpsertRows.map((r) => r.assembly_mark));

    const existingAsmSet = new Set((existingAsms ?? []).map((a) => String(a.assembly_mark)));
    for (const r of assemblyUpsertRows) {
      if (existingAsmSet.has(r.assembly_mark)) assembliesUpdated++;
      else assembliesCreated++;
    }

    for (let i = 0; i < assemblyUpsertRows.length; i += INSERT_CHUNK) {
      await ctx.sb.from("assemblies")
        .upsert(assemblyUpsertRows.slice(i, i + INSERT_CHUNK), {
          onConflict: "company_id,project_id,assembly_mark",
          ignoreDuplicates: false,
        });
    }
  }

  // -------------------------------------------------------------------------
  // Drawings: derive refs from assembly marks in-memory (no extra query).
  // -------------------------------------------------------------------------
  const drawingRefs = new Map<string, { parts_count: number; title: string }>();
  for (const lookup of lookups) {
    const asm = pickFrom(lookup, "assembly_mark");
    if (!asm) continue;
    // Extract drawing number from assembly mark prefix:
    // "A-204" → "A-SERIES", "B-108" → "B-SERIES"
    const match = asm.match(/^([A-Z]+)-?(\d)/i);
    if (match) {
      const drawingNum = `${match[1].toUpperCase()}-SERIES`;
      const existing = drawingRefs.get(drawingNum);
      const profile = pickFrom(lookup, "profile") || "";
      const name = pickFrom(lookup, "name") || "";
      const desc = name || profile || asm;
      if (existing) {
        existing.parts_count++;
      } else {
        drawingRefs.set(drawingNum, {
          parts_count: 1,
          title: `${desc} — ${asm} series shop drawings`,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // QUERY M+4 — Fetch existing drawing numbers, then QUERY M+5 — upsert
  // drawings in one batch. Total queries for the entire import: ~6 + chunks.
  // -------------------------------------------------------------------------
  let drawingsCreated = 0;
  if (drawingRefs.size > 0) {
    const drawingUpsertRows = Array.from(drawingRefs.entries()).map(([drawingNumber, info]) => ({
      company_id: ctx.user.company_id,
      project_id: body.project_id,
      drawing_number: drawingNumber,
      revision: "A",
      title: info.title,
      type: "shop",
      status: "in_progress",
      current_revision: true,
      parts_count: info.parts_count,
    }));

    const { data: existingDwgs } = await ctx.sb.from("drawings")
      .select("drawing_number")
      .eq("company_id", ctx.user.company_id)
      .eq("project_id", body.project_id)
      .in("drawing_number", drawingUpsertRows.map((r) => r.drawing_number));

    const existingDwgSet = new Set((existingDwgs ?? []).map((d) => String(d.drawing_number)));
    drawingsCreated = drawingUpsertRows.filter((r) => !existingDwgSet.has(r.drawing_number)).length;

    for (let i = 0; i < drawingUpsertRows.length; i += INSERT_CHUNK) {
      await ctx.sb.from("drawings")
        .upsert(drawingUpsertRows.slice(i, i + INSERT_CHUNK), {
          onConflict: "company_id,project_id,drawing_number,revision",
          ignoreDuplicates: false,
        });
    }
  }

  // -------------------------------------------------------------------------
  // Material Requirements sync (internally batched — 2 bulk queries)
  // -------------------------------------------------------------------------
  const mrSync = await syncMaterialRequirements(ctx, body.project_id);

  await writeAudit(ctx, {
    action: "import",
    table_name: "parts",
    new_values: {
      project_id: body.project_id,
      inserted: insertedRows.length,
      skipped: skipped.length,
      errors: errors.length,
      assemblies_created: assembliesCreated,
      assemblies_updated: assembliesUpdated,
      drawings_created: drawingsCreated,
      mr_created: mrSync.created,
      mr_updated: mrSync.updated,
    },
  });
  await writeActivity(ctx, {
    action: `imported ${insertedRows.length} parts, updated ${updatedRows.length}, created ${assembliesCreated} assemblies & ${drawingsCreated} drawings, ${mrSync.created} MRs created, ${mrSync.updated} updated`,
    entity_type: "projects",
    entity_id: body.project_id,
    entity_label: project.name as string,
    metadata: {
      units,
      inserted: insertedRows.length,
      updated: updatedRows.length,
      skipped: skipped.length,
      errors: errors.length,
      mr_created: mrSync.created,
      mr_updated: mrSync.updated,
      assemblies_created: assembliesCreated,
      assemblies_updated: assembliesUpdated,
      drawings_created: drawingsCreated,
    },
  });

  return ok({
    summary: {
      inserted: insertedRows.length,
      updated: updatedRows.length,
      skipped: skipped.length,
      errors: errors.length,
      mr_created: mrSync.created,
      mr_updated: mrSync.updated,
      units,
      assemblies_created: assembliesCreated,
      assemblies_updated: assembliesUpdated,
      drawings_created: drawingsCreated,
    },
    skipped,
    errors,
    mapping: {
      matched_fields: Array.from(matchedFields).sort(),
      unmapped_headers: Array.from(unmappedHeaders).sort(),
    },
  });
}

/**
 * Automatically syncs Material Requirements after parts are imported or modified for a project.
 * Groups all project parts by (profile, name, grade, length), checks existing
 * active RFQs / awarded MRs, and creates new open MRs for any incremental demand.
 */
export async function syncMaterialRequirements(ctx: Ctx, projectId: string): Promise<{ created: number; updated: number }> {
  try {
    const allParts = await fetchAllRows<{
      profile: string | null;
      name: string | null;
      grade: string | null;
      length: string | null;
      quantity: number | null;
      part_mark: string | null;
    }>((from, to) =>
      ctx.sbAdmin
        .from("parts")
        .select("profile, name, grade, length, quantity, part_mark")
        .eq("company_id", ctx.user.company_id)
        .eq("project_id", projectId)
        .order("id", { ascending: true })
        .range(from, to)
    );

    if (!allParts || allParts.length === 0) {
      return { created: 0, updated: 0 };
    }

    interface GroupData {
      profile: string;
      name: string | null;
      grade: string | null;
      length: string | null;
      totalQty: number;
      marksSet: Set<string>;
    }

    const groups = new Map<string, GroupData>();
    for (const p of allParts) {
      const profile = String(p.profile ?? "").trim();
      const qty = Number(p.quantity) || 0;
      if (!profile || qty <= 0) continue;

      const name = p.name ? String(p.name).trim() : "";
      const grade = p.grade ? String(p.grade).trim() : "";
      const length = p.length !== null && p.length !== undefined ? String(p.length).trim() : "";
      const mark = p.part_mark ? String(p.part_mark).trim() : "";

      const key = [
        profile.toLowerCase(),
        name.toLowerCase(),
        grade.toLowerCase(),
        length.toLowerCase(),
      ].join("\x01");

      const existing = groups.get(key);
      if (existing) {
        existing.totalQty += qty;
        if (mark) existing.marksSet.add(mark);
      } else {
        groups.set(key, {
          profile,
          name: name || null,
          grade: grade || null,
          length: length || null,
          totalQty: qty,
          marksSet: new Set(mark ? [mark] : []),
        });
      }
    }

    const existingMrs = await fetchAllRows<{
      id: string;
      profile: string | null;
      name: string | null;
      grade: string | null;
      length: string | null;
      quantity: number | null;
      status: string;
      notes: string | null;
    }>((from, to) =>
      ctx.sbAdmin
        .from("material_requirements")
        .select("id, profile, name, grade, length, quantity, status, notes")
        .eq("company_id", ctx.user.company_id)
        .eq("project_id", projectId)
        .order("id", { ascending: true })
        .range(from, to)
    );

    const toDelete: string[] = [];
    const toUpdate: { id: string; patch: { quantity: number; notes: string | null } }[] = [];
    const toInsert: { group: GroupData; unmetDemand: number; notes: string | null }[] = [];

    for (const group of groups.values()) {
      const matchingMrs = existingMrs.filter((m) => {
        const matchProfile = String(m.profile ?? "").trim().toLowerCase() === group.profile.toLowerCase();
        const matchName = String(m.name ?? "").trim().toLowerCase() === (group.name ?? "").toLowerCase();
        const matchGrade = String(m.grade ?? "").trim().toLowerCase() === (group.grade ?? "").toLowerCase();
        const matchLength = String(m.length ?? "").trim().toLowerCase() === (group.length ?? "").toLowerCase();
        return matchProfile && matchName && matchGrade && matchLength;
      });

      // Sum quantity already covered in active RFQs, awarded quotes, or fulfilled orders
      const coveredQty = matchingMrs
        .filter((m) => ["rfq_created", "awarded", "fulfilled"].includes(m.status))
        .reduce((sum, m) => sum + Number(m.quantity), 0);

      // Look for an existing MR that is still in 'open' status
      const openMr = matchingMrs.find((m) => m.status === "open");

      // Unmet incremental demand
      const unmetDemand = Math.max(0, group.totalQty - coveredQty);

      let notes: string | null = null;
      if (group.marksSet.size > 0) {
        const fullMarks = Array.from(group.marksSet).join(", ");
        notes = fullMarks.length > 490 ? `${fullMarks.slice(0, 470)}… (${group.marksSet.size} marks)` : fullMarks;
      }

      if (unmetDemand > 0) {
        if (openMr) {
          if (Number(openMr.quantity) !== unmetDemand || openMr.notes !== notes) {
            toUpdate.push({
              id: openMr.id,
              patch: { quantity: unmetDemand, notes },
            });
          }
        } else {
          toInsert.push({ group, unmetDemand, notes });
        }
      } else if (openMr && unmetDemand === 0) {
        toDelete.push(openMr.id);
      }
    }

    // 1. Batch DELETE open MRs that are no longer needed (unmetDemand dropped to 0)
    if (toDelete.length > 0) {
      const { error: delErr } = await ctx.sbAdmin.from("material_requirements").delete().in("id", toDelete);
      if (delErr) console.error("Failed to delete stale MRs:", delErr);
    }

    // 2. Parallel chunked UPDATE for existing open MRs
    let updatedCount = 0;
    for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK) {
      const chunk = toUpdate.slice(i, i + UPDATE_CHUNK);
      const results = await Promise.all(
        chunk.map(({ id, patch }) =>
          ctx.sbAdmin.from("material_requirements").update(patch).eq("id", id)
        )
      );
      for (const res of results) {
        if (!res.error) updatedCount++;
        else console.error("Error updating material requirement:", res.error);
      }
    }

    // 3. Batch sequence generation & INSERT for new MRs
    let createdCount = 0;
    if (toInsert.length > 0) {
      const seqResults: (string | null)[] = [];
      const SEQ_CONCURRENCY = 25;
      for (let i = 0; i < toInsert.length; i += SEQ_CONCURRENCY) {
        const chunk = toInsert.slice(i, i + SEQ_CONCURRENCY);
        const chunkRes = await Promise.all(
          chunk.map(() =>
            ctx.sbAdmin.rpc("next_sequence_number", {
              p_company_id: ctx.user.company_id,
              p_table_name: "material_requirements",
              p_prefix: "MR",
              p_width: 4,
            })
          )
        );
        for (const r of chunkRes) {
          if (r.data && typeof r.data === "string") {
            seqResults.push(r.data);
          } else {
            console.error("Failed to generate MR sequence number:", r.error);
            seqResults.push(null);
          }
        }
      }

      const insertRows: Record<string, unknown>[] = [];
      for (let i = 0; i < toInsert.length; i++) {
        const seq = seqResults[i];
        if (!seq) continue;
        const item = toInsert[i]!;
        insertRows.push({
          company_id: ctx.user.company_id,
          project_id: projectId,
          mr_number: seq,
          profile: item.group.profile,
          name: item.group.name,
          grade: item.group.grade,
          quantity: item.unmetDemand,
          length: item.group.length,
          notes: item.notes,
          status: "open",
        });
      }

      for (let i = 0; i < insertRows.length; i += INSERT_CHUNK) {
        const chunk = insertRows.slice(i, i + INSERT_CHUNK);
        const { error: insErr } = await ctx.sbAdmin.from("material_requirements").insert(chunk);
        if (insErr) {
          console.error("Failed to batch insert material requirements:", insErr);
        } else {
          createdCount += chunk.length;
        }
      }
    }

    return { created: createdCount, updated: updatedCount };
  } catch (err) {
    console.error("Unhandled error in syncMaterialRequirements:", err);
    return { created: 0, updated: 0 };
  }
}
