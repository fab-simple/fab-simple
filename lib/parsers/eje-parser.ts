// =============================================================================
// EJE (.eje) file parser
//
// EJE is a file format from E.J.E. Industries used to transfer BOM data from
// steel detailing software (SDS2, Tekla, StruCad) into their Structural Material
// Manager production control system.
//
// Two variants exist:
//   1. Fixed-field-width (legacy) — each field has a fixed character width
//   2. ASCII-delimited (modern, v13+) — comma or tab separated
//
// Key quirk: lengths in fixed-width format are stored as whole-number multiples
// of 1/16 of an inch (e.g., 4780 = 298.75 inches = 24'-10 3/4").
//
// Record types:
//   HD — Header record (project info)
//   DT — Detail record (member/plate)
//   BT — Bolt record
//   SM — Summary/material summary record
// =============================================================================

import type {
  ParsedBomResult,
  ParsedMember,
  ParsedPlate,
  ParsedBolt,
  ParsedHardware,
} from "./types";
import { classifyShape, calculateAiscWeight } from "./types";

// ---------------------------------------------------------------------------
// Fixed-width field positions (standard EJE layout)
// ---------------------------------------------------------------------------

const FIXED_FIELDS = {
  // Detail (DT) records
  DT: {
    recordType:   { start: 0,  width: 2  },
    pieceMark:    { start: 2,  width: 12 },
    quantity:     { start: 14, width: 5  },
    materialType: { start: 19, width: 4  },
    size:         { start: 23, width: 20 },
    grade:        { start: 43, width: 10 },
    length:       { start: 53, width: 8  },  // in 1/16" units
    weight:       { start: 61, width: 10 },  // lbs per piece
    finish:       { start: 71, width: 10 },
    assemblyMark: { start: 81, width: 12 },
  },
  // Header (HD) records
  HD: {
    recordType:   { start: 0,  width: 2  },
    jobNumber:    { start: 2,  width: 15 },
    jobName:      { start: 17, width: 30 },
    customer:     { start: 47, width: 30 },
    revision:     { start: 77, width: 5  },
    date:         { start: 82, width: 10 },
  },
  // Bolt (BT) records
  BT: {
    recordType:   { start: 0,  width: 2  },
    diameter:     { start: 2,  width: 8  },
    length:       { start: 10, width: 8  },  // in 1/16" units
    grade:        { start: 18, width: 10 },
    finish:       { start: 28, width: 10 },
    quantity:     { start: 38, width: 6  },
    assemblyMark: { start: 44, width: 12 },
  },
};

/**
 * Parse an EJE (.eje) file from its raw text content.
 * Auto-detects whether the file is fixed-width or ASCII-delimited.
 *
 * @param text  Raw file content
 * @param filename  Original filename for metadata
 * @returns ParsedBomResult
 */
