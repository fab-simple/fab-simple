// Browser-side PDF text extraction + part-mark matching.
//
// Used by the detailing PDF importer to figure out which parts of a project
// a given drawing PDF should be linked to. We use EXACT matching only:
//
//   1. Text scan — read every page's text content via pdfjs-dist and look
//      for known part_marks as exact standalone tokens (case-insensitive,
//      bounded by non-alphanumeric chars). No prefix/substring matching.
//   2. Filename match — extract the leading assembly/part number from the
//      file name (e.g. "1001AB1 - Rev 0.pdf" → "1001AB1") and match parts
//      whose part_mark or assembly_mark exactly equals that token.
//
// The lib is only imported when the user opens the PDF tab so the BOM tab
// doesn't pay the ~500 KB pdf.js worker cost on first paint.

import * as pdfjsLib from "pdfjs-dist";
import { rowsFromMatrix } from "@/lib/sheet-import";

// pdfjs needs a worker. We point it at the bundled worker that matches the
// installed version so we don't have to ship a /public copy on every
// upgrade. Using the .mjs ESM worker so Turbopack handles the chunk.
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface PartLite {
  id: string;
  part_mark: string;
  assembly_mark?: string | null;
}

export interface PdfMatchResult {
  file: File;
  // Plain text extracted from every page, joined with spaces. Kept around for
  // debugging / "Show extracted text" UX if we ever need it.
  text: string;
  matched: PartLite[];
  // Reasons each part was matched, so the UI can show "1001AB1 (filename + text)".
  reasons: Map<string, ("text" | "filename")[]>;
  // The filename prefix we extracted, if any (e.g. "1001"). Useful for the
  // UX hint when nothing matched.
  filenamePrefix: string | null;
  error?: string;
}

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  const out: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .filter(Boolean)
      .join(" ");
    out.push(pageText);
  }
  return out.join("\n");
}

// "1001 - Rev 0.pdf"     → "1001"
// "1001_Rev0.pdf"        → "1001"
// "Job 25-305 1001.pdf"  → "1001" (last alnum cluster wins for noisy names)
// "MISC.pdf"             → null
function extractFilenamePrefix(name: string): string | null {
  const stem = name.replace(/\.pdf$/i, "").trim();
  // Prefer a leading numeric/alnum chunk before a separator.
  const leading = stem.match(/^([A-Za-z]?\d{2,}[A-Za-z\d]*)/);
  if (leading) return leading[1];
  // Fallback: the last sufficiently-long alnum chunk in the stem.
  const tokens = stem.split(/[\s_\-]+/).filter((t) => /^[A-Za-z]?\d{2,}/.test(t));
  return tokens[tokens.length - 1] ?? null;
}

