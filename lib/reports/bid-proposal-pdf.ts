// =============================================================================
// General Contractor Bid Proposal PDF Generator
//
// Generates a formal, professional Steel Fabrication & Erection Bid Proposal
// PDF report ready to submit directly to General Contractors and Owners.
//
// Includes:
//   - Header & Project Specs (GC, Architect/EOR, Drawing Set, Location)
//   - Total Lump Sum Bid Price & Total Structural Tonnage
//   - Material Scope Breakdown (Wide Flange, HSS, Angles, Channels, Plates)
//   - Additional Costs & Subcontracts (Bolts, Erection, Detailing, Crane, Tax)
//   - Bid Alternates (Add / Deduct)
//   - AISC Standard Exclusions & Qualifications
//   - Formal Signature & Acceptance Block
// =============================================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AdditionalCost } from "@/lib/parsers/types";

export interface BidProposalData {
  estimate_number: string;
  project_name: string;
  gc_name?: string | null;
  architect_eor?: string | null;
  project_location?: string | null;
  bid_due_date?: string | null;
  bid_type?: string | null;
  drawing_set_ref?: string | null;
  total_amount: number;
  building_sqft?: number | null;
  connection_complexity?: string | null;
  materials_breakdown?: Array<{ shape: string; tons: number; price_per_ton: number }>;
  additional_costs?: AdditionalCost[] | null;
  alternates?: Array<{ description: string; type: "add" | "deduct"; amount: number }>;
  exclusions_qualifications?: string | null;
  company_name?: string;
}

