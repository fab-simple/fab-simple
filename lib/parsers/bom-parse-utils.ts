// =============================================================================
// Shared BOM parsing utilities for CSV / XLSX files
//
// Extracted from app/(dashboard)/dashboard/import/page.tsx so both the Import
// module and the Estimating module can reuse the same proven parsing logic.
//
// Handles:
//   - Tekla Structures BOM exports (CSV / XLSX with metadata preamble rows)
//   - SDS2 BOM exports
//   - Generic steel BOM spreadsheets
// =============================================================================

import Papa from "papaparse";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Accepted file extensions for BOM uploads. */
export const BOM_ACCEPT_EXT = ".csv,.tsv,.txt,.xlsx,.xls";

/** Accepted MIME types for BOM uploads. */
export const BOM_ACCEPT_MIME =
  "text/csv,text/tab-separated-values,text/plain," +
  "application/vnd.ms-excel," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Full accept string for file inputs. */
export const BOM_ACCEPT = `${BOM_ACCEPT_EXT},${BOM_ACCEPT_MIME}`;

/**
 * Keyword hints used to auto-detect which row in the uploaded file is the
 * actual header row. Tekla/SDS2 exports prepend metadata rows (PROJECT NAME,
 * JOB NUMBER, Date, Time). We scan the first 30 rows and pick the one with
 * the most keyword matches (≥2 required).
 */
export const HEADER_HINTS = new Set([
  // Part identification
  "mark", "partmark", "piecemark", "pieceid", "partid", "partpos", "membermark",
  "assembly", "assemblymark", "assemblypos", "mainpart",
  // Member descriptor
  "name", "description", "desc", "membertype", "membername", "type",
  // Section / profile
  "profile", "section", "shape", "size", "profilename", "sectionsize",
  // Material
  "material", "grade", "spec", "matl", "materialgrade",
  // Length
  "length", "len", "lengthmm", "lengthin", "cutlength",
  // Weight
  "weight", "wt", "partweight", "part weight", "unitweight", "unit weight",
  "weightlbs", "weightkg", "weightea",
  "extweight", "extendedweight", "totalweight",
  // Surface area / paint
  "extarea", "surfacearea", "paintarea",
  // Quantity
  "qty", "quantity", "count", "pcs", "pieces", "noofpieces",
  // Scheduling
  "phase", "lot", "sequence", "seq", "lotnumber",
  // Traceability
  "heat", "heatno", "heatnumber", "heat number",
  // Finish
  "finish", "paint", "coating",
]);

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/** Normalize a header string for comparison (lowercase, strip non-alphanum). */
export function normHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Check if a file is an Excel file by extension. */
export function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls");
}

/** Drop rows where every cell is blank. */
export function dropBlankRows(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter((r) => Object.values(r).some((v) => v && v.trim() !== ""));
}

// ---------------------------------------------------------------------------
// Header row detection
// ---------------------------------------------------------------------------

/**
 * Scan the first 30 rows of a matrix and return the index of the row that
 * most likely contains column headers (based on keyword matching).
 */
export function detectHeaderRowIdx(matrix: string[][]): number {
  let bestIdx = 0;
  let bestScore = 0;
  const max = Math.min(matrix.length, 30);

  for (let i = 0; i < max; i++) {
    const row = matrix[i] ?? [];
    let score = 0;
    for (const cell of row) {
      if (!cell) continue;
      if (HEADER_HINTS.has(normHeader(String(cell)))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestScore >= 2 ? bestIdx : 0;
}

// ---------------------------------------------------------------------------
// Matrix → row objects
// ---------------------------------------------------------------------------

/**
 * Convert a raw string matrix into an array of row objects keyed by the
 * header row's cell values.
 */
export function matrixToRows(
  matrix: string[][],
  headerIdx: number,
): Record<string, string>[] {
  const headers = (matrix[headerIdx] ?? []).map((h) => String(h ?? "").trim());
  const out: Record<string, string>[] = [];

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    const obj: Record<string, string> = {};
    let anyValue = false;

    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      if (!h) continue;
      const raw = cells[j];
      const v = raw == null ? "" : String(raw).trim();
      if (v !== "") anyValue = true;
      obj[h] = v;
    }

    if (anyValue) out.push(obj);
  }

  return out;
}

// ---------------------------------------------------------------------------
// File parsers
// ---------------------------------------------------------------------------

/** Parse an Excel file (.xlsx / .xls) into row objects. */
export async function parseExcelRows(file: File): Promise<Record<string, string>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = wb.Sheets[firstSheetName];
  const matrix = XLSX.utils
    .sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    })
    .map((row) => (row as unknown[]).map((c) => (c == null ? "" : String(c))));

  const headerIdx = detectHeaderRowIdx(matrix);
  return dropBlankRows(matrixToRows(matrix, headerIdx));
}