// Escape a part_mark for safe use inside a RegExp. Part marks can contain
// `.`, `-`, `(`, `)`, etc. depending on the shop's naming convention.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchPartsAgainstPdf(text: string, file: File, parts: PartLite[]): {
  matched: PartLite[];
  reasons: Map<string, ("text" | "filename")[]>;
  filenamePrefix: string | null;
} {
  const matched = new Map<string, PartLite>();
  const reasons = new Map<string, ("text" | "filename")[]>();
  const filenamePrefix = extractFilenamePrefix(file.name);

  const lcText = text.toLowerCase();
  const lcPrefix = filenamePrefix?.toLowerCase() ?? null;

  for (const p of parts) {
    const lcMark = p.part_mark.toLowerCase();
    let hitText = false;
    let hitFile = false;

    // EXACT match only — the part_mark must appear as a standalone token in
    // the extracted PDF text, bounded by non-alphanumeric characters (or
    // start/end of string). This prevents partial/prefix matches like
    // "1001" matching inside "10012B1".
    const re = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(lcMark)}(?=[^A-Za-z0-9]|$)`);
    if (re.test(lcText)) hitText = true;

    // EXACT filename match — the extracted prefix must exactly equal the
    // part_mark or assembly_mark. No more startsWith() prefix matching
    // that would link one PDF to many unrelated parts.
    if (lcPrefix && lcMark === lcPrefix) hitFile = true;
    if (lcPrefix && p.assembly_mark && p.assembly_mark.toLowerCase() === lcPrefix) hitFile = true;

    if (hitText || hitFile) {
      matched.set(p.id, p);
      const list: ("text" | "filename")[] = [];
      if (hitText) list.push("text");
      if (hitFile) list.push("filename");
      reasons.set(p.id, list);
    }
  }

  return {
    matched: Array.from(matched.values()).sort((a, b) =>
      a.part_mark.localeCompare(b.part_mark, undefined, { numeric: true })
    ),
    reasons,
    filenamePrefix,
  };
}

export async function analysePdf(file: File, parts: PartLite[]): Promise<PdfMatchResult> {
  try {
    const text = await extractPdfText(file);
    const { matched, reasons, filenamePrefix } = matchPartsAgainstPdf(text, file, parts);
    return { file, text, matched, reasons, filenamePrefix };
  } catch (e) {
    return {
      file,
      text: "",
      matched: [],
      reasons: new Map(),
      filenamePrefix: null,
      error: e instanceof Error ? e.message : "Failed to parse PDF",
    };
  }
}

// ===========================================================================
// PDF table reconstruction — vendor quote letters carry their material/price
// table as freely-positioned text (no structured table object in the PDF),
// so pdf.js only gives us each word plus its (x, y) position. We rebuild a
// grid from that: cluster words into lines by y, then cluster every line's
// word x-positions *across the whole document* into a shared set of column
// bins (rather than per-line) so the same visual column lands in the same
// matrix index on every row — which is what rowsFromMatrix needs to treat
// row 0 as a header and read the rest as records.
// ===========================================================================

interface PositionedItem { str: string; x: number; y: number; height: number; }

async function extractPositionedItems(file: File): Promise<PositionedItem[][]> {
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  const pages: PositionedItem[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items: PositionedItem[] = [];
    for (const raw of content.items) {
      if (!("str" in raw) || !raw.str.trim()) continue;
      const item = raw as { str: string; transform: number[]; height: number };
      items.push({ str: item.str, x: item.transform[4], y: item.transform[5], height: item.height || 10 });
    }
    pages.push(items);
  }
  return pages;
}

interface Row { y: number; items: PositionedItem[]; }

function clusterRows(items: PositionedItem[]): Row[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Row[] = [];
  for (const item of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(item.y - last.y) <= Math.max(item.height, 8) * 0.6) {
      last.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

// Gap-based 1D clustering of every word's left edge across all rows, so a
// column that's slightly ragged (currency symbols, varying digit counts)
// still resolves to one bin instead of splintering into several.
function clusterColumnCenters(rows: Row[], gapPt = 10): number[] {
  const xs = rows.flatMap((r) => r.items.map((it) => it.x)).sort((a, b) => a - b);
  const centers: number[] = [];
  let cluster: number[] = [];
  for (const x of xs) {
    if (cluster.length > 0 && x - cluster[cluster.length - 1] > gapPt) {
      centers.push(cluster.reduce((s, v) => s + v, 0) / cluster.length);
      cluster = [];
    }
    cluster.push(x);
  }
  if (cluster.length > 0) centers.push(cluster.reduce((s, v) => s + v, 0) / cluster.length);
  return centers;
}

function rowsToMatrix(rows: Row[], columnCenters: number[]): string[][] {
  return rows.map((row) => {
    const cells = new Array(columnCenters.length).fill("");
    for (const item of row.items) {
      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < columnCenters.length; i++) {
        const d = Math.abs(item.x - columnCenters[i]);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      cells[bestIdx] = cells[bestIdx] ? `${cells[bestIdx]} ${item.str}` : item.str;
    }
    return cells.map((c) => c.trim());
  });
}

/** Reconstructs a table (as CSV/XLSX-style header-keyed rows) from a PDF's positioned text — for vendor quote letters that lay material/price data out in columns without an extractable structured table. */
export async function parsePdfTableRows(file: File): Promise<Record<string, string>[]> {
  const pages = await extractPositionedItems(file);
  const rows = pages.flatMap((items) => clusterRows(items));
  if (rows.length === 0) return [];
  const columnCenters = clusterColumnCenters(rows);
  const matrix = rowsToMatrix(rows, columnCenters);
  return rowsFromMatrix(matrix);
}
