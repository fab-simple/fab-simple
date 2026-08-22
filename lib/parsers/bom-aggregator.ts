// =============================================================================
// BOM Aggregation Engine
//
// Converts raw parsed BOM data (from KISS, EJE, or CSV/XLSX) into the
// estimate's materials_breakdown[] format, computes unique piece marks,
// auto-detects connection complexity, and generates bolt cost line items.
//
// Pipeline:
//   ParsedBomResult → aggregate() → AggregatedEstimate
// =============================================================================

import type {
  ParsedBomResult,
  ParsedMember,
  AggregatedEstimate,
  AggregatedMaterial,
  AdditionalCost,
  ShapeCategory,
} from "./types";
import { classifyProfile, defaultAdditionalCosts, calculateAiscWeight, parseLengthToInches, buildCleanSection } from "./types";
import { parseExcelRows, parseCsvRows, isExcelFile, autoDetectMapping, normHeader } from "./bom-parse-utils";
import { parseKissFile } from "./kiss-parser";
import { parseEjeFile } from "./eje-parser";

// ---------------------------------------------------------------------------
// Default material pricing ($/ton) by shape category
// ---------------------------------------------------------------------------

const DEFAULT_PRICING: Record<ShapeCategory, number> = {
  "Wide Flange": 1300,
  "HSS / Tube": 1450,
  "Angle": 1200,
  "Plate": 1100,
  "Channel": 1250,
  "Tee": 1350,
  "Pipe": 1500,
  "Misc Metal": 1800,
};

// ---------------------------------------------------------------------------
// Standard bolt pricing by diameter
// ---------------------------------------------------------------------------

const BOLT_PRICING: Record<string, number> = {
  "1/2": 0.75,
  "5/8": 1.00,
  "3/4": 1.50,
  "7/8": 2.25,
  "1": 3.00,
  "1-1/8": 3.75,
  "1-1/4": 4.50,
};

function boltUnitPrice(diameter: string): number {
  // Try exact match first
  if (BOLT_PRICING[diameter]) return BOLT_PRICING[diameter];
  // Try parsing as decimal and finding closest
  const dec = parseFloat(diameter);
  if (dec <= 0.5) return 0.75;
  if (dec <= 0.625) return 1.00;
  if (dec <= 0.75) return 1.50;
  if (dec <= 0.875) return 2.25;
  if (dec <= 1.0) return 3.00;
  if (dec <= 1.125) return 3.75;
  return 4.50;
}

// ---------------------------------------------------------------------------
// File parsing dispatcher
// ---------------------------------------------------------------------------

/**
 * Parse any supported file format and return a unified ParsedBomResult.
 */
export async function parseFile(file: File): Promise<ParsedBomResult> {
  const name = file.name.toLowerCase();

  // KISS file (.kss)
  if (name.endsWith(".kss") || name.endsWith(".kis")) {
    const text = await file.text();
    return parseKissFile(text, file.name);
  }

  // EJE file (.eje)
  if (name.endsWith(".eje")) {
    const text = await file.text();
    return parseEjeFile(text, file.name);
  }

  // Excel file (.xlsx / .xls)
  if (isExcelFile(file)) {
    return parseCsvXlsxToBom(file, "xlsx");
  }

  // CSV / TSV / TXT
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    // Peek at content to detect if it's actually a KISS file
    const text = await file.text();
    const firstLine = text.split(/\r?\n/)[0]?.trim().toUpperCase() ?? "";
    if (firstLine.startsWith("KISS")) {
      return parseKissFile(text, file.name);
    }
    return parseCsvXlsxToBom(file, "csv");
  }

  throw new Error(`Unsupported file format: ${file.name}. Supported: .kss, .eje, .csv, .tsv, .xlsx, .xls`);
}

/**
 * Convert CSV/XLSX rows into a ParsedBomResult by auto-mapping columns.
 */
