// =============================================================================
// KISS (.kss) file parser
//
// KISS (Keep It Simple Steel) is a comma-delimited, line-based ASCII format
// used to exchange BOM and fabrication data between CAD software (SDS2, Tekla)
// and fabrication MIS/ERP systems.
//
// Line identifiers:
//   KISS  — file header (version, generating software)
//   H     — project header (job#, name, customer, date, time, units)
//   D     — detail/material line (drawing#, rev, assembly, mark, qty, type, size, grade, length, finish, notes)
//   L     — labor line (function, count, size, description) — attached to preceding D
//   W     — sequence/work order (v1.1)
//   M     — misc data (v1.1)
//
// References:
//   - KISS v1.0/v1.1 specification (public domain)
//   - SDS2 KISS export documentation
//   - FabStation KISS format reference
// =============================================================================

import type { ParsedBomResult, ParsedMember, ParsedBolt, ParsedWeld } from "./types";
import { classifyShape, calculateAiscWeight, parseLengthToInches, buildCleanSection } from "./types";

interface KissLabor {
  function: string;
  count: number;
  size: string;
  description: string;
}

/**
 * Parse a KISS (.kss) file from its raw text content.
 *
 * @param text  Raw file content (ASCII text)
 * @param filename  Original filename for metadata
 * @returns ParsedBomResult with members, plates, bolts, welds extracted
 */