export function generateBidProposalPdf(data: BidProposalData): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 612 pt
  const margin = 40;
  let y = 40;

  const companyName = data.company_name || "FABRICATION & STEEL ERECTION CORP.";

  // -------------------------------------------------------------------------
  // 1. Header Banner
  // -------------------------------------------------------------------------
  doc.setFillColor(30, 41, 59); // dark slate #1E293B
  doc.rect(margin, y, pageWidth - margin * 2, 60, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("STEEL FABRICATION & ERECTION BID PROPOSAL", margin + 16, y + 26);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`BID PROPOSAL #${data.estimate_number}`, margin + 16, y + 44);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`DATE: ${data.bid_due_date ? new Date(data.bid_due_date).toLocaleDateString() : new Date().toLocaleDateString()}`, pageWidth - margin - 16, y + 26, { align: "right" });

  y += 75;

  // -------------------------------------------------------------------------
  // 2. Project & GC Metadata Grid
  // -------------------------------------------------------------------------
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, y, pageWidth - margin * 2, 70, 4, 4, "FD");

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const leftX = margin + 16;
  const rightX = margin + 280;

  doc.setFont("helvetica", "bold");
  doc.text("PROJECT NAME:", leftX, y + 20);
  doc.setFont("helvetica", "normal");
  doc.text(data.project_name || "—", leftX + 90, y + 20);

  doc.setFont("helvetica", "bold");
  doc.text("GENERAL CONTRACTOR:", leftX, y + 36);
  doc.setFont("helvetica", "normal");
  doc.text(data.gc_name || "—", leftX + 120, y + 36);

  doc.setFont("helvetica", "bold");
  doc.text("PROJECT LOCATION:", leftX, y + 52);
  doc.setFont("helvetica", "normal");
  doc.text(data.project_location || "—", leftX + 110, y + 52);

  doc.setFont("helvetica", "bold");
  doc.text("ARCHITECT / EOR:", rightX, y + 20);
  doc.setFont("helvetica", "normal");
  doc.text(data.architect_eor || "—", rightX + 95, y + 20);

  doc.setFont("helvetica", "bold");
  doc.text("DRAWING SET REF:", rightX, y + 36);
  doc.setFont("helvetica", "normal");
  doc.text(data.drawing_set_ref || "IFC Drawing Set", rightX + 105, y + 36);

  doc.setFont("helvetica", "bold");
  doc.text("BID TYPE:", rightX, y + 52);
  doc.setFont("helvetica", "normal");
  doc.text(data.bid_type || "Lump Sum", rightX + 60, y + 52);

  y += 85;

  // -------------------------------------------------------------------------
  // 3. Executive Lump Sum Price & Tonnage Box
  // -------------------------------------------------------------------------
  const totalTons = data.materials_breakdown?.reduce((s, m) => s + Number(m.tons || 0), 0) || 0;
  const bidPerTon = totalTons > 0 ? data.total_amount / totalTons : 0;
  const sqft = Number(data.building_sqft || 0);
  const bidPerSF = sqft > 0 ? data.total_amount / sqft : 0;

  doc.setFillColor(37, 99, 235); // primary blue #2563EB
  doc.roundedRect(margin, y, pageWidth - margin * 2, 55, 4, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL LUMP SUM PROPOSAL PRICE", margin + 16, y + 22);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`$${Number(data.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 16, y + 44);

  // Metrics right-aligned
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Structural Weight: ${totalTons.toFixed(2)} Tons (${Math.round(totalTons * 2000).toLocaleString()} Lbs)`, pageWidth - margin - 16, y + 20, { align: "right" });
  doc.text(`Blended $/Ton: $${Math.round(bidPerTon).toLocaleString()} / Ton${sqft > 0 ? `  ·  $/SF: $${bidPerSF.toFixed(2)} / SF` : ""}`, pageWidth - margin - 16, y + 38, { align: "right" });

  y += 70;

  // -------------------------------------------------------------------------
  // 4. Material Takeoff Scope Table
  // -------------------------------------------------------------------------
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("1. STRUCTURAL STEEL MATERIAL SCOPE", margin, y);
  y += 10;

  const matRows = (data.materials_breakdown || []).map((m) => [
    m.shape,
    `${Number(m.tons || 0).toFixed(2)} Tons`,
    `$${Number(m.price_per_ton || 0).toLocaleString()}`,
    `$${(Number(m.tons || 0) * Number(m.price_per_ton || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Shape Category", "Tonnage", "Base $/Ton", "Extended Material Value"]],
    body: matRows,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [51, 65, 85] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold" },
    },
  });

  // @ts-expect-error autoTable adds lastAutoTable property to doc
  y = doc.lastAutoTable.finalY + 20;

  // -------------------------------------------------------------------------
  // 5. Additional Costs & Subcontracts Schedule
  // -------------------------------------------------------------------------
  if (data.additional_costs && data.additional_costs.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("2. ADDITIONAL SERVICES & SUBCONTRACT SCHEDULE", margin, y);
    y += 10;

    const addlRows = data.additional_costs.map((c) => [
      c.label,
      c.category.toUpperCase(),
      c.is_percentage ? `${c.amount}% of ${c.percentage_basis}` : "Lump Sum",
      `$${Number(c.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Cost Line Item", "Category", "Pricing Basis", "Amount"]],
      body: addlRows,
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [51, 65, 85] },
      columnStyles: {
        3: { halign: "right", fontStyle: "bold" },
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable property to doc
    y = doc.lastAutoTable.finalY + 20;
  }

  // Check space for exclusions / signatures, add page if needed
  if (y > 620) {
    doc.addPage();
    y = 40;
  }

  // -------------------------------------------------------------------------
  // 6. Bid Alternates (if any)
  // -------------------------------------------------------------------------
  if (data.alternates && data.alternates.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("3. BID ALTERNATES", margin, y);
    y += 10;

    const altRows = data.alternates.map((a) => [
      a.description,
      a.type === "add" ? "ADDITION (+)" : "DEDUCTION (-)",
      `$${Number(a.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Alternate Description", "Type", "Amount"]],
      body: altRows,
      theme: "striped",
      headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [51, 65, 85] },
      columnStyles: {
        2: { halign: "right", fontStyle: "bold" },
      },
    });

    // @ts-expect-error autoTable adds lastAutoTable property to doc
    y = doc.lastAutoTable.finalY + 20;
  }

  // -------------------------------------------------------------------------
  // 7. Exclusions & Standard AISC Qualifications
  // -------------------------------------------------------------------------
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("EXCLUSIONS & QUALIFICATIONS", margin, y);
  y += 14;

  const defaultExclusions =
    "1. Unless noted, proposal is based on AISC Code of Standard Practice.\n" +
    "2. Excludes: Field welding inspection, NDT, concrete anchor bolt placement by GC, soil testing.\n" +
    "3. Excludes: Special inspections, touch-up painting of field welds by others.\n" +
    "4. Price valid for 30 days from proposal date. Material price escalation subject to mill adjustment.";

  const exclusionText = data.exclusions_qualifications || defaultExclusions;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  const splitLines = doc.splitTextToSize(exclusionText, pageWidth - margin * 2);
  doc.text(splitLines, margin, y);
  y += splitLines.length * 11 + 25;

  if (y > 680) {
    doc.addPage();
    y = 40;
  }

  // -------------------------------------------------------------------------
  // 8. Sign-off & Acceptance Block
  // -------------------------------------------------------------------------
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("SUBMITTED BY:", margin, y);
  doc.text("ACCEPTED BY (GENERAL CONTRACTOR):", margin + 280, y);

  y += 35;
  doc.setFont("helvetica", "normal");
  doc.text("__________________________________________", margin, y);
  doc.text("__________________________________________", margin + 280, y);

  y += 14;
  doc.text(`Authorized Representative (${companyName})`, margin, y);
  doc.text("Authorized Signature & Title", margin + 280, y);

  y += 16;
  doc.text("Date: ________________________", margin, y);
  doc.text("Date: ________________________", margin + 280, y);

  // Save / trigger browser download
  doc.save(`Bid_Proposal_${data.estimate_number}_${(data.project_name || "Project").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}