async function parseCsvXlsxToBom(
  file: File,
  source: "csv" | "xlsx",
): Promise<ParsedBomResult> {
  const result: ParsedBomResult = {
    source,
    filename: file.name,
    project: { jobNumber: "", jobName: "", customer: "", revision: "", date: "" },
    members: [],
    plates: [],
    bolts: [],
    welds: [],
    hardware: [],
    warnings: [],
    errors: [],
  };

  const rows = source === "xlsx"
    ? await parseExcelRows(file)
    : await parseCsvRows(file);

  if (rows.length === 0) {
    result.errors.push("No data rows found in file.");
    return result;
  }

  const headers = Object.keys(rows[0] ?? {});
  const mapping = autoDetectMapping(headers);

  if (!mapping.part_mark && !mapping.profile) {
    result.warnings.push("Could not auto-detect Part Mark or Profile columns. Data may be incomplete.");
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;

    try {
      const pieceMark = mapping.part_mark ? (row[mapping.part_mark] ?? "").trim() : `ROW_${i + 1}`;
      const profile = mapping.profile ? (row[mapping.profile] ?? "").trim() : "";
      const qty = mapping.quantity ? (parseInt(row[mapping.quantity] ?? "1", 10) || 1) : 1;
      const grade = mapping.grade ? (row[mapping.grade] ?? "").trim() : "";
      const lengthStr = mapping.length ? (row[mapping.length] ?? "0").trim() : "0";
      const weightStr = mapping.weight ? (row[mapping.weight] ?? "0").trim() : "0";
      const assemblyMark = mapping.assembly_mark ? (row[mapping.assembly_mark] ?? "").trim() : "";
      const name = mapping.name ? (row[mapping.name] ?? "").trim() : "";

      let length = parseLengthToInches(lengthStr);
      let weight = parseFloat(weightStr) || 0;

      const { section, category } = buildCleanSection("", profile);

      // Filter out bolt and hardware records from members
      const isBoltOrHardware =
        /^(SB|FB|BOLT|NUT|WASHER|HDW|HARDWARE|ANCHOR|AB|STUD|ROD|FASTENER)$/i.test(profile) ||
        /\b(A325|A490|A307|F3125)\b/i.test(profile) ||
        /\b(BOLT|NUT|WASHER|ANCHOR)\b/i.test(name);

      if (isBoltOrHardware) {
        result.bolts.push({
          diameter: profile.match(/(\d+\/\d+|\d+\.?\d*)/)?.[1] || "3/4",
          length: length,
          grade: grade || "A325",
          finish: "",
          quantity: qty,
        });
        continue; // Exclude bolt row from members & steel weight
      }

      // If weight is 0 or missing, calculate using AISC shape weight calculator
      let weightSource: "file" | "calculated" = "file";
      let unitWeightLbsPerFt: number | undefined = undefined;
      const calc = calculateAiscWeight(section, length, category);
      unitWeightLbsPerFt = calc.unitWeightLbsPerFt;

      if (weight <= 0) {
        weight = calc.weightLbs;
        weightSource = "calculated";
      } else if (qty > 1 && calc.weightLbs > 0) {
        // Sanity check if file weight was total line weight vs per-piece
        const diffPerPiece = Math.abs(weight - calc.weightLbs);
        const diffTotalLine = Math.abs(weight - (calc.weightLbs * qty));
        if (diffTotalLine < diffPerPiece * 0.5) {
          weight = Math.round((weight / qty) * 10) / 10;
        }
      }

      const member: ParsedMember = {
        pieceMark,
        assemblyMark,
        section: profile,
        materialType: profile.split(/\d/)[0] ?? "",
        grade,
        length,
        weight,
        weightSource,
        unitWeightLbsPerFt,
        quantity: qty,
        finish: "",
        notes: name,
        category,
      };

      result.members.push(member);

      // If it's a plate, also add to plates
      if (category === "Plate") {
        result.plates.push({
          plateMark: pieceMark,
          thickness: 0,
          width: 0,
          length,
          grade,
          quantity: qty,
          weight,
        });
      }
    } catch (e) {
      result.errors.push(`Row ${i + 1}: ${(e as Error).message}`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Aggregation: ParsedBomResult → AggregatedEstimate
// ---------------------------------------------------------------------------

/**
 * Aggregate a parsed BOM into the format needed by the estimate form.
 *
 * Groups members by shape category, sums tons, counts unique marks,
 * detects connection complexity, and generates bolt cost line items.
 */
export function aggregateBom(parsed: ParsedBomResult): AggregatedEstimate {
  // Group members by shape category
  const groups = new Map<string, {
    totalWeightLbs: number;
    pieceCount: number;
    uniqueMarks: Set<string>;
  }>();

  for (const m of parsed.members) {
    const cat = m.category;
    if (!groups.has(cat)) {
      groups.set(cat, { totalWeightLbs: 0, pieceCount: 0, uniqueMarks: new Set() });
    }
    const g = groups.get(cat)!;

    // Weight: use per-piece weight × qty, or estimate from length if no weight
    const memberWeight = m.weight > 0
      ? m.weight * m.quantity
      : estimateWeight(m);

    g.totalWeightLbs += memberWeight;
    g.pieceCount += m.quantity;
    g.uniqueMarks.add(m.pieceMark);
  }

  // Build materials_breakdown
  const materials_breakdown: AggregatedMaterial[] = [];
  let totalWeightLbs = 0;

  for (const [cat, data] of groups) {
    const tons = data.totalWeightLbs / 2000;
    totalWeightLbs += data.totalWeightLbs;

    materials_breakdown.push({
      shape: cat,
      tons: Math.round(tons * 100) / 100,
      price_per_ton: DEFAULT_PRICING[cat as ShapeCategory] ?? 1500,
      pieceCount: data.pieceCount,
      uniqueMarks: data.uniqueMarks.size,
    });
  }

  // Sort: heaviest categories first
  materials_breakdown.sort((a, b) => b.tons - a.tons);

  // Count total unique piece marks across all categories
  const allMarks = new Set<string>();
  for (const m of parsed.members) {
    allMarks.add(m.pieceMark);
  }

  // Detect connection complexity from parsed data
  const complexity = detectComplexity(parsed);

  // Build additional costs with bolt data if available
  const additionalCosts = buildAdditionalCosts(parsed);

  // Build import summary
  const importSummary = {
    source: parsed.source,
    filename: parsed.filename,
    parsed_at: new Date().toISOString(),
    member_count: parsed.members.length,
    plate_count: parsed.plates.length,
    bolt_count: parsed.bolts.reduce((sum, b) => sum + b.quantity, 0),
    total_weight_lbs: Math.round(totalWeightLbs),
  };

  return {
    project_name: parsed.project.jobName || parsed.project.jobNumber || "",
    gc_name: parsed.project.customer || "",
    materials_breakdown,
    unique_piece_marks: allMarks.size,
    connection_complexity: complexity,
    additional_costs: additionalCosts,
    import_summary: importSummary,
  };
}

// ---------------------------------------------------------------------------
// Connection complexity detection
// ---------------------------------------------------------------------------

function detectComplexity(parsed: ParsedBomResult): string {
  // Check welds for CJP/PJP → moment connections
  const hasMomentWelds = parsed.welds.some(
    (w) => w.weldType === "CJP" || w.weldType === "PJP",
  );
  if (hasMomentWelds) return "moment_connections";

  // Check member notes for indicators
  const allNotes = parsed.members.map((m) => m.notes.toUpperCase()).join(" ");
  if (allNotes.includes("MOMENT") || allNotes.includes("RIGID")) return "moment_connections";
  if (allNotes.includes("STAIR") || allNotes.includes("RAIL") || allNotes.includes("HANDRAIL")) return "heavy_misc";

  // Check plate-to-member ratio (high ratio → complex connections)
  const plateWeight = parsed.plates.reduce((sum, p) => sum + (p.weight * p.quantity), 0);
  const memberWeight = parsed.members.reduce(
    (sum, m) => sum + (m.weight > 0 ? m.weight * m.quantity : 0),
    0,
  );

  if (memberWeight > 0) {
    const plateRatio = plateWeight / memberWeight;
    if (plateRatio > 0.3) return "heavy_misc";
    if (plateRatio > 0.15) return "moment_connections";
    if (plateRatio > 0.08) return "mixed";
  }

  return "simple_shear";
}

// ---------------------------------------------------------------------------
// Weight estimation (fallback when weight column is missing)
// ---------------------------------------------------------------------------

/**
 * Rough weight estimation using AISC standard weights per linear foot.
 * This is a fallback when the file doesn't include per-piece weights.
 */
function estimateWeight(m: ParsedMember): number {
  const calc = calculateAiscWeight(m.section, m.length, m.category);
  return calc.weightLbs * m.quantity;
}

// ---------------------------------------------------------------------------
// Additional costs from bolt data
// ---------------------------------------------------------------------------

function buildAdditionalCosts(parsed: ParsedBomResult): AdditionalCost[] {
  const costs = defaultAdditionalCosts();

  // If bolts were found in the file, compute estimated bolt cost
  if (parsed.bolts.length > 0) {
    let totalBoltCost = 0;
    for (const bolt of parsed.bolts) {
      totalBoltCost += bolt.quantity * boltUnitPrice(bolt.diameter);
    }

    // Update the "Bolts & Connection Hardware" line item
    const boltLine = costs.find((c) => c.label.includes("Bolts"));
    if (boltLine) {
      boltLine.amount = Math.round(totalBoltCost);
      boltLine.description = `Auto-estimated from ${parsed.bolts.reduce((s, b) => s + b.quantity, 0)} bolts in ${parsed.source.toUpperCase()} file`;
    }
  }

  return costs;
}

// ---------------------------------------------------------------------------
// Full pipeline: File → ParsedBomResult → AggregatedEstimate
// ---------------------------------------------------------------------------

/**
 * Complete pipeline: parse a file and aggregate into estimate format.
 */
export async function importFileForEstimate(file: File): Promise<{
  parsed: ParsedBomResult;
  aggregated: AggregatedEstimate;
}> {
  const parsed = await parseFile(file);
  const aggregated = aggregateBom(parsed);
  return { parsed, aggregated };
}