/** Parse a CSV/TSV/TXT file into row objects. */
export async function parseCsvRows(file: File): Promise<Record<string, string>[]> {
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
  const matrix = (parsed.data as string[][]).map((row) =>
    row.map((c) => String(c ?? "")),
  );
  const headerIdx = detectHeaderRowIdx(matrix);
  return dropBlankRows(matrixToRows(matrix, headerIdx));
}

// ---------------------------------------------------------------------------
// Column mapping for parts import (also used by BOM aggregator)
// ---------------------------------------------------------------------------

export interface PartField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export const PART_FIELDS: PartField[] = [
  {
    key: "part_mark", label: "Part Mark", required: true,
    aliases: ["mark", "part mark", "part_mark", "partmark", "piecemark", "piece mark", "part id", "partid", "part_pos", "member_mark", "member mark"],
  },
  {
    key: "quantity", label: "Quantity",
    aliases: ["qty", "quantity", "count", "pcs", "pieces", "no_of_pieces", "no of pieces"],
  },
  {
    key: "profile", label: "Profile / Section",
    aliases: ["profile", "section", "shape", "size", "profile_name", "section_size", "profilename"],
  },
  {
    key: "name", label: "Name / Description",
    aliases: ["name", "member_name", "member name", "member type", "membertype", "description", "desc", "type"],
  },
  {
    key: "length", label: "Length",
    aliases: ["length", "len", "length_mm", "length_in", "length_ft", "cut_length", "cut length"],
  },
  {
    key: "grade", label: "Grade / Material",
    aliases: ["grade", "material", "material grade", "material_grade", "spec", "matl"],
  },
  {
    key: "weight", label: "Part Weight",
    aliases: ["part weight", "part_weight", "partweight", "weight", "wt", "weight_lbs", "weight_lb", "weight_kg", "weight_ea", "unit_weight", "unit weight", "unitweight", "ext_weight", "ext weight", "extended_weight", "extended weight", "total_weight"],
  },
  {
    key: "heat_number", label: "Heat Number",
    aliases: ["heat number", "heat_number", "heat no", "heat_no", "heat", "heatno", "heat#"],
  },
  {
    key: "assembly_mark", label: "Assembly Mark",
    aliases: ["assembly_mark", "assemblymark", "assembly mark", "assembly", "asm", "assembly_pos", "main_part", "main part"],
  },
  {
    key: "phase", label: "Phase / Lot",
    aliases: ["phase", "lot", "sequence", "seq", "lot_number", "lotnumber"],
  },
];

/**
 * Auto-detect column mapping from sheet headers to known part fields.
 * First header whose normalized name matches a field's alias wins.
 */
export function autoDetectMapping(headers: string[]): Record<string, string> {
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    const n = normHeader(h);
    if (!byNorm.has(n)) byNorm.set(n, h);
  }

  const mapping: Record<string, string> = {};
  for (const field of PART_FIELDS) {
    for (const alias of field.aliases) {
      const hit = byNorm.get(normHeader(alias));
      if (hit) {
        mapping[field.key] = hit;
        break;
      }
    }
  }

  return mapping;
}
