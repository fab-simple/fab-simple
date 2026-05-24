import { describe, it, expect } from "vitest";
import { generateAiaG702, generateQcReport, type BillingApp, type QcReportData } from "@/lib/pdf";

const sampleBilling: BillingApp = {
  application_number: 1, application_date: "2026-05-01",
  period_from: "2026-04-01", period_to: "2026-04-30",
  contract_sum: 100000, net_change_by_co: 5000,
  contract_sum_to_date: 105000, total_completed_stored: 60000,
  retainage_pct: 10, retainage: 6000,
  total_earned_less_retainage: 54000, less_previous: 30000,
  current_payment_due: 24000,
  project_name: "Test", project_number: "PRJ-2026-0001",
  gc_name: "ACME GC", contractor_name: "Test Steel",
  lines: [
    { line_number: 1, description: "Materials", scheduled_value: 50000, from_previous: 20000, this_period: 10000, materials_stored: 0, total_completed: 30000, completion_pct: 60, balance_to_finish: 20000, retainage: 3000 },
  ],
};

const sampleQc: QcReportData = {
  welds: [{ weld_number: "WLD-0001", project_id: "p1", result: "pass", inspected_at: "2026-05-01" }],
  paint: [{ insp_number: "PI-0001", project_id: "p1", result: "pass", dft_avg: 4.2, created_at: "2026-05-02" }],
  ncrs: [{ ncr_number: "NCR-0001", description: "Bad weld", status: "open", created_at: "2026-05-03" }],
  aisc: [{ section_ref: "§5.1", item_text: "Cuts", status: "open", category: "Fabrication" }],
  generated_at: "2026-05-04T00:00:00Z",
  project_id: "p1",
  project_name: "Test Project",
};

describe("PDF generators", () => {
  it("AIA G702 produces a multi-page PDF", () => {
    const doc = generateAiaG702(sampleBilling);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it("QC Report produces a multi-page PDF when data is present", () => {
    const doc = generateQcReport(sampleQc);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it("QC Report still renders with empty datasets", () => {
    const empty: QcReportData = { welds: [], paint: [], ncrs: [], aisc: [], generated_at: "2026-01-01", project_id: null };
    const doc = generateQcReport(empty);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
