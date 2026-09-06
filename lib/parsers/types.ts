// =============================================================================
// Shared types for KISS, EJE, and CSV/XLSX BOM parsers
// =============================================================================

/** Canonical shape categories used in the estimation material breakdown. */
export type ShapeCategory =
  | "Wide Flange"
  | "HSS / Tube"
  | "Angle"
  | "Plate"
  | "Channel"
  | "Tee"
  | "Pipe"
  | "Misc Metal";

/** Maps a raw material type code (from KISS D-line or EJE record) to a ShapeCategory. */
export function classifyShape(materialType: string): ShapeCategory {
  const t = materialType.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Wide Flange (W, S, M, HP, WF, BEAM, COLUMN)
  if (/^(W|S|M|HP)\d/.test(t) || t === "W" || t === "S" || t === "M" || t === "HP" || t === "WF" || t === "BEAM" || t === "COLUMN") return "Wide Flange";

  // HSS / Tube
  if (/^(HSS|TS|RHS|SHS|TUBE)/.test(t)) return "HSS / Tube";

  // Angle
  if (/^L\d/.test(t) || t === "L" || t === "ANGLE") return "Angle";

  // Plate
  if (/^(PL|PLT|FB|PLATE|BAR|FLATBAR|FL|RECT)/.test(t)) return "Plate";

  // Channel
  if (/^(C|MC)\d/.test(t) || t === "C" || t === "MC" || t === "CHANNEL") return "Channel";

  // Tee
  if (/^(WT|MT|ST)\d/.test(t) || t === "WT" || t === "MT" || t === "ST" || t === "TEE") return "Tee";

  // Pipe
  if (/^(PIPE|RND|P)\d/.test(t) || t === "PIPE" || t === "RND" || t === "P") return "Pipe";

  return "Misc Metal";
}

/** Classifies a full AISC profile string (e.g. "W18X40", "HSS6X6X3/8") to a ShapeCategory. */
export function classifyProfile(profile: string): ShapeCategory {
  const p = profile.toUpperCase().replace(/\s+/g, "");

  if (/^W\d/.test(p) || /^S\d/.test(p) || /^M\d/.test(p) || /^HP\d/.test(p)) return "Wide Flange";
  if (/^HSS/.test(p) || /^TS/.test(p) || /^RHS/.test(p) || /^SHS/.test(p)) return "HSS / Tube";
  if (/^L\d/.test(p) || /^L\s/.test(p)) return "Angle";
  if (/^PL/.test(p) || /^FL/.test(p) || /^PLT/.test(p) || /^FB/.test(p) || /^BAR/.test(p)) return "Plate";
  if (/^C\d/.test(p) || /^MC\d/.test(p)) return "Channel";
  if (/^WT\d/.test(p) || /^MT\d/.test(p) || /^ST\d/.test(p)) return "Tee";
  if (/^PIPE/.test(p)) return "Pipe";

  return "Misc Metal";
}

/**
 * Combines materialType and size into a clean, canonical AISC profile section string
 * (e.g. "W18X40", "PL1/2X12", "HSS6X6X3/8", "L4X4X3/8") without corrupting size
 * when materialType is a member role code like "B", "C", "M", "F", "D", "S".
 */
export function buildCleanSection(matType: string, size: string): { section: string; category: ShapeCategory } {
  const mType = (matType || "").trim().toUpperCase();
  const rawSize = (size || "").trim();

  // If size ALREADY contains a recognized shape profile prefix (W, S, HP, M, C, MC, WT, MT, ST, L, HSS, TS, RHS, SHS, PIPE, PL, PLT, FB, FL)
  const profileMatch = rawSize.match(/^(W|S|HP|M|C|MC|WT|MT|ST|L|HSS|TS|RHS|SHS|PIPE|PL|PLT|FB|FL)\s*\d/i)
    || rawSize.match(/^(PL|PLT|PLATE|FB|FL|BAR)\s*\d/i)
    || rawSize.match(/^(PIPE|RND)\s*\d/i);

  if (profileMatch) {
    const cleanSection = rawSize.toUpperCase().replace(/\s+/g, "");
    return { section: cleanSection, category: classifyProfile(cleanSection) };
  }

  // Check if mType is a valid shape category code
  if (mType && /^(W|S|HP|M|C|MC|WT|MT|ST|L|HSS|TS|RHS|SHS|PIPE|PL|PLT|FB|FL)$/i.test(mType)) {
    const combined = `${mType}${rawSize}`.toUpperCase().replace(/\s+/g, "");
    return { section: combined, category: classifyProfile(combined) };
  }

  // If mType is a role code (B, C, M, F, D, S, MAIN, FITTING, DETAIL, etc) or blank,
  // infer shape prefix from size format
  let inferredSection = rawSize.toUpperCase().replace(/\s+/g, "");
  if (/^\d+(?:\.\d+)?[Xx×]\d+(?:\.\d+)?$/.test(inferredSection)) {
    inferredSection = `W${inferredSection}`;
  } else if (/^\d+\/\d+[Xx×]\d+/.test(inferredSection)) {
    inferredSection = `PL${inferredSection}`;
  } else if (/^\d+[Xx×]\d+[Xx×]\d+/.test(inferredSection)) {
    inferredSection = `HSS${inferredSection}`;
  }

  const category = classifyProfile(inferredSection);
  return { section: inferredSection || rawSize || mType, category };
}

