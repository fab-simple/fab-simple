import { describe, it, expect } from "vitest";

describe("BOM Import Part Mark Deduplication", () => {
  it("merges in-file duplicate part marks and sums quantities", () => {
    interface IncomingRow {
      part_mark: string;
      profile: string;
      quantity: number;
      length: string;
    }

    const rows: IncomingRow[] = [
      { part_mark: "MK-101", profile: "W14X82", quantity: 2, length: "20'-0\"" },
      { part_mark: "MK-102", profile: "W12X26", quantity: 1, length: "15'-0\"" },
      { part_mark: "MK-101", profile: "W14X82", quantity: 3, length: "20'-0\"" }, // Duplicate in same file
    ];

    const pendingInsertMap = new Map<string, IncomingRow>();
    const skipped: { row: number; part_mark: string; reason: string }[] = [];

    rows.forEach((row, i) => {
      const mark = row.part_mark.trim();
      const existingPending = pendingInsertMap.get(mark);
      if (existingPending) {
        existingPending.quantity += row.quantity;
        skipped.push({
          row: i,
          part_mark: mark,
          reason: `duplicate part mark in file — merged quantity (+${row.quantity}) with earlier row`,
        });
      } else {
        pendingInsertMap.set(mark, { ...row });
      }
    });

    const finalInserts = Array.from(pendingInsertMap.values());
    expect(finalInserts).toHaveLength(2);

    const mk101 = pendingInsertMap.get("MK-101")!;
    expect(mk101.quantity).toBe(5);

    const mk102 = pendingInsertMap.get("MK-102")!;
    expect(mk102.quantity).toBe(1);

    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.part_mark).toBe("MK-101");
    expect(skipped[0]?.reason).toContain("merged quantity (+3)");
  });

  it("handles whitespace variations consistently without duplicate keys", () => {
    const rawMarks = ["MK-101", "  MK-101 ", "MK-101  "];
    const uniqueMarks = new Set(rawMarks.map((m) => m.trim()));
    expect(uniqueMarks.size).toBe(1);
  });
});
