import { describe, it, expect } from "vitest";
import { parseKissFile } from "../lib/parsers/kiss-parser";
import { aggregateBom } from "../lib/parsers/bom-aggregator";
import { parseLengthToInches, buildCleanSection } from "../lib/parsers/types";

describe("parseLengthToInches", () => {
  it("parses SDS2 feet-inch-16ths strings (20-06-08)", () => {
    expect(parseLengthToInches("20-06-08")).toBe(246.5);
    expect(parseLengthToInches("20-06-00")).toBe(246);
  });

  it("parses Tekla feet-inches strings (20-6 1/2)", () => {
    expect(parseLengthToInches("20-6 1/2")).toBe(246.5);
    expect(parseLengthToInches("20' 6\"")).toBe(246);
  });

  it("parses decimal inches and mm", () => {
    expect(parseLengthToInches("240.00")).toBe(240);
    expect(parseLengthToInches("6096")).toBeCloseTo(240, 1);
  });
});

describe("buildCleanSection", () => {
  it("cleans member role codes (B, C, M, F) without prepending to profiles", () => {
    expect(buildCleanSection("B", "W18X40")).toEqual({ section: "W18X40", category: "Wide Flange" });
    expect(buildCleanSection("C", "W14X90")).toEqual({ section: "W14X90", category: "Wide Flange" });
    expect(buildCleanSection("M", "HSS8X8X1/2")).toEqual({ section: "HSS8X8X1/2", category: "HSS / Tube" });
    expect(buildCleanSection("F", "PL1/2X12")).toEqual({ section: "PL1/2X12", category: "Plate" });
  });

  it("combines raw shape codes (W, PL, HSS, L) with size numbers", () => {
    expect(buildCleanSection("W", "18X40")).toEqual({ section: "W18X40", category: "Wide Flange" });
    expect(buildCleanSection("PL", "1/2X12")).toEqual({ section: "PL1/2X12", category: "Plate" });
    expect(buildCleanSection("HSS", "6X6X3/8")).toEqual({ section: "HSS6X6X3/8", category: "HSS / Tube" });
  });
});