// ---------------------------------------------------------------------------
// Unified parsed BOM result (output of any parser)
// ---------------------------------------------------------------------------

export interface ParsedProject {
  jobNumber: string;
  jobName: string;
  customer: string;
  revision: string;
  date: string;
}

export interface ParsedMember {
  pieceMark: string;
  assemblyMark: string;
  section: string;         // profile/size string — "W18X40", "PL 1/2X12"
  materialType: string;    // raw type code: "W", "PL", "HSS", "SB", etc.
  grade: string;
  length: number;          // inches
  weight: number;          // lbs per piece
  quantity: number;
  finish: string;
  notes: string;
  category: ShapeCategory;
  sequence?: string;
  drawingNo?: string;
  drawingRev?: string;
  weightSource?: "file" | "calculated";
  unitWeightLbsPerFt?: number;
}

export interface ParsedPlate {
  plateMark: string;
  thickness: number;       // inches
  width: number;           // inches
  length: number;          // inches
  grade: string;
  quantity: number;
  weight: number;          // lbs per piece
}

export interface ParsedBolt {
  diameter: string;        // "3/4", "7/8", "1"
  length: number;          // inches
  grade: string;           // "A325", "A490"
  finish: string;
  quantity: number;
}

export interface ParsedWeld {
  weldType: string;        // "FILLET", "CJP", "PJP"
  weldSize: string;        // "5/16", "3/8"
  weldLength: number;      // inches
}

export interface ParsedHardware {
  description: string;
  quantity: number;
  weight: number;          // lbs
}

export interface ParsedBomResult {
  source: "kiss" | "eje" | "csv" | "xlsx";
  filename: string;
  project: ParsedProject;
  members: ParsedMember[];
  plates: ParsedPlate[];
  bolts: ParsedBolt[];
  welds: ParsedWeld[];
  hardware: ParsedHardware[];
  warnings: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Additional cost line items for estimate
// ---------------------------------------------------------------------------

export interface AdditionalCost {
  id: string;
  label: string;
  amount: number;
  is_percentage: boolean;
  percentage_basis: "material" | "subtotal" | "total";
  category: "hardware" | "subcontractor" | "equipment" | "tax_bond" | "other";
  description: string;
}

/** Default additional cost template for new estimates. */
export function defaultAdditionalCosts(): AdditionalCost[] {
  return [
    { id: crypto.randomUUID(), label: "Bolts & Connection Hardware", amount: 0, is_percentage: false, percentage_basis: "material", category: "hardware", description: "" },
    { id: crypto.randomUUID(), label: "Anchor Bolts / Embeds", amount: 0, is_percentage: false, percentage_basis: "material", category: "hardware", description: "" },
    { id: crypto.randomUUID(), label: "Subcontractor — Erection", amount: 0, is_percentage: false, percentage_basis: "subtotal", category: "subcontractor", description: "" },
    { id: crypto.randomUUID(), label: "Subcontractor — Detailing", amount: 0, is_percentage: false, percentage_basis: "subtotal", category: "subcontractor", description: "" },
    { id: crypto.randomUUID(), label: "Crane Rental", amount: 0, is_percentage: false, percentage_basis: "subtotal", category: "equipment", description: "" },
    { id: crypto.randomUUID(), label: "Sales Tax on Materials", amount: 0, is_percentage: true, percentage_basis: "material", category: "tax_bond", description: "" },
    { id: crypto.randomUUID(), label: "Performance / Payment Bond", amount: 0, is_percentage: true, percentage_basis: "total", category: "tax_bond", description: "" },
    { id: crypto.randomUUID(), label: "Permits & Insurance", amount: 0, is_percentage: false, percentage_basis: "subtotal", category: "other", description: "" },
  ];
}

// ---------------------------------------------------------------------------
// Aggregated material breakdown (output of bom-aggregator)
// ---------------------------------------------------------------------------

export interface AggregatedMaterial {
  shape: string;           // ShapeCategory name
  tons: number;
  price_per_ton: number;   // default pricing applied
  pieceCount: number;      // total pieces (qty × unique marks)
  uniqueMarks: number;
}

export interface AggregatedEstimate {
  project_name: string;
  gc_name: string;
  materials_breakdown: AggregatedMaterial[];
  unique_piece_marks: number;
  connection_complexity: string;
  additional_costs: AdditionalCost[];
  import_summary: {
    source: string;
    filename: string;
    parsed_at: string;
    member_count: number;
    plate_count: number;
    bolt_count: number;
    total_weight_lbs: number;
  };
}

// =============================================================================
// AISC Weight Calculator & Dimensional Utilities
// =============================================================================

export function parseFraction(s: string): number {
  const trimmed = (s || "").trim();
  if (!trimmed) return 0;
  const mixed = trimmed.match(/^(\d+)\s*-\s*(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]!, 10) + parseInt(mixed[2]!, 10) / parseInt(mixed[3]!, 10);
  const frac = trimmed.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1]!, 10) / parseInt(frac[2]!, 10);
  return parseFloat(trimmed) || 0;
}

