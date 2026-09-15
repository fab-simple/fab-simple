// =============================================================================
// KISS (.kss) file parser
//
// KISS (Keep It Simple Steel) is a comma-delimited, line-based ASCII format
// established by FabTrol Systems to exchange BOM, assembly, material, and
// fabrication data between CAD software (Tekla Structures, SDS2, Advance Steel)
// and fabrication MIS/ERP systems.
//
// Line identifiers:
//   KISS  — file header (version, generating software)
//   H     — project header (job#, name, customer, date, time, units)
//   D     — detail/material line (dwg#, rev, asmMark, partMark, qty, type, size, grade, length, finish, description)
//   L     — labor/operations line (holes, welds) — attached to preceding D
//   S     — control/status/sequence record (e.g. S,1,1) — NOT a part, bolt, or weight
//   W     — sequence/work order (v1.1)
//   M     — misc data (v1.1)
//   *     — group separator / comment line
//
// Weight calculation rule:
//   The Length field in a D record is length (mm or inches/feet), NEVER weight.
//   Total weight = Quantity × Length × Profile Unit Weight (AISC standard).
//
// Fastener rule:
//   Bolts (HS, B, SB, FB, AB, etc.) are routed to bolts/hardware and excluded
//   from structural steel members & tonnage.
// =============================================================================

import type { ParsedBomResult, ParsedMember, ParsedBolt, ParsedWeld, ParsedHole } from "./types";
import { classifyProfile, calculateAiscWeight, parseLengthToInches, buildCleanSection, formatFeetInches, isMillimeterValue } from "./types";

interface KissLabor {
  function: string;
  count: number;
  f3: string;
  f4: string;
  f5: string;
}

export interface ParseKissOptions {
  forceUnits?: "metric" | "imperial" | "auto";
}

/**
 * Pre-scan lines to determine if the KISS file uses Metric units (mm)
 * or Imperial units (in/ft).
 *
 * NOTE: Tekla Structures / SDS2 exports often put "INCH" in the H record
 * to signify AISC Imperial shape catalog (e.g. L 3X3X1/4), but output
 * the actual dimensional lengths in millimeters (e.g. 606.42, 50.80).
 * We inspect the actual line data so we never misinterpret mm dimensions as inches.
 */
export function detectFileUnits(lines: string[], headerUnitsFlag?: string): boolean {
  const flag = (headerUnitsFlag || "").trim().toUpperCase();
  if (/^(M|METRIC|MM|T)$/i.test(flag)) return true;

  let metricEvidence = 0;
  let imperialEvidence = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("*")) continue;
    const fields = splitKissLine(line);
    const type = (fields[0] ?? "").toUpperCase().replace(/[^A-Z]/g, "");

    if (type === "D") {
      const lengthStr = (fields[9] ?? "").trim();
      if (!lengthStr) continue;

      // Definite imperial formats (contain dashes, foot marks, inch marks, or fractions)
      if (
        lengthStr.includes("'") ||
        lengthStr.includes('"') ||
        lengthStr.includes("/") ||
        /^\d+\s*-\s*\d+/.test(lengthStr)
      ) {
        imperialEvidence++;
        continue;
      }

      const num = parseFloat(lengthStr);
      if (!isNaN(num) && num > 0) {
        if (isMillimeterValue(num)) {
          metricEvidence += 2;
        } else if (num >= 80 && Number.isInteger(num)) {
          imperialEvidence++;
        }
      }
    }

    if (type === "L") {
      const f3 = parseFloat(fields[3] ?? "");
      if (!isNaN(f3) && f3 > 0) {
        if (isMillimeterValue(f3)) {
          metricEvidence++;
        }
      }
    }
  }

  // Strong metric evidence:
  if (metricEvidence > 0 && imperialEvidence === 0) {
    return true;
  }
  if (metricEvidence > imperialEvidence * 2) {
    return true;
  }

  if (/^(I|INCH|IMPERIAL|F)$/i.test(flag)) {
    return false;
  }

  return metricEvidence > 0;
}

/**
 * Parse a KISS (.kss) file from its raw text content.
 *
 * @param text  Raw file content (ASCII text)
 * @param filename  Original filename for metadata
 * @param options  Optional settings such as forcing unit system ("metric" | "imperial" | "auto")
 * @returns ParsedBomResult with members, plates, bolts, welds extracted
 */