export function parseEjeFile(text: string, filename: string): ParsedBomResult {
  const result: ParsedBomResult = {
    source: "eje",
    filename,
    project: { jobNumber: "", jobName: "", customer: "", revision: "", date: "" },
    members: [],
    plates: [],
    bolts: [],
    welds: [],
    hardware: [],
    warnings: [],
    errors: [],
  };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    result.errors.push("File is empty.");
    return result;
  }

  // Auto-detect format: if most lines contain commas or tabs, use delimited mode
  const isDelimited = detectDelimitedFormat(lines);

  if (isDelimited) {
    parseDelimitedEje(lines, result);
  } else {
    parseFixedWidthEje(lines, result);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

function detectDelimitedFormat(lines: string[]): boolean {
  const sampleSize = Math.min(lines.length, 20);
  let commaLines = 0;
  let tabLines = 0;

  for (let i = 0; i < sampleSize; i++) {
    const line = lines[i] ?? "";
    if (line.includes(",")) commaLines++;
    if (line.includes("\t")) tabLines++;
  }

  // If >50% of sample lines have commas or tabs, treat as delimited
  return (commaLines > sampleSize * 0.5) || (tabLines > sampleSize * 0.5);
}

// ---------------------------------------------------------------------------
// Fixed-width parser
// ---------------------------------------------------------------------------

function parseFixedWidthEje(lines: string[], result: ParsedBomResult): void {
  let lineNum = 0;

  for (const line of lines) {
    lineNum++;
    if (line.length < 2) continue;

    const recordType = line.substring(0, 2).toUpperCase().trim();

    try {
      switch (recordType) {
        case "HD": {
          const fields = FIXED_FIELDS.HD;
          result.project.jobNumber = extractFixed(line, fields.jobNumber).trim();
          result.project.jobName = extractFixed(line, fields.jobName).trim();
          result.project.customer = extractFixed(line, fields.customer).trim();
          result.project.revision = extractFixed(line, fields.revision).trim();
          result.project.date = extractFixed(line, fields.date).trim();
          break;
        }

        case "DT": {
          const fields = FIXED_FIELDS.DT;
          const pieceMark = extractFixed(line, fields.pieceMark).trim();
          const qty = parseInt(extractFixed(line, fields.quantity).trim(), 10) || 1;
          const matType = extractFixed(line, fields.materialType).trim().toUpperCase();
          const size = extractFixed(line, fields.size).trim();
          const grade = extractFixed(line, fields.grade).trim();
          const lengthRaw = parseInt(extractFixed(line, fields.length).trim(), 10) || 0;
          const weightRaw = parseFloat(extractFixed(line, fields.weight).trim()) || 0;
          const finish = extractFixed(line, fields.finish).trim();
          const assemblyMark = extractFixed(line, fields.assemblyMark).trim();

          // Convert length from 1/16" units to inches
          const lengthInches = lengthRaw / 16;

          // Build full section string
          const section = matType && size ? `${matType}${size}` : size || matType;

          // Check if this is a bolt record masquerading as a detail
          if (matType === "SB" || matType === "FB") {
            result.bolts.push({
              diameter: extractBoltDiameterFromSize(size),
              length: lengthInches,
              grade: grade || "A325",
              finish,
              quantity: qty,
            });
            break;
          }

          const category = classifyShape(matType);

          let finalWeight = weightRaw;
          let weightSource: "file" | "calculated" = "file";
          let unitWeightLbsPerFt = 0;

          if (finalWeight <= 0) {
            const calc = calculateAiscWeight(section, lengthInches, category);
            finalWeight = calc.weightLbs;
            unitWeightLbsPerFt = calc.unitWeightLbsPerFt;
            weightSource = "calculated";
          }

          // If plate, also add to plates array
          if (category === "Plate") {
            const dims = parsePlateSize(size);
            result.plates.push({
              plateMark: pieceMark,
              thickness: dims.thickness,
              width: dims.width,
              length: lengthInches || dims.length,
              grade,
              quantity: qty,
              weight: finalWeight,
            });
          }

          result.members.push({
            pieceMark,
            assemblyMark,
            section,
            materialType: matType,
            grade,
            length: lengthInches,
            weight: finalWeight,
            weightSource,
            unitWeightLbsPerFt,
            quantity: qty,
            finish,
            notes: "",
            category,
          });
          break;
        }

        case "BT": {
          const fields = FIXED_FIELDS.BT;
          const diameter = extractFixed(line, fields.diameter).trim();
          const lengthRaw = parseInt(extractFixed(line, fields.length).trim(), 10) || 0;
          const grade = extractFixed(line, fields.grade).trim();
          const finish = extractFixed(line, fields.finish).trim();
          const qty = parseInt(extractFixed(line, fields.quantity).trim(), 10) || 0;

          result.bolts.push({
            diameter: diameter || "3/4",
            length: lengthRaw / 16,
            grade: grade || "A325",
            finish,
            quantity: qty,
          });
          break;
        }

        case "SM": {
          // Summary/material summary — extract if present but not critical
          // Could contain total weight, profile counts, etc.
          // We'll compute these from the detail records instead
          break;
        }

        default: {
          // Unknown record type — could be comment or preamble
          if (lineNum > 3) {
            result.warnings.push(`Line ${lineNum}: Unknown record type "${recordType}".`);
          }
          break;
        }
      }
    } catch (e) {
      result.errors.push(`Line ${lineNum}: Parse error — ${(e as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Delimited parser (ASCII variant, comma or tab separated)
// ---------------------------------------------------------------------------

function parseDelimitedEje(lines: string[], result: ParsedBomResult): void {
  // Detect delimiter
  const firstLine = lines[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  let lineNum = 0;

  for (const rawLine of lines) {
    lineNum++;
    const fields = rawLine.split(delimiter).map((f) => f.trim());
    const recordType = (fields[0] ?? "").toUpperCase();

    try {
      switch (recordType) {
        case "HD": {
          result.project.jobNumber = fields[1] ?? "";
          result.project.jobName = fields[2] ?? "";
          result.project.customer = fields[3] ?? "";
          result.project.revision = fields[4] ?? "";
          result.project.date = fields[5] ?? "";
          break;
        }

        case "DT": {
          const pieceMark = fields[1] ?? "";
          const qty = parseInt(fields[2] ?? "1", 10) || 1;
          const matType = (fields[3] ?? "").toUpperCase();
          const size = fields[4] ?? "";
          const grade = fields[5] ?? "";
          const lengthRaw = parseInt(fields[6] ?? "0", 10) || 0;
          const weightRaw = parseFloat(fields[7] ?? "0") || 0;
          const finish = fields[8] ?? "";
          const assemblyMark = fields[9] ?? "";

          // Delimited EJE may or may not use 1/16" encoding
          // Heuristic: if length > 5000 for a typical member, it's likely 1/16"
          const lengthInches = lengthRaw > 5000 ? lengthRaw / 16 : lengthRaw;

          const section = matType && size ? `${matType}${size}` : size || matType;

          if (matType === "SB" || matType === "FB") {
            result.bolts.push({
              diameter: extractBoltDiameterFromSize(size),
              length: lengthInches,
              grade: grade || "A325",
              finish,
              quantity: qty,
            });
            break;
          }

          const category = classifyShape(matType);

          if (category === "Plate") {
            const dims = parsePlateSize(size);
            result.plates.push({
              plateMark: pieceMark,
              thickness: dims.thickness,
              width: dims.width,
              length: lengthInches || dims.length,
              grade,
              quantity: qty,
              weight: weightRaw,
            });
          }

          result.members.push({
            pieceMark,
            assemblyMark,
            section,
            materialType: matType,
            grade,
            length: lengthInches,
            weight: weightRaw,
            quantity: qty,
            finish,
            notes: "",
            category,
          });
          break;
        }

        case "BT": {
          result.bolts.push({
            diameter: fields[1] ?? "3/4",
            length: (parseInt(fields[2] ?? "0", 10) || 0) / 16,
            grade: fields[3] ?? "A325",
            finish: fields[4] ?? "",
            quantity: parseInt(fields[5] ?? "0", 10) || 0,
          });
          break;
        }

        case "SM":
          // Skip summary records — we compute from details
          break;

        default:
          if (lineNum > 3) {
            result.warnings.push(`Line ${lineNum}: Unknown record "${recordType}".`);
          }
          break;
      }
    } catch (e) {
      result.errors.push(`Line ${lineNum}: Parse error — ${(e as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractFixed(
  line: string,
  field: { start: number; width: number },
): string {
  return line.substring(field.start, field.start + field.width);
}

function extractBoltDiameterFromSize(size: string): string {
  // Try to extract fraction or decimal from size field
  const match = size.match(/(\d+\/\d+|\d+\.?\d*)/);
  return match ? match[1] : size || "3/4";
}

function parsePlateSize(size: string): { thickness: number; width: number; length: number } {
  // Remove PL prefix
  const s = size.replace(/^(PL|PLT|PLATE)\s*/i, "").trim();
  const parts = s.split(/[Xx×]/);

  const parseFrac = (v: string): number => {
    const t = v.trim();
    const mixed = t.match(/^(\d+)-(\d+)\/(\d+)$/);
    if (mixed) return parseInt(mixed[1]!, 10) + parseInt(mixed[2]!, 10) / parseInt(mixed[3]!, 10);
    const frac = t.match(/^(\d+)\/(\d+)$/);
    if (frac) return parseInt(frac[1]!, 10) / parseInt(frac[2]!, 10);
    return parseFloat(t) || 0;
  };

  return {
    thickness: parseFrac(parts[0] ?? "0"),
    width: parseFrac(parts[1] ?? "0"),
    length: parseFrac(parts[2] ?? "0"),
  };
}
