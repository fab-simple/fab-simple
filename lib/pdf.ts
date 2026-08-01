// Client-side PDF generators (jsPDF + autoTable).
// Three reports:
//   1. AIA G702/G703 Application for Payment
//   2. QC Report (welds + paint + AISC + NCRs)
//   3. RFQ (Request for Quote) — Sourcing Workflow, spec §15.1 D11
//
// All are generated from data the API returns; no server-side rendering needed.

import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

// ---------------------------------------------------------------------------
// AIA G702 / G703
// ---------------------------------------------------------------------------
export interface BillingApp {
  application_number: number;
  application_date: string;
  period_from: string;
  period_to: string;
  contract_sum: number;
  net_change_by_co: number;
  contract_sum_to_date: number;
  total_completed_stored: number;
  retainage_pct: number;
  retainage: number;
  total_earned_less_retainage: number;
  less_previous: number;
  current_payment_due: number;
  project_name: string;
  project_number: string;
  gc_name: string;
  contractor_name: string;
  lines: Array<{
    line_number: number;
    description: string;
    scheduled_value: number;
    from_previous: number;
    this_period: number;
    materials_stored: number;
    total_completed: number;
    completion_pct: number;
    balance_to_finish: number;
    retainage: number;
  }>;
}

export function generateAiaG702(app: BillingApp): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();

  // ---- G702 Cover ----
  doc.setFontSize(16).setFont("helvetica", "bold")
     .text("APPLICATION AND CERTIFICATE FOR PAYMENT", W / 2, 50, { align: "center" });
  doc.setFontSize(9).setFont("helvetica", "normal")
     .text("AIA Document G702 — equivalent format", W / 2, 64, { align: "center" });

  // Header block
  doc.setFontSize(9);
  let y = 96;
  const labelCol = 50, valCol = 200;
  const printRow = (label: string, val: string) => {
    doc.setFont("helvetica", "bold").text(label, labelCol, y);
    doc.setFont("helvetica", "normal").text(val, valCol, y);
    y += 14;
  };
  printRow("TO OWNER:", app.gc_name);
  printRow("FROM CONTRACTOR:", app.contractor_name);
  printRow("PROJECT:", `${app.project_name} (${app.project_number})`);
  printRow("APPLICATION NO.:", String(app.application_number));
  printRow("APPLICATION DATE:", new Date(app.application_date).toLocaleDateString());
  printRow("PERIOD FROM / TO:", `${new Date(app.period_from).toLocaleDateString()}  →  ${new Date(app.period_to).toLocaleDateString()}`);

  // Summary box
  y += 12;
  const lines: [string, number][] = [
    ["1. ORIGINAL CONTRACT SUM", app.contract_sum],
    ["2. NET CHANGE BY CHANGE ORDERS", app.net_change_by_co],
    ["3. CONTRACT SUM TO DATE", app.contract_sum_to_date],
    ["4. TOTAL COMPLETED & STORED", app.total_completed_stored],
    [`5. RETAINAGE (${app.retainage_pct}%)`, app.retainage],
    ["6. TOTAL EARNED LESS RETAINAGE", app.total_earned_less_retainage],
    ["7. LESS PREVIOUS CERTIFICATES", app.less_previous],
    ["8. CURRENT PAYMENT DUE", app.current_payment_due],
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: 50, right: 50 },
    head: [["", "Amount"]],
    body: lines.map(([k, v]) => [k, `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`]),
    theme: "grid",
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
  });

  // ---- G703 Continuation ----
  doc.addPage("letter", "landscape");
  doc.setFontSize(13).setFont("helvetica", "bold")
     .text("CONTINUATION SHEET — Schedule of Values", doc.internal.pageSize.getWidth() / 2, 40, { align: "center" });
  doc.setFontSize(8).setFont("helvetica", "normal")
     .text(`Application No. ${app.application_number} · ${app.project_name}`, doc.internal.pageSize.getWidth() / 2, 54, { align: "center" });

  const body: RowInput[] = app.lines.map((l) => [
    l.line_number,
    l.description,
    `$${l.scheduled_value.toLocaleString()}`,
    `$${l.from_previous.toLocaleString()}`,
    `$${l.this_period.toLocaleString()}`,
    `$${l.materials_stored.toLocaleString()}`,
    `$${l.total_completed.toLocaleString()}`,
    `${l.completion_pct}%`,
    `$${l.balance_to_finish.toLocaleString()}`,
    `$${l.retainage.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: 70,
    head: [["A", "Description", "Sched Val", "From Prev", "This Period", "Mat'l Stored", "Total Cmp", "%", "Bal Finish", "Retain"]],
    body,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { halign: "center", cellWidth: 24 },
      2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" },
      5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" },
      8: { halign: "right" }, 9: { halign: "right" },
    },
  });

  return doc;
}

// ---------------------------------------------------------------------------
// QC Report
// ---------------------------------------------------------------------------
export interface QcReportData {
  welds: Array<{ weld_number: string; project_id: string; result: string; inspected_at: string | null }>;
  paint: Array<{ insp_number: string; project_id: string; result: string; dft_avg: number | null; created_at: string }>;
  ncrs: Array<{ ncr_number: string; description: string; status: string; created_at: string }>;
  aisc: Array<{ section_ref: string; item_text: string; status: string; category: string }>;
  generated_at: string;
  project_id: string | null;
  project_name?: string;
}

export function generateQcReport(data: QcReportData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFontSize(18).setFont("helvetica", "bold").text("QC INSPECTION REPORT", W / 2, 50, { align: "center" });
  doc.setFontSize(9).setFont("helvetica", "normal")
     .text(`Generated ${new Date(data.generated_at).toLocaleString()}${data.project_name ? "  ·  Project: " + data.project_name : ""}`, W / 2, 68, { align: "center" });

  const passWelds = data.welds.filter((w) => w.result === "pass").length;
  const passPaint = data.paint.filter((p) => p.result === "pass").length;
  const openNcrs = data.ncrs.filter((n) => n.status === "open").length;

  autoTable(doc, {
    startY: 90,
    head: [["Metric", "Value"]],
    body: [
      ["Total weld inspections", `${data.welds.length} (${passWelds} pass / ${data.welds.length - passWelds} fail)`],
      ["Total paint inspections", `${data.paint.length} (${passPaint} pass / ${data.paint.length - passPaint} fail)`],
      // AISC items use the `aisc_status` enum: 'open' | 'done' | 'hold' | 'na'.
      // The signed-off items are 'done'. The old "complete" filter always
      // returned 0 — the binder PDF was a permanent zero-progress lie.
      ["AISC checklist items", `${data.aisc.length} (${data.aisc.filter((a) => a.status === "done").length} done, ${data.aisc.filter((a) => a.status === "open").length} open)`],
      ["Non-conformance reports", `${data.ncrs.length} (${openNcrs} open)`],
    ],
    theme: "grid",
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
  });

  // Welds
  if (data.welds.length) {
    doc.addPage();
    doc.setFontSize(13).setFont("helvetica", "bold").text("Weld Inspections (AWS D1.1)", 50, 50);
    autoTable(doc, {
      startY: 60,
      head: [["Weld #", "Result", "Inspected"]],
      body: data.welds.map((w) => [w.weld_number, w.result, w.inspected_at ? new Date(w.inspected_at).toLocaleString() : "—"]),
      theme: "striped", headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9 }, bodyStyles: { fontSize: 8 },
    });
  }

  // Paint
  if (data.paint.length) {
    doc.addPage();
    doc.setFontSize(13).setFont("helvetica", "bold").text("Paint / DFT Inspections", 50, 50);
    autoTable(doc, {
      startY: 60,
      head: [["Insp #", "Result", "DFT Avg (mils)", "Date"]],
      body: data.paint.map((p) => [p.insp_number, p.result, p.dft_avg?.toFixed(1) ?? "—", new Date(p.created_at).toLocaleDateString()]),
      theme: "striped", headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9 }, bodyStyles: { fontSize: 8 },
    });
  }

  // NCRs
  if (data.ncrs.length) {
    doc.addPage();
    doc.setFontSize(13).setFont("helvetica", "bold").text("Non-Conformance Reports", 50, 50);
    autoTable(doc, {
      startY: 60,
      head: [["NCR #", "Status", "Description", "Opened"]],
      body: data.ncrs.map((n) => [n.ncr_number, n.status, n.description, new Date(n.created_at).toLocaleDateString()]),
      theme: "striped", headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontSize: 9 }, bodyStyles: { fontSize: 8 },
      columnStyles: { 2: { cellWidth: 250 } },
    });
  }

  // AISC
  if (data.aisc.length) {
    doc.addPage();
    doc.setFontSize(13).setFont("helvetica", "bold").text("AISC 303 Checklist", 50, 50);
    autoTable(doc, {
      startY: 60,
      head: [["§", "Category", "Item", "Status"]],
      body: data.aisc.map((a) => [a.section_ref, a.category, a.item_text, a.status]),
      theme: "striped", headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9 }, bodyStyles: { fontSize: 8 },
      columnStyles: { 2: { cellWidth: 290 } },
    });
  }

  return doc;
}

// ---------------------------------------------------------------------------
// RFQ (Request for Quote) — Sourcing Workflow
// ---------------------------------------------------------------------------
export interface RfqPdfLine {
  profile: string;
  grade: string | null;
  quantity: number;
  length: string | null;
}

export interface RfqPdfData {
  rfq_number: string;
  delivery_requirement: string | null;
  notes: string | null;
  created_at: string;
  contractor_name: string;
  lines: RfqPdfLine[];
}

// One shared document per RFQ — not personalized per vendor (§15.1 D11: no
// auto-email/response-tracking automation, the PM downloads this once and
// sends it to every invited vendor however they already do).
export function generateRfqPdf(data: RfqPdfData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFontSize(16).setFont("helvetica", "bold")
     .text("REQUEST FOR QUOTE", W / 2, 50, { align: "center" });
  doc.setFontSize(9).setFont("helvetica", "normal")
     .text(data.contractor_name, W / 2, 64, { align: "center" });

  let y = 96;
  const labelCol = 50, valCol = 200;
  const printRow = (label: string, val: string) => {
    doc.setFont("helvetica", "bold").text(label, labelCol, y);
    doc.setFont("helvetica", "normal").text(val, valCol, y);
    y += 14;
  };
  printRow("RFQ NUMBER:", data.rfq_number);
  printRow("DATE:", new Date(data.created_at).toLocaleDateString());
  printRow("DELIVERY REQUIREMENT:", data.delivery_requirement ?? "See notes / to be coordinated");

  y += 12;
  autoTable(doc, {
    startY: y,
    margin: { left: 50, right: 50 },
    head: [["Profile", "Grade", "Quantity", "Length"]],
    body: data.lines.map((l) => [
      l.profile, l.grade ?? "—", String(l.quantity), l.length != null ? String(l.length) : "—",
    ]),
    theme: "grid",
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
  });

  if (data.notes) {
    doc.addPage();
    doc.setFontSize(13).setFont("helvetica", "bold").text("Notes", 50, 50);
    doc.setFontSize(9).setFont("helvetica", "normal").text(data.notes, 50, 70, { maxWidth: W - 100 });
  }

  return doc;
}