/**
 * Parses any length representation (feet-inches-sixteenths, feet-inches, decimal inches, metric mm)
 * into a accurate total number of inches.
 */
export function parseLengthToInches(val: string | number): number {
  if (typeof val === "number") {
    if (isNaN(val) || val <= 0) return 0;
    if (val > 1000) return val / 25.4; // Metric mm -> inches
    return val;
  }

  const s = (val || "").trim();
  if (!s) return 0;

  // 1. Check SDS2 / Tekla FT-IN-16ths format: "20-06-08" or "20-06-00" or "20-6-8" or "240-00-00"
  const ftIn16 = s.match(/^(\d+)\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (ftIn16) {
    const feet = parseInt(ftIn16[1]!, 10);
    const inches = parseInt(ftIn16[2]!, 10);
    const sixteenths = parseInt(ftIn16[3]!, 10);
    if (feet >= 80) {
      // First number >= 80 is total length in inches (e.g. 240-00-00 = 240 inches), not feet!
      return feet + inches / 12 + sixteenths / 16;
    }
    return feet * 12 + inches + sixteenths / 16;
  }

  // 2. Check FT-IN with fraction or decimal: "20-6 1/2", "20-6.5", "20' 6 1/2"", "20'-6""
  const ftInFrac = s.match(/^(\d+)['\s-]+\s*(\d+)(?:\s+(\d+)\/(\d+)|[\s.-]+(\d+))?['"]?$/);
  if (ftInFrac) {
    const feet = parseInt(ftInFrac[1]!, 10);
    const inches = parseInt(ftInFrac[2]!, 10);
    let frac = 0;
    if (ftInFrac[3] && ftInFrac[4]) {
      frac = parseInt(ftInFrac[3], 10) / parseInt(ftInFrac[4], 10);
    } else if (ftInFrac[5]) {
      frac = parseFloat(`0.${ftInFrac[5]}`);
    }
    if (feet >= 80 && !s.includes("'")) {
      return feet + (inches + frac) / 12;
    }
    return feet * 12 + inches + frac;
  }

  // 3. Simple feet only: "20'"
  const ftOnly = s.match(/^(\d+)[']$/);
  if (ftOnly) {
    return parseInt(ftOnly[1]!, 10) * 12;
  }

  // 4. Plain decimal number or fraction: "246.5" or "246 1/2" or "20-6"
  const ftInSimple = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (ftInSimple) {
    const ft = parseInt(ftInSimple[1]!, 10);
    const inch = parseInt(ftInSimple[2]!, 10);
    if (ft >= 80) {
      // e.g. "240-00" -> 240 inches + sixteenths/decimals
      return ft + (inch < 16 ? inch / 16 : inch / 12);
    }
    if (inch < 12) return ft * 12 + inch;
  }

  const mixed = s.match(/^(\d+)\s*-\s*(\d+)\/(\d+)$/);
  if (mixed) {
    return parseInt(mixed[1]!, 10) + parseInt(mixed[2]!, 10) / parseInt(mixed[3]!, 10);
  }

  const fracMatch = s.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    return parseInt(fracMatch[1]!, 10) / parseInt(fracMatch[2]!, 10);
  }

  const num = parseFloat(s);
  if (!isNaN(num) && num > 0) {
    if (num > 1000) return num / 25.4; // Likely mm
    return num;
  }

  return 0;
}

export function formatFeetInches(inches: number): string {
  if (!inches || inches <= 0) return '0"';
  const feet = Math.floor(inches / 12);
  const remInches = Math.round((inches % 12) * 100) / 100;
  if (feet === 0) return `${remInches}"`;
  if (remInches === 0) return `${feet}'`;
  return `${feet}'-${remInches}"`;
}

/**
 * Calculates AISC standard per-piece weight (in lbs) for any structural shape,
 * angle, plate, HSS tube, or pipe based on standard AISC density and dimensions.
 */
export function calculateAiscWeight(
  section: string,
  lengthInches: number,
  category: ShapeCategory,
): { weightLbs: number; unitWeightLbsPerFt: number; isEstimated: boolean } {
  const sec = section.toUpperCase().replace(/\s+/g, "");

  // 1. Wide Flange, Channel, Tee: "W18X40", "18X40", "C10X20", "WT9X20", "S12X31.8", "MC12X45"
  const wflangeMatch = sec.match(/[A-Z]*?\d+(?:\.\d+)?[Xx×](\d+(?:\.\d+)?)/);
  if ((category === "Wide Flange" || category === "Channel" || category === "Tee") && wflangeMatch) {
    const unitWt = parseFloat(wflangeMatch[1]!);
    if (unitWt > 0) {
      const wt = (lengthInches / 12) * unitWt;
      return { weightLbs: Math.round(wt * 10) / 10, unitWeightLbsPerFt: unitWt, isEstimated: false };
    }
  }

  // 2. Angles: "L4X4X3/8", "4X4X3/8", "L3-1/2X3-1/2X1/4"
  if (category === "Angle" || /^L\d/i.test(sec)) {
    const parts = sec.replace(/^L/i, "").split(/[Xx×]/);
    if (parts.length >= 3) {
      const leg1 = parseFraction(parts[0]!);
      const leg2 = parseFraction(parts[1]!);
      const t = parseFraction(parts[2]!);
      if (leg1 > 0 && leg2 > 0 && t > 0) {
        const area = (leg1 + leg2 - t) * t;
        const unitWt = area * 3.403;
        const wt = (lengthInches / 12) * unitWt;
        return { weightLbs: Math.round(wt * 10) / 10, unitWeightLbsPerFt: Math.round(unitWt * 100) / 100, isEstimated: false };
      }
    }
  }

  // 3. Plate: "PL1/2X12", "1/2X12", "PLT3/4X18"
  if (category === "Plate" || /^PL/i.test(sec) || /^FB/i.test(sec)) {
    const clean = sec.replace(/^(PL|PLT|PLATE|FB|BAR)/i, "");
    const parts = clean.split(/[Xx×]/);
    if (parts.length >= 2) {
      const t = parseFraction(parts[0]!);
      const w = parseFraction(parts[1]!);
      if (t > 0 && w > 0) {
        const unitWt = t * w * 3.403;
        const wt = t * w * lengthInches * 0.2836;
        return { weightLbs: Math.round(wt * 10) / 10, unitWeightLbsPerFt: Math.round(unitWt * 100) / 100, isEstimated: false };
      }
    }
  }

  // 4. HSS Rectangular / Square: "HSS6X6X3/8", "TS8X4X1/4"
  if (category === "HSS / Tube" || /^HSS/i.test(sec) || /^TS/i.test(sec)) {
    const parts = sec.replace(/^(HSS|TS|RHS|SHS)/i, "").split(/[Xx×]/);
    if (parts.length >= 3) {
      const b = parseFraction(parts[0]!);
      const h = parseFraction(parts[1]!);
      const t = parseFraction(parts[2]!);
      if (b > 0 && h > 0 && t > 0) {
        const area = 2 * (b + h - 2 * t) * t;
        const unitWt = area * 3.403;
        const wt = (lengthInches / 12) * unitWt;
        return { weightLbs: Math.round(wt * 10) / 10, unitWeightLbsPerFt: Math.round(unitWt * 100) / 100, isEstimated: false };
      }
    }
  }

  // 5. Pipe: "PIPE4STD", "PIPE 6 SCH 40"
  if (category === "Pipe" || /^PIPE/i.test(sec)) {
    const pipeTable: Record<string, number> = {
      "2": 3.66, "2.5": 5.79, "3": 7.58, "3.5": 9.11, "4": 10.79,
      "5": 14.63, "6": 18.97, "8": 28.55, "10": 40.48, "12": 49.56,
    };
    const sizeMatch = sec.match(/\d+(?:\.\d+)?/);
    if (sizeMatch && pipeTable[sizeMatch[0]]) {
      const unitWt = pipeTable[sizeMatch[0]]!;
      const wt = (lengthInches / 12) * unitWt;
      return { weightLbs: Math.round(wt * 10) / 10, unitWeightLbsPerFt: unitWt, isEstimated: false };
    }
  }

  // Generic fallback if second number exists
  if (wflangeMatch) {
    const unitWt = parseFloat(wflangeMatch[1]!);
    if (unitWt > 0) {
      const wt = (lengthInches / 12) * unitWt;
      return { weightLbs: Math.round(wt * 10) / 10, unitWeightLbsPerFt: unitWt, isEstimated: true };
    }
  }

  return { weightLbs: 0, unitWeightLbsPerFt: 0, isEstimated: true };
}
