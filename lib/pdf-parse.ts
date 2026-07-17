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
