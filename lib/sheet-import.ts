// Shared spreadsheet-import utilities — CSV/XLSX parsing, header-row
// detection, and alias-based column auto-mapping. Originally built for the
// Tekla/SDS2 BOM importer (app/(dashboard)/dashboard/import/page.tsx);
// extracted here so the Material Requirements KISS/EJE sheet importer
// (docs/procurement-material-traceability-spec.md §15.19) reuses the exact
// same parsing behavior instead of drifting from it.

import Papa from "papaparse";
import * as XLSX from "xlsx";

export const ACCEPT_EXT = ".csv,.tsv,.txt,.xlsx,.xls";
export const ACCEPT_MIME =
  "text/csv,text/tab-separated-values,text/plain," +
  "application/vnd.ms-excel," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls");
}

function dropBlankRows(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter((r) => Object.values(r).some((v) => v && v.trim() !== ""));
}

// Tekla / SDS2 / KISS / EJE exports almost always wrap the sheet with a
// title + metadata preamble (PROJECT NAME, JOB NUMBER, Date, Time). We scan
// the first 30 rows for the one that *looks* like a header — >=2 cells match
// a known field keyword — and treat that as row 0.
const HEADER_HINTS = new Set([
  // Part identification
  "mark", "partmark", "piecemark", "pieceid", "partid", "partpos", "membermark",
  "assembly", "assemblymark", "assemblypos", "mainpart",
  // Member descriptor (Tekla "Name" column)
  "name", "description", "desc", "membertype", "membername", "type",
  // Section / profile
  "profile", "section", "shape", "size", "profilename", "sectionsize", "profilesize",
  // Material
  "material", "grade", "spec", "matl", "materialgrade",
  // Length
  "length", "len", "lengthmm", "lengthin", "cutlength",
  // Weight — per-piece and extended/total variants
  "weight", "wt", "partweight", "part weight", "unitweight", "unit weight",
  "weightlbs", "weightkg", "weightea",
  "extweight", "extendedweight", "totalweight",
  // Surface area / paint (imported but not stored)
  "extarea", "surfacearea", "paintarea",
  // Quantity
  "qty", "quantity", "count", "pcs", "pieces", "noofpieces",
  // Pricing (vendor quote sheets/letters)
  "price", "unitprice", "priceperunit", "unitcost", "cost", "rate", "extendedprice", "totalprice",
  // Scheduling
  "phase", "lot", "sequence", "seq", "lotnumber",
  // Traceability
  "heat", "heatno", "heatnumber", "heat number",
  // Finish
  "finish", "paint", "coating",
]);

export const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function detectHeaderRowIdx(matrix: string[][]): number {
  let bestIdx = 0, bestScore = 0;
  const max = Math.min(matrix.length, 30);
  for (let i = 0; i < max; i++) {
    const row = matrix[i] ?? [];
    let score = 0;
    for (const cell of row) {
      if (!cell) continue;
      if (HEADER_HINTS.has(normHeader(String(cell)))) score++;
    }
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestScore >= 2 ? bestIdx : 0;
}

function matrixToRows(matrix: string[][], headerIdx: number): Record<string, string>[] {
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

/** Auto-detects the header row in a raw cell matrix and converts the rest into header-keyed rows. Shared by every importer that can produce a matrix — CSV/XLSX here, and the PDF table extractor in lib/pdf-parse.ts. */
export function rowsFromMatrix(matrix: string[][]): Record<string, string>[] {
  const headerIdx = detectHeaderRowIdx(matrix);
  return dropBlankRows(matrixToRows(matrix, headerIdx));
}

export async function parseExcelRows(file: File): Promise<Record<string, string>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = wb.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, defval: "", raw: false, blankrows: false,
  }).map((row) => (row as unknown[]).map((c) => (c == null ? "" : String(c))));
  return rowsFromMatrix(matrix);
}

export async function parseCsvRows(file: File): Promise<Record<string, string>[]> {
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
  const matrix = (parsed.data as string[][]).map((row) => row.map((c) => String(c ?? "")));
  return rowsFromMatrix(matrix);
}

/** Parse a file (CSV/TSV or XLSX) into header-keyed rows, auto-detecting the header row. */
export async function parseSheetFile(file: File): Promise<Record<string, string>[]> {
  return isExcelFile(file) ? parseExcelRows(file) : parseCsvRows(file);
}

export interface MappableField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

/**
 * Default mapping — first header (in sheet order) whose normalised name
 * matches a field's alias list wins. Generic over any field-alias list so
 * each importer (parts BOM, material requirements, ...) defines its own
 * fields but shares this exact matching logic.
 */
export function autoDetectMapping(headers: string[], fields: MappableField[]): Record<string, string> {
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    const n = normHeader(h);
    if (!byNorm.has(n)) byNorm.set(n, h);
  }
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    for (const alias of field.aliases) {
      const hit = byNorm.get(normHeader(alias));
      if (hit) { mapping[field.key] = hit; break; }
    }
  }
  return mapping;
}