export function parseKissFile(text: string, filename: string): ParsedBomResult {
  const result: ParsedBomResult = {
    source: "kiss",
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

  const cleanText = text.replace(/^\uFEFF/, "");
  const lines = cleanText.split(/\r?\n/);
  let currentMember: ParsedMember | null = null;
  let currentLabors: KissLabor[] = [];
  let lineNum = 0;

  for (const rawLine of lines) {
    lineNum++;
    const line = rawLine.trim();
    if (!line) continue;

    // Determine line type from first field
    const fields = splitKissLine(line);
    const rawType = (fields[0] ?? "").toUpperCase();
    let lineType = rawType.replace(/[^A-Z]/g, "");

    // If first field is not standard KISS header/detail code, check if line contains a structural shape profile
    let isFallbackDetail = false;
    if (lineType !== "KISS" && lineType !== "H" && lineType !== "D" && lineType !== "L" && lineType !== "W" && lineType !== "M") {
      const shapeIdx = fields.findIndex((f) => /^(W|S|HP|M|C|MC|WT|L|HSS|TS|PIPE|PL|PLT|FB)\d/i.test(f) || /\d+X\d+/i.test(f));
      if (shapeIdx >= 0 && fields.length >= 3) {
        isFallbackDetail = true;
        lineType = "D";
      }
    }

    try {
      switch (lineType) {
        case "KISS": {
          // KISS,1.0,Tekla Structures
          if (fields[1]) {
            result.project.revision = fields[1];
          }
          break;
        }

        case "H": {
          // H,JobNumber,JobName,Customer,Date,Time,UnitsFlag
          result.project.jobNumber = fields[1] ?? "";
          result.project.jobName = fields[2] ?? "";
          result.project.customer = fields[3] ?? "";
          result.project.date = fields[4] ?? "";
          if (fields[6]) {
            result.project.revision = `${result.project.revision ? result.project.revision + " " : ""}Units:${fields[6]}`.trim();
          }
          break;
        }

        case "D": {
          // Flush previous member
          if (currentMember) {
            finalizeMember(currentMember, currentLabors, result);
          }

          let drawingNo = "";
          let drawingRev = "";
          let assemblyMark = "";
          let pieceMark = "";
          let qty = 1;
          let matType = "";
          let size = "";
          let grade = "";
          let lengthRaw = 0;
          let explicitWeight = 0;
          let finish = "";
          let notes = "";

          if (isFallbackDetail) {
            // Flexible position matching for non-standard KISS / report CSVs
            const shapeIdx = fields.findIndex((f) => /^(W|S|HP|M|C|MC|WT|L|HSS|TS|PIPE|PL|PLT|FB)\d/i.test(f) || /\d+X\d+/i.test(f));
            size = fields[shapeIdx] ?? "";
            pieceMark = fields[0] ?? "";
            assemblyMark = fields[0] ?? "";

            // Find Qty & Length among numbers
            for (let k = 1; k < fields.length; k++) {
              if (k === shapeIdx) continue;
              const val = parseFloat(fields[k] ?? "");
              if (!isNaN(val) && val > 0) {
                if (val <= 100 && qty === 1) qty = val;
                else if (val > 100 && lengthRaw === 0) lengthRaw = val;
                else if (val > 0 && explicitWeight === 0) explicitWeight = val;
              } else if (fields[k] && !grade) {
                if (/^(A36|A992|A500|A572|350W|GRADE|GR)/i.test(fields[k]!)) {
                  grade = fields[k]!;
                }
              }
            }
          } else {
            // Standard KISS D-line
            drawingNo = fields[1] ?? "";
            drawingRev = fields[2] ?? "";
            assemblyMark = fields[3] ?? "";
            pieceMark = fields[4] ?? "";
            qty = parseFloat(fields[5] ?? "1") || 1;
            matType = (fields[6] ?? "").toUpperCase();
            size = fields[7] ?? "";
            let rawLengthStr = fields[9] ?? "0";
            lengthRaw = parseLengthToInches(rawLengthStr);

            const f10 = (fields[10] ?? "").trim();
            const f11 = (fields[11] ?? "").trim();
            const f12 = (fields[12] ?? "").trim();

            const f10Num = parseFloat(f10);
            const f11Num = parseFloat(f11);

            if (!isNaN(f10Num) && f10Num > 0 && !/[A-Z]/i.test(f10)) {
              explicitWeight = f10Num;
              finish = f11;
              notes = f12;
            } else {
              finish = f10;
              if (!isNaN(f11Num) && f11Num > 0 && !/[A-Z]/i.test(f11)) {
                explicitWeight = f11Num;
                notes = f12;
              } else {
                notes = f11 || f12;
              }
            }
          }

          let lengthInches = lengthRaw;

          const { section, category } = buildCleanSection(matType, size);

          currentMember = {
            pieceMark: pieceMark || assemblyMark || `MARK_${result.members.length + 1}`,
            assemblyMark: assemblyMark || pieceMark || `ASM_${result.members.length + 1}`,
            section,
            materialType: matType,
            grade: grade || "A36",
            length: lengthInches,
            weight: explicitWeight,
            weightSource: explicitWeight > 0 ? "file" : "calculated",
            quantity: qty,
            finish,
            notes: `${drawingNo ? `Dwg: ${drawingNo}` : ""}${drawingRev ? ` Rev ${drawingRev}` : ""}${notes ? ` — ${notes}` : ""}`.trim(),
            category,
          };
          currentLabors = [];
          break;
        }

        case "L": {
          // L,Function,Count,Size,Description
          // L,HOLE,4,13/16,SHOP BOLT
          // L,WELD,1,5/16,FILLET WELD 12"
          if (!currentMember) {
            result.warnings.push(`Line ${lineNum}: L-line without preceding D-line, skipped.`);
            break;
          }
          currentLabors.push({
            function: (fields[1] ?? "").toUpperCase(),
            count: parseFloat(fields[2] ?? "0") || 0,
            size: fields[3] ?? "",
            description: fields[4] ?? "",
          });
          break;
        }

        case "W":
        case "M": {
          // v1.1 sequence/misc lines — skip for estimation purposes
          break;
        }

        default: {
          // Unknown line type — could be an address line or comment
          if (lineNum <= 5) {
            // First few lines may be preamble/address — silently skip
          } else {
            result.warnings.push(`Line ${lineNum}: Unknown line type "${lineType}", skipped.`);
          }
          break;
        }
      }
    } catch (e) {
      result.errors.push(`Line ${lineNum}: Parse error — ${(e as Error).message}`);
    }
  }

  // Flush last member
  if (currentMember) {
    finalizeMember(currentMember, currentLabors, result);
  }

  // Set project name from job name if available
  if (!result.project.jobName && result.project.jobNumber) {
    result.project.jobName = result.project.jobNumber;
  }

  return result;
}

/**
 * Finalize a member: compute weight if missing, extract bolt/weld data from labor lines,
 * and add to the appropriate result arrays.
 */
function finalizeMember(
  member: ParsedMember,
  labors: KissLabor[],
  result: ParsedBomResult,
): void {
  // Extract bolts from labor lines
  for (const labor of labors) {
    if (labor.function === "HOLE" || labor.function === "BOLT" || labor.function === "SB" || labor.function === "FB") {
      // Shop bolts and field bolts
      const bolt: ParsedBolt = {
        diameter: labor.size || "3/4",
        length: 0,
        grade: labor.description.includes("A490") ? "A490" : "A325",
        finish: "",
        quantity: (labor.count || 1) * member.quantity,
      };
      result.bolts.push(bolt);
    }

    if (labor.function === "WELD") {
      const weld: ParsedWeld = {
        weldType: labor.description.includes("CJP") ? "CJP" :
                  labor.description.includes("PJP") ? "PJP" : "FILLET",
        weldSize: labor.size || "5/16",
        weldLength: labor.count || 0,
      };
      result.welds.push(weld);
    }
  }

  // Classify: if materialType or section indicates a bolt/hardware record, add to bolts/hardware and EXCLUDE from members & steel weight
  const isBoltOrHardware =
    /^(SB|FB|BOLT|NUT|WASHER|HDW|HARDWARE|ANCHOR|AB|STUD|ROD|FASTENER)$/i.test(member.materialType) ||
    /^(SB|FB|BOLT|NUT|WASHER|HDW|HARDWARE|ANCHOR|AB|STUD|ROD|FASTENER)$/i.test(member.section) ||
    /\b(A325|A490|A307|F3125)\b/i.test(member.section) ||
    /\b(SHOP BOLT|FIELD BOLT|ANCHOR BOLT|HEX NUT|FLAT WASHER)\b/i.test(member.notes);

  if (isBoltOrHardware) {
    const bolt: ParsedBolt = {
      diameter: extractBoltDiameter(member.section),
      length: member.length,
      grade: member.grade || (member.section.includes("A490") ? "A490" : "A325"),
      finish: member.finish,
      quantity: member.quantity,
    };
    result.bolts.push(bolt);
    return; // EXCLUDED FROM MEMBERS & STEEL TONNAGE
  }

  // Calculate AISC standard weight for reference / fallback
  const calc = calculateAiscWeight(member.section, member.length, member.category);
  member.unitWeightLbsPerFt = calc.unitWeightLbsPerFt;

  if (!member.weight || member.weight <= 0) {
    member.weight = calc.weightLbs;
    member.weightSource = "calculated";
  } else if (member.quantity > 1 && calc.weightLbs > 0) {
    // Check if the weight in the file was total line weight rather than per-piece weight
    const diffPerPiece = Math.abs(member.weight - calc.weightLbs);
    const diffTotalLine = Math.abs(member.weight - (calc.weightLbs * member.quantity));
    if (diffTotalLine < diffPerPiece * 0.5) {
      // File weight was total line weight — convert to per-piece weight
      member.weight = Math.round((member.weight / member.quantity) * 10) / 10;
    }
  }

  // Classify: if materialType is PL (plate), add to plates
  if (member.category === "Plate") {
    const plateDims = parsePlateDimensions(member.section);
    result.plates.push({
      plateMark: member.pieceMark,
      thickness: plateDims.thickness,
      width: plateDims.width,
      length: member.length || plateDims.length,
      grade: member.grade,
      quantity: member.quantity,
      weight: member.weight,
    });
  }

  result.members.push(member);
}

/**
 * Split a KISS comma-delimited line, handling quoted fields.
 */
function splitKissLine(line: string): string[] {
  let delim = ",";
  if (line.includes("\t") && !line.includes(",")) delim = "\t";
  else if (line.includes("|") && !line.includes(",")) delim = "|";
  else if (line.includes(";") && !line.includes(",")) delim = ";";

  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' || ch === "'") {
      inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      fields.push(current.trim().replace(/^["']|["']$/g, "").trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim().replace(/^["']|["']$/g, "").trim());
  return fields;
}

/**
 * Extract bolt diameter from a KISS size field like "3/4X3" or "7/8".
 */
function extractBoltDiameter(sizeField: string): string {
  const match = sizeField.match(/^(\d+\/\d+|\d+\.?\d*)/);
  return match ? match[1] : sizeField;
}

/**
 * Parse plate dimensions from a KISS size field like "1/2X12-3/8" or "3/4X18".
 * Returns thickness, width, and optionally length in inches.
 */
function parsePlateDimensions(sizeField: string): { thickness: number; width: number; length: number } {
  // Remove "PL" prefix if present
  const s = sizeField.replace(/^(PL|PLT|PLATE)\s*/i, "").trim();

  // Try to parse "thickness X width" or "thickness X width - length"
  const parts = s.split(/[Xx×]/);
  const thickness = parseFraction(parts[0] ?? "0");

  let width = 0;
  let length = 0;

  if (parts[1]) {
    // parts[1] might be "12-3/8" (width with fraction) or "12"
    const widthParts = parts[1].split("-");
    if (widthParts.length === 2 && widthParts[1]?.includes("/")) {
      // "12-3/8" → width = 12 + 3/8
      width = parseFloat(widthParts[0] ?? "0") + parseFraction(widthParts[1] ?? "0");
    } else {
      width = parseFraction(parts[1]);
    }
  }

  if (parts[2]) {
    length = parseFraction(parts[2]);
  }

  return { thickness, width, length };
}

/**
 * Parse a fraction string like "3/4" or "1-1/2" to a decimal number.
 */
function parseFraction(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;

  // Handle "1-1/2" (mixed number with dash)
  const mixedMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return parseInt(mixedMatch[1]!, 10) + parseInt(mixedMatch[2]!, 10) / parseInt(mixedMatch[3]!, 10);
  }

  // Handle "3/4" (simple fraction)
  const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    return parseInt(fracMatch[1]!, 10) / parseInt(fracMatch[2]!, 10);
  }

  // Plain number
  return parseFloat(trimmed) || 0;
}
