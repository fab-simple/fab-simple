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
});