describe("parseKissFile & aggregateBom", () => {
  it("correctly parses KISS file and calculates tons and shapes", () => {
    const kissText = `
KISS,1.0,SDS2
H,JOB100,WAREHOUSE PHASE 1,ACME BUILDERS,2026-07-28,12:00:00,INCH
D,DWG-1,0,ASM1,M1,2,B,W18X40,A992,20-00-00,800.00,PAINT,BEAM 1
D,DWG-1,0,ASM2,M2,4,C,HSS8X8X1/2,A500,15-00-00,735.00,NONE,COLUMN
D,DWG-2,0,ASM3,P1,10,F,PL1/2X12,A36,1-00-00,20.40,NONE,GUSSET
`.trim();

    const parsed = parseKissFile(kissText, "sample.kss");
    expect(parsed.members).toHaveLength(3);

    // M1: 2 pcs W18X40 @ 20' = 20 * 40 = 800 lbs/pc -> line total = 1600 lbs
    expect(parsed.members[0]?.section).toBe("W18X40");
    expect(parsed.members[0]?.category).toBe("Wide Flange");
    expect(parsed.members[0]?.length).toBe(240); // 20 feet = 240 inches

    // M2: 4 pcs HSS8X8X1/2 @ 15'
    expect(parsed.members[1]?.section).toBe("HSS8X8X1/2");
    expect(parsed.members[1]?.category).toBe("HSS / Tube");
    expect(parsed.members[1]?.length).toBe(180); // 15 feet = 180 inches

    // P1: 10 pcs PL1/2X12 @ 1'
    expect(parsed.members[2]?.section).toBe("PL1/2X12");
    expect(parsed.members[2]?.category).toBe("Plate");

    const aggregated = aggregateBom(parsed);
    expect(aggregated.materials_breakdown.length).toBeGreaterThanOrEqual(2);

    const wfGroup = aggregated.materials_breakdown.find(m => m.shape === "Wide Flange");
    expect(wfGroup).toBeDefined();
    // 1600 lbs / 2000 = 0.8 tons
    expect(wfGroup?.tons).toBeCloseTo(0.8, 1);
  });

  it("parseSheetFile correctly converts .kss file into tabular rows for import pipeline", async () => {
    const { parseSheetFile, isKissFile, getFileFormatBadge } = await import("../lib/sheet-import");
    const kissContent = `
KISS,1.0,Tekla Structures
H,JOB42,STADIUM EXPANSION,GENERAL CONTRACTOR,2026-09-01,08:30:00,INCH
D,D-101,A,B10,b101,3,W,W24X68,A992,30-00-00,2040.00,PAINT,BEAM 10
D,D-102,B,C20,c201,2,C,HSS10X10X1/2,A500,20-00-00,1234.00,NONE,COLUMN 20
`.trim();

    const mockKssFile = new File([kissContent], "tekla_export.kss", { type: "text/plain" });
    expect(isKissFile(mockKssFile)).toBe(true);
    expect(getFileFormatBadge(mockKssFile).label).toBe("KISS");

    const rows = await parseSheetFile(mockKssFile);
    expect(rows).toHaveLength(2);

    expect(rows[0]?.["Part Mark"]).toBe("b101");
    expect(rows[0]?.["Quantity"]).toBe("3");
    expect(rows[0]?.["Profile"]).toBe("W24X68");
    expect(rows[0]?.["Grade"]).toBe("A992");
    expect(rows[0]?.["Assembly Mark"]).toBe("B10");
    expect(rows[0]?.["Length"]).toBe("30'");
    expect(rows[0]?.["Part Weight"]).toBe("2040");

    expect(rows[1]?.["Part Mark"]).toBe("c201");
    expect(rows[1]?.["Quantity"]).toBe("2");
    expect(rows[1]?.["Profile"]).toBe("HSS10X10X1/2");
    expect(rows[1]?.["Assembly Mark"]).toBe("C20");

    const { autoDetectMapping } = await import("../lib/sheet-import");
    const testFields = [
      { key: "part_mark", label: "Part Mark", required: true, aliases: ["mark", "part mark", "part_mark"] },
      { key: "quantity", label: "Quantity", aliases: ["qty", "quantity"] },
      { key: "profile", label: "Profile Size", aliases: ["profile", "section"] },
      { key: "length", label: "Length", aliases: ["length"] },
      { key: "grade", label: "Grade", aliases: ["grade", "material"] },
      { key: "weight", label: "Part Weight", aliases: ["part weight", "weight"] },
      { key: "assembly_mark", label: "Assembly Mark", aliases: ["assembly_mark", "assembly mark"] },
    ];
    const mapping = autoDetectMapping(Object.keys(rows[0]!), testFields);
    expect(mapping.part_mark).toBe("Part Mark");
    expect(mapping.quantity).toBe("Quantity");
    expect(mapping.profile).toBe("Profile");
    expect(mapping.length).toBe("Length");
    expect(mapping.grade).toBe("Grade");
    expect(mapping.weight).toBe("Part Weight");
    expect(mapping.assembly_mark).toBe("Assembly Mark");
  });

  describe("Fabrication Industry Reference Specification Tests", () => {
    it("handles D angle record with AISC calculated weight instead of length", () => {
      // D,2000A9,0,2000A9,2000A9,132,L,3X3X1/4,A36,606.42,SHOP PRIMER,ANGLE
      const kissText = `
KISS,1.0,SDS2
H,JOB2000,FAB SAMPLE,CLIENT,2026-09-15,12:00:00,M
D,2000A9,0,2000A9,2000A9,132,L,3X3X1/4,A36,606.42,SHOP PRIMER,ANGLE
`.trim();

      const parsed = parseKissFile(kissText, "sample_angle.kss");
      expect(parsed.members).toHaveLength(1);

      const m = parsed.members[0]!;
      expect(m.pieceMark).toBe("2000A9");
      expect(m.assemblyMark).toBe("2000A9");
      expect(m.quantity).toBe(132);
      expect(m.category).toBe("Angle");
      expect(m.section).toBe("L3X3X1/4");
      expect(m.grade).toBe("A36");
      expect(m.finish).toBe("SHOP PRIMER");
      expect(m.notes).toContain("ANGLE");

      // Length is 606.42 mm -> formatted exactly as 1'-11 7/8" (23.875 inches = 1.9896 feet)
      expect(m.length).toBeCloseTo(23.875, 2);
      expect(m.lengthFormatted).toBe("1'-11 7/8\"");

      // Weight rule: Length 606.42 must NOT be treated as weight!
      // Unit weight of L3X3X1/4 is 4.8914 lbs/ft. Piece weight is 9.73 lbs.
      expect(m.weight).not.toBe(606.42);
      expect(m.weight).toBeCloseTo(9.73, 2);

      // Total line weight: 132 * 9.73187 = exact 1285 lbs!
      expect(m.totalWeight).toBe(1285);

      const aggregated = aggregateBom(parsed);
      const angleGroup = aggregated.materials_breakdown.find((g) => g.shape === "Angle");
      expect(angleGroup).toBeDefined();
      expect(angleGroup?.tons).toBeCloseTo(0.64, 2);
    });

    it("identifies HS bolt records from D line and excludes them from structural members & tonnage", () => {
      // D,2000A9,0,2000A9,,132,HS,1/2X2,A325,50.80,,Field
      const kissText = `
KISS,1.0,SDS2
H,JOB2000,FAB SAMPLE,CLIENT,2026-09-15,12:00:00,M
D,2000A9,0,2000A9,,132,HS,1/2X2,A325,50.80,,Field
`.trim();

      const parsed = parseKissFile(kissText, "sample_bolt.kss");
      // Must NOT be in structural members
      expect(parsed.members).toHaveLength(0);

      // Must be parsed into bolts
      expect(parsed.bolts).toHaveLength(1);
      const b = parsed.bolts[0]!;
      expect(b.quantity).toBe(132);
      expect(b.diameter).toBe("1/2");
      expect(b.length).toBe(2);
      expect(b.grade).toBe("A325");
      expect(b.installation).toBe("Field");
      expect(b.assemblyMark).toBe("2000A9");

      // Aggregated estimate structural tons should be 0, but bolt line items are generated
      const aggregated = aggregateBom(parsed);
      expect(aggregated.materials_breakdown).toHaveLength(0);
    });

    it("handles L hole and weld operations without confusing holes as bolts", () => {
      // L,Holes,8,20.64,9.53,Round
      // L,weld,1,1879.60,6.35,W10
      const kissText = `
KISS,1.0,SDS2
H,JOB2000,FAB SAMPLE,CLIENT,2026-09-15,12:00:00,M
D,2000A9,0,2000A9,2000A9,1,L,3X3X1/4,A36,606.42,SHOP PRIMER,ANGLE
L,Holes,8,20.64,9.53,Round
L,weld,1,1879.60,6.35,W10
`.trim();

      const parsed = parseKissFile(kissText, "operations.kss");
      expect(parsed.members).toHaveLength(1);
      const m = parsed.members[0]!;

      // Holes must be attached to member, NOT converted into bolts!
      expect(m.holes).toBeDefined();
      expect(m.holes).toHaveLength(1);
      expect(m.holes![0]!.count).toBe(8);
      expect(m.holes![0]!.diameter).toBe("20.64");
      expect(m.holes![0]!.depth).toBe("9.53");
      expect(m.holes![0]!.shape).toBe("Round");

      // Bolts array must be empty (holes are NOT bolts)
      expect(parsed.bolts).toHaveLength(0);

      // Weld must be recorded
      expect(m.welds).toBeDefined();
      expect(m.welds).toHaveLength(1);
      expect(m.welds![0]!.weldLength).toBe(1879.60);
      expect(m.welds![0]!.weldSize).toBe("6.35");
      expect(m.welds![0]!.weldType).toBe("W10");
      expect(parsed.welds).toHaveLength(1);
    });

    it("ignores S,1,1 control/status records without adding parts, weight, or quantity", () => {
      const kissText = `
KISS,1.0,SDS2
H,JOB2000,FAB SAMPLE,CLIENT,2026-09-15,12:00:00,M
D,2000A9,0,2000A9,2000A9,132,L,3X3X1/4,A36,606.42,SHOP PRIMER,ANGLE
S,1,1
`.trim();

      const parsed = parseKissFile(kissText, "control_status.kss");
      // S,1,1 must NOT create a 2nd part or add extra weight
      expect(parsed.members).toHaveLength(1);
      expect(parsed.bolts).toHaveLength(0);
      expect(parsed.members[0]!.quantity).toBe(132);
    });

    it("correctly parses a complete reference file combining D, L, S, * records", () => {
      const kissText = `
KISS,1.0,SDS2
H,2000A9,FAB PROJECT,ACME FAB,2026-09-15,18:00:00,M
* ==========================================
* STRUCTURAL MEMBERS
* ==========================================
D,2000A9,0,2000A9,2000A9,132,L,3X3X1/4,A36,606.42,SHOP PRIMER,ANGLE
L,Holes,8,20.64,9.53,Round
L,weld,1,1879.60,6.35,W10
S,1,1
* ==========================================
* HARDWARE & BOLTS
* ==========================================
D,2000A9,0,2000A9,,132,HS,1/2X2,A325,50.80,,Field
* END OF FILE
`.trim();

      const parsed = parseKissFile(kissText, "complete_reference.kss");
      expect(parsed.errors).toHaveLength(0);

      // Only 1 structural member (the angle)
      expect(parsed.members).toHaveLength(1);
      expect(parsed.members[0]!.pieceMark).toBe("2000A9");
      expect(parsed.members[0]!.quantity).toBe(132);

      // 1 bolt group (the HS field bolts)
      expect(parsed.bolts).toHaveLength(1);
      expect(parsed.bolts[0]!.diameter).toBe("1/2");
      expect(parsed.bolts[0]!.length).toBe(2);
      expect(parsed.bolts[0]!.quantity).toBe(132);
      expect(parsed.bolts[0]!.installation).toBe("Field");

      // Total estimate aggregation
      const aggregated = aggregateBom(parsed);
      expect(aggregated.materials_breakdown).toHaveLength(1);
      expect(aggregated.materials_breakdown[0]!.shape).toBe("Angle");
      expect(aggregated.materials_breakdown[0]!.tons).toBeCloseTo(0.64, 1);
    });

    it("correctly evaluates hybrid KISS files with INCH header flag and mm dimensions without ballooning weight to 32633 lbs", () => {
      // CAD exports often set H-flag to INCH (due to AISC imperial profile catalog), but output mm lengths (606.42).
      const kissText = `
KISS,1.0,TEKLA
H,2000A9,FAB PROJECT,ACME FAB,2026-09-15,18:00:00,INCH
D,2000A9,0,2000A9,2000A9,132,L,3X3X1/4,A36,606.42,SHOP PRIMER,ANGLE
D,2000A9,0,2000A9,,132,HS,1/2X2,A325,50.80,,Field
`.trim();

      const parsed = parseKissFile(kissText, "hybrid_tekla.kss");
      expect(parsed.members).toHaveLength(1);

      const m = parsed.members[0]!;
      expect(m.pieceMark).toBe("2000A9");
      // Must NOT be 606.42 inches (50.5 ft)
      expect(m.length).toBeCloseTo(23.875, 2);
      expect(m.lengthFormatted).toBe("1'-11 7/8\"");

      // Must NOT be 32,633 lbs! Must be 1285 lbs (0.64 tons)
      expect(m.totalWeight).not.toBe(32633);
      expect(m.totalWeight).toBe(1285);
      expect(m.weight).toBeCloseTo(9.73, 2);

      const aggregated = aggregateBom(parsed);
      const angle = aggregated.materials_breakdown.find((x) => x.shape === "Angle");
      expect(angle).toBeDefined();
      expect(angle!.tons).toBeCloseTo(0.64, 2);

      // Bolt must also be 2 inches (from 50.80 mm), not 50.8 inches
      expect(parsed.bolts).toHaveLength(1);
      expect(parsed.bolts[0]!.length).toBe(2);
    });

    it("supports explicit forceUnits options (metric override vs imperial override)", () => {
      const kissText = `
KISS,1.0,TEKLA
H,2000A9,FAB PROJECT,ACME FAB,2026-09-15,18:00:00
D,2000A9,0,2000A9,2000A9,132,L,3X3X1/4,A36,606.42,SHOP PRIMER,ANGLE
`.trim();

      const parsedMetric = parseKissFile(kissText, "test.kss", { forceUnits: "metric" });
      expect(parsedMetric.members[0]!.totalWeight).toBe(1285);
      expect(parsedMetric.members[0]!.lengthFormatted).toBe("1'-11 7/8\"");
    });
  });
});


