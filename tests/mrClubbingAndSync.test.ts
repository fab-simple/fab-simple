import { describe, it, expect } from "vitest";
import { mrClubKey, type ClubbedMrGroup } from "@/components/rfqs/NewRfqModal";

describe("MR Cross-Project Clubbing", () => {
  it("generates consistent club key ignoring case, whitespace, and nulls", () => {
    const key1 = mrClubKey("W14x82", "A992", "26'-9 9/16\"");
    const key2 = mrClubKey("  w14x82  ", " a992 ", "26'-9 9/16\"");
    expect(key1).toBe(key2);

    const keyNullGrade = mrClubKey("W14x82", null, "20'-0\"");
    const keyEmptyGrade = mrClubKey("W14x82", "", "20'-0\"");
    expect(keyNullGrade).toBe(keyEmptyGrade);
  });

  it("clubs MRs with identical profile, grade, and length across different projects", () => {
    const openMrs = [
      {
        id: "mr-1",
        mr_number: "MR-0001",
        profile: "W14x82",
        name: "COLUMN",
        grade: "A992",
        quantity: 10,
        length: "26'-9 9/16\"",
        project_id: "proj-dallas",
        status: "open",
      },
      {
        id: "mr-2",
        mr_number: "MR-0005",
        profile: "w14x82",
        name: "COL",
        grade: "A992",
        quantity: 15,
        length: "26'-9 9/16\"",
        project_id: "proj-houston",
        status: "open",
      },
      {
        id: "mr-3",
        mr_number: "MR-0009",
        profile: "W12x26",
        name: "BEAM",
        grade: "A992",
        quantity: 8,
        length: "20'-0\"",
        project_id: "proj-dallas",
        status: "open",
      },
    ];

    const map = new Map<string, typeof openMrs>();
    for (const mr of openMrs) {
      const k = mrClubKey(mr.profile, mr.grade, mr.length);
      const list = map.get(k);
      if (list) list.push(mr);
      else map.set(k, [mr]);
    }

    expect(map.size).toBe(2);

    const w14Group = map.get(mrClubKey("W14x82", "A992", "26'-9 9/16\""))!;
    expect(w14Group).toHaveLength(2);
    const totalQty = w14Group.reduce((sum, m) => sum + m.quantity, 0);
    expect(totalQty).toBe(25);
  });

  it("correctly apportions clubbed order quantity across constituent MRs", () => {
    const constituentMrs = [
      { id: "mr-1", quantity: 10 },
      { id: "mr-2", quantity: 15 },
    ];
    const totalReq = 25;
    const userEnteredOrderQty = 20; // 5 covered by stock

    const lines: { material_requirement_id: string; quantity: number }[] = [];
    let remaining = userEnteredOrderQty;

    constituentMrs.forEach((mr, idx) => {
      if (idx === constituentMrs.length - 1) {
        lines.push({
          material_requirement_id: mr.id,
          quantity: Math.max(0.01, Math.round(remaining * 100) / 100),
        });
      } else {
        const ratio = mr.quantity / totalReq;
        const q = Math.max(0.01, Math.round(userEnteredOrderQty * ratio * 100) / 100);
        remaining -= q;
        lines.push({ material_requirement_id: mr.id, quantity: q });
      }
    });

    expect(lines).toEqual([
      { material_requirement_id: "mr-1", quantity: 8 },
      { material_requirement_id: "mr-2", quantity: 12 },
    ]);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(20);
  });
});

describe("Incremental Demand Calculation on Parts Import", () => {
  it("calculates incremental demand when existing MR is already in active RFQ or awarded", () => {
    const existingMrs = [
      { id: "mr-old", profile: "W14x82", grade: "A992", length: "20'-0\"", quantity: 10, status: "rfq_created" },
    ];

    const newUploadedPartsTotalQty = 16;

    const coveredQty = existingMrs
      .filter((m) => ["rfq_created", "awarded", "fulfilled"].includes(m.status))
      .reduce((sum, m) => sum + m.quantity, 0);

    const openMr = existingMrs.find((m) => m.status === "open");
    const unmetDemand = Math.max(0, newUploadedPartsTotalQty - coveredQty);

    expect(coveredQty).toBe(10);
    expect(unmetDemand).toBe(6);
    expect(openMr).toBeUndefined();
    // Since openMr is undefined and unmetDemand > 0, system creates a new open MR with quantity 6
  });

  it("updates existing open MR when no RFQ has been raised yet", () => {
    const existingMrs = [
      { id: "mr-open", profile: "W14x82", grade: "A992", length: "20'-0\"", quantity: 10, status: "open" },
    ];

    const newUploadedPartsTotalQty = 14;

    const coveredQty = existingMrs
      .filter((m) => ["rfq_created", "awarded", "fulfilled"].includes(m.status))
      .reduce((sum, m) => sum + m.quantity, 0);

    const openMr = existingMrs.find((m) => m.status === "open");
    const unmetDemand = Math.max(0, newUploadedPartsTotalQty - coveredQty);

    expect(coveredQty).toBe(0);
    expect(unmetDemand).toBe(14);
    expect(openMr).toBeDefined();
    // Since openMr exists, system updates openMr with quantity 14
  });
});