export function parseKissFile(
  text: string,
  filename: string,
  options?: ParseKissOptions,
): ParsedBomResult {
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

  // 1. Initial pass to find header units flag if present
  let headerUnits = "";
  for (const line of lines.slice(0, 20)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("H,") || trimmed.startsWith("H\t")) {
      const f = splitKissLine(trimmed);
      headerUnits = f[6] ?? "";
      break;
    }
  }

  // 2. Determine metric vs imperial context
  const force = options?.forceUnits;
  const isMetric = force === "metric" ? true : force === "imperial" ? false : detectFileUnits(lines, headerUnits);

  for (const rawLine of lines) {
    lineNum++;
    const line = rawLine.trim();
    if (!line) continue;

    // Skip comment / separator lines starting with '*'
    if (line.startsWith("*")) {
      continue;
    }

    // Determine line type from first field
    const fields = splitKissLine(line);
    const rawType = (fields[0] ?? "").toUpperCase();
    let lineType = rawType.replace(/[^A-Z]/g, "");

    // Fallback detection for lines missing line-type marker but containing a shape profile
    let isFallbackDetail = false;
    if (
      lineType !== "KISS" &&
      lineType !== "H" &&
      lineType !== "D" &&
      lineType !== "L" &&
      lineType !== "S" &&
      lineType !== "W" &&
      lineType !== "M"
    ) {
      const shapeIdx = fields.findIndex((f) => /^(W|S|HP|M|C|MC|WT|L|HSS|TS|PIPE|PL|PLT|FB)\d/i.test(f) || /\d+X\d+/i.test(f));
      if (shapeIdx >= 0 && fields.length >= 3) {
        isFallbackDetail = true;
        lineType = "D";
      }
    }

    try {
      switch (lineType) {
        case "KISS": {
          // KISS,Version,Software (e.g. KISS,1.0,SDS2)
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
          const units = fields[6] || (isMetric ? "METRIC" : "IMPERIAL");
          result.project.revision = `${result.project.revision ? result.project.revision + " " : ""}Units:${units}`.trim();
          break;
        }

        case "S": {
          // S = KSS control/status record (e.g. S,1,1).
          // Crucial: Must NEVER be treated as a part, weight, steel item, or bolt.
          if (currentMember && fields[1]) {
            currentMember.sequence = fields[1];
          }
          break;
        }

        case "D": {
          // Flush previous member
          if (currentMember) {
            finalizeMember(currentMember, currentLabors, result);
            currentMember = null;
            currentLabors = [];
          }

          let drawingNo = "";
          let drawingRev = "";
          let assemblyMark = "";
          let pieceMark = "";
          let qty = 1;
          let matType = "";
          let size = "";
          let grade = "";
          let rawLengthStr = "0";
          let finish = "";
          let description = "";

          if (isFallbackDetail) {
            const shapeIdx = fields.findIndex((f) => /^(W|S|HP|M|C|MC|WT|L|HSS|TS|PIPE|PL|PLT|FB)\d/i.test(f) || /\d+X\d+/i.test(f));
            size = fields[shapeIdx] ?? "";
            pieceMark = fields[0] ?? "";
            assemblyMark = fields[0] ?? "";

            for (let k = 1; k < fields.length; k++) {
              if (k === shapeIdx) continue;
              const val = parseFloat(fields[k] ?? "");
              if (!isNaN(val) && val > 0) {
                if (val <= 100 && qty === 1) qty = val;
                else if (val > 100 && rawLengthStr === "0") rawLengthStr = fields[k] ?? "0";
              } else if (fields[k] && !grade) {
                if (/^(A36|A992|A500|A572|350W|GRADE|GR)/i.test(fields[k]!)) {
                  grade = fields[k]!;
                }
              }
            }
          } else {
            // Standard KISS D-line:
            // D,DrawingNo,Rev,AssemblyMark,PartMark,Quantity,MatType,Size,Grade,Length,Finish,Description
            drawingNo = fields[1] ?? "";
            drawingRev = fields[2] ?? "";
            assemblyMark = fields[3] ?? "";
            pieceMark = fields[4] ?? "";
            qty = parseFloat(fields[5] ?? "1") || 1;
            matType = (fields[6] ?? "").trim().toUpperCase();
            size = (fields[7] ?? "").trim();
            grade = (fields[8] ?? "").trim();
            rawLengthStr = fields[9] ?? "0";

            const f10 = (fields[10] ?? "").trim();
            const f11 = (fields[11] ?? "").trim();
            const f12 = (fields[12] ?? "").trim();

            const f10Num = parseFloat(f10);
            if (!isNaN(f10Num) && f10Num > 0 && !/[A-Z]/i.test(f10)) {
              // Field 10 is numeric weight (some CAD systems append explicit weight)
              finish = f11;
              description = f12 || f11;
            } else {
              // Standard KISS: Field 10 is Finish, Field 11 is Description
              finish = f10;
              description = f11 || f12;
            }
          }

          // Check if size is a structural shape
          const hasStructuralProfile =
            /^(W|S|HP|M|C|MC|WT|MT|ST|L|HSS|TS|RHS|SHS|PIPE|PL|PLT|FB|FL)\s*\d/i.test(size) ||
            /^(PL|PLT|PLATE|FB|FL|BAR)\s*\d/i.test(size) ||
            /^(PIPE|RND)\s*\d/i.test(size) ||
            (matType === "L" && /^\d+[Xx×]\d+[Xx×]\d+/.test(size));

          // FASTENER DETECTION:
          // Check if this D record represents bolts, anchors, or connection hardware.
          const isFastener =
            !hasStructuralProfile && (
              /^(HS|SB|FB|BOLT|AB|ANCHOR|STUD|ROD|NUT|WASHER|FASTENER|HDW|HARDWARE)$/i.test(matType) ||
              /^(HS|SB|FB|BOLT|AB|ANCHOR|STUD|ROD|NUT|WASHER|FASTENER)$/i.test(size) ||
              /\b(A325|A490|A307|F3125)\b/i.test(grade) ||
              /\b(A325|A490|A307|F3125)\b/i.test(size) ||
              /\b(FIELD BOLT|SHOP BOLT|ANCHOR BOLT|HEX NUT|FLAT WASHER)\b/i.test(description) ||
              ((matType === "B" || description.toUpperCase() === "FIELD") && !/^(W|S|HP|M|C|MC|L|HSS|TS|PL)/i.test(size))
            );

          if (isFastener) {
            // Extract bolt diameter & length
            const bolt = parseBoltRecord({
              matType,
              size,
              grade,
              rawLengthStr,
              finish,
              description,
              qty,
              drawingNo,
              assemblyMark,
              isMetric,
            });
            result.bolts.push(bolt);
            // DO NOT create member or add to structural steel tonnage
            currentMember = null;
            currentLabors = [];
            break;
          }

          // STRUCTURAL STEEL MEMBER:
          // Clean section and category
          const { section, category } = buildCleanSection(matType, size, description);

          // Convert length to inches
          const lengthInches = parseLengthToInches(rawLengthStr, isMetric);
          const lengthMm = isMetric ? (parseFloat(rawLengthStr) || undefined) : undefined;

          // Calculate AISC standard weight:
          // The Length field in the D record is NOT weight! Total line weight = unitWeight × (length/12) × qty.
          const calc = calculateAiscWeight(section, lengthInches, category);
          const unitWeightLbsPerFt = calc.unitWeightLbsPerFt;
          const totalWeightExact = unitWeightLbsPerFt * (lengthInches / 12) * qty;
          const totalWeight = Math.round(totalWeightExact);
          const weight = qty > 0 ? Math.round((totalWeightExact / qty) * 100) / 100 : calc.weightLbs;
          const lengthFormatted = formatFeetInches(lengthInches);

          // If pieceMark is blank (sometimes happens on single-part assemblies), inherit assemblyMark
          const finalPieceMark = pieceMark || assemblyMark || `MARK_${result.members.length + 1}`;
          const finalAssemblyMark = assemblyMark || pieceMark || `ASM_${result.members.length + 1}`;

          currentMember = {
            pieceMark: finalPieceMark,
            assemblyMark: finalAssemblyMark,
            section,
            materialType: matType,
            grade: grade || "A36",
            length: lengthInches,
            lengthFormatted,
            lengthMm,
            weight,
            totalWeight,
            weightSource: "calculated",
            unitWeightLbsPerFt,
            quantity: qty,
            finish,
            notes: `${drawingNo ? `Dwg: ${drawingNo}` : ""}${drawingRev ? ` Rev ${drawingRev}` : ""}${description ? ` — ${description}` : ""}`.trim(),
            category,
            drawingNo: drawingNo || undefined,
            drawingRev: drawingRev || undefined,
            holes: [],
            welds: [],
          };
          currentLabors = [];
          break;
        }

        case "L": {
          // L = Additional operation/labor record attached to the previous D record.
          // Examples:
          //   Holes: L,Holes,8,20.64,9.53,Round
          //   Welds: L,weld,1,1879.60,6.35,W10
          if (!currentMember) {
            // L-line without preceding D-line (e.g. attached to fastener or preamble), skip safely
            break;
          }

          const func = (fields[1] ?? "").trim().toUpperCase();
          const count = parseFloat(fields[2] ?? "1") || 1;
          const f3 = fields[3] ?? "";
          const f4 = fields[4] ?? "";
          const f5 = fields[5] ?? "";

          currentLabors.push({
            function: func,
            count,
            f3,
            f4,
            f5,
          });
          break;
        }

        case "W":
        case "M": {
          // v1.1 sequence / work order / misc lines — skip for BOM estimation
          break;
        }

        default: {
          // Unrecognized or preamble line — skip without polluting warnings if early in file
          if (lineNum > 5 && lineType !== "") {
            result.warnings.push(`Line ${lineNum}: Unrecognized record type "${fields[0]}", skipped.`);
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

  // Set project name from job number if blank
  if (!result.project.jobName && result.project.jobNumber) {
    result.project.jobName = result.project.jobNumber;
  }

  return result;
}

/**
 * Parses a fastener / bolt record from a KISS D-line.
 */
function parseBoltRecord(opts: {
  matType: string;
  size: string;
  grade: string;
  rawLengthStr: string;
  finish: string;
  description: string;
  qty: number;
  drawingNo: string;
  assemblyMark: string;
  isMetric: boolean;
}): ParsedBolt {
  const { size, grade, rawLengthStr, finish, description, qty, drawingNo, assemblyMark, isMetric } = opts;

  // Extract diameter & length from size (e.g. "1/2X2" -> diameter="1/2", length=2)
  let diameter = "3/4";
  let lengthInches = 0;

  const sizeParts = size.split(/[Xx×]/);
  if (sizeParts.length >= 2) {
    diameter = extractBoltDiameter(sizeParts[0]!);
    lengthInches = parseFraction(sizeParts[1]!);
  } else if (sizeParts.length === 1 && sizeParts[0]) {
    diameter = extractBoltDiameter(sizeParts[0]);
  }

  // If length was not in size string, parse from rawLengthStr field
  if (lengthInches === 0 && rawLengthStr) {
    lengthInches = parseLengthToInches(rawLengthStr, isMetric);
  }

  return {
    diameter,
    length: lengthInches,
    grade: grade || "A325",
    finish: finish || "",
    quantity: qty,
    installation: description || "Shop",
    drawingNo: drawingNo || undefined,
    assemblyMark: assemblyMark || undefined,
  };
}

/**
 * Finalize a member: attach L hole and weld operations, add plates,
 * and push to the parsed members list.
 */
function finalizeMember(
  member: ParsedMember,
  labors: KissLabor[],
  result: ParsedBomResult,
): void {
  // Process attached labor operations
  for (const labor of labors) {
    const func = labor.function;

    if (func.includes("HOLE")) {
      // Holes: L,Holes,Count,Size,Depth,Shape
      // Example: L,Holes,8,20.64,9.53,Round
      // Crucial: Holes are drilling/punching operations, NOT bolts!
      const hole: ParsedHole = {
        count: labor.count,
        diameter: labor.f3,
        depth: labor.f4 || undefined,
        shape: labor.f5 || "Round",
      };
      member.holes = member.holes || [];
      member.holes.push(hole);
    } else if (func.includes("WELD")) {
      // Welds: L,weld,Count,Length,Size,Type
      // Example: L,weld,1,1879.60,6.35,W10
      const weldLengthRaw = parseFloat(labor.f3) || 0;
      const weldLength = weldLengthRaw > 0 ? weldLengthRaw : 0;
      const weldSize = labor.f4 || "1/4";
      const weldType = labor.f5 || "FILLET";

      const weld: ParsedWeld = {
        weldType,
        weldSize,
        weldLength,
      };
      member.welds = member.welds || [];
      member.welds.push(weld);
      result.welds.push(weld);
    }
  }

  // If category is Plate, record in plates
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

  // Deduplicate exact duplicate member rows
  const isDuplicate = result.members.some(
    (m) =>
      m.assemblyMark === member.assemblyMark &&
      m.pieceMark === member.pieceMark &&
      m.section === member.section &&
      Math.abs(m.length - member.length) < 0.1 &&
      m.quantity === member.quantity,
  );
  if (!isDuplicate) {
    result.members.push(member);
  }
}

/**
 * Split a KISS comma-delimited line, handling quotes and alternative delimiters.
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
 * Extract bolt diameter from a KISS size field like "1/2X2" or "3/4" or "HS 1/2".
 */
function extractBoltDiameter(sizeField: string): string {
  const clean = sizeField.replace(/^(HS|B|SB|FB|BOLT)\s*/i, "").trim();
  const match = clean.match(/^(\d+\/\d+|\d+\.?\d*)/);
  return match ? match[1]! : clean;
}

/**
 * Parse plate dimensions from a KISS size field like "1/2X12-3/8" or "3/4X18".
 */
function parsePlateDimensions(sizeField: string): { thickness: number; width: number; length: number } {
  const s = sizeField.replace(/^(PL|PLT|PLATE)\s*/i, "").trim();
  const parts = s.split(/[Xx×]/);
  const thickness = parseFraction(parts[0] ?? "0");

  let width = 0;
  let length = 0;

  if (parts[1]) {
    const widthParts = parts[1].split("-");
    if (widthParts.length === 2 && widthParts[1]?.includes("/")) {
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

  const mixedMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return parseInt(mixedMatch[1]!, 10) + parseInt(mixedMatch[2]!, 10) / parseInt(mixedMatch[3]!, 10);
  }

  const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    return parseInt(fracMatch[1]!, 10) / parseInt(fracMatch[2]!, 10);
  }

  return parseFloat(trimmed) || 0;
}
