import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ShippingTicketReportData {
  ticket_number: string;
  load_number?: string | null;
  truck_number?: string | null;
  carrier?: string | null;
  driver_name?: string | null;
  ship_date: string;
  destination?: string | null;
  total_pieces: number;
  total_weight?: number | null;
  status: string;
  project_name?: string | null;
  job_number?: string | null;
  customer_name?: string | null;
  sequence_lot?: string | null;
  items?: Array<{
    mark: string;
    description?: string | null;
    quantity: number;
    weight_lbs: number;
    sequence?: string | null;
    drawing_ref?: string | null;
  }>;
}

export function generateShippingBolPdf(data: ShippingTicketReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

  const pageWidth = doc.internal.pageSize.getWidth(); // 612
  const margin = 40;
  const contentWidth = pageWidth - margin * 2; // 532
  let y = margin;

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(margin, y, contentWidth, 54, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BILL OF LADING / SHIPPING TICKET", margin + 16, y + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`TICKET #${data.ticket_number}`, margin + contentWidth - 16, y + 24, { align: "right" });
  doc.text(`DATE: ${data.ship_date ? new Date(data.ship_date).toLocaleDateString() : new Date().toLocaleDateString()}`, margin + contentWidth - 16, y + 40, { align: "right" });

  y += 66;

  // Project & Carrier Information Grid
  doc.setLineWidth(1);
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.rect(margin, y, contentWidth, 80, "FD");

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("JOB / PROJECT INFORMATION", margin + 12, y + 16);
  doc.text("CARRIER / DISPATCH DETAILS", margin + contentWidth / 2 + 12, y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);

  // Left Col (Project)
  doc.text(`Project: ${data.project_name || "General Steel Fabrication"}`, margin + 12, y + 32);
  doc.text(`Customer/GC: ${data.customer_name || "—"}`, margin + 12, y + 46);
  doc.text(`Destination: ${data.destination || "Jobsite Drop"}`, margin + 12, y + 60);

  // Right Col (Carrier)
  doc.text(`Load #: ${data.load_number || "LOAD-01"}`, margin + contentWidth / 2 + 12, y + 32);
  doc.text(`Carrier: ${data.carrier || "Freight Dispatch"}`, margin + contentWidth / 2 + 12, y + 46);
  doc.text(`Truck/Trailer #: ${data.truck_number || "—"} | Driver: ${data.driver_name || "—"}`, margin + contentWidth / 2 + 12, y + 60);

  y += 94;

  // Items Table
  const tableHead = [["Item / Assembly Mark", "Description", "Seq / Lot", "Qty (Pcs)", "Weight (Lbs)", "Weight (Tons)"]];
  
  const tableRows = (data.items || []).map((it) => {
    const wtLbs = Number(it.weight_lbs || 0);
    const wtTons = (wtLbs / 2000).toFixed(2);
    return [
      it.mark,
      it.description || "Structural Steel Assembly",
      it.sequence || data.sequence_lot || "—",
      String(it.quantity || 1),
      wtLbs.toLocaleString(),
      `${wtTons} tons`,
    ];
  });

  if (tableRows.length === 0) {
    tableRows.push(["GENERAL STEEL LOAD", "Structural Steel Framing Package", data.sequence_lot || "—", String(data.total_pieces || 1), (data.total_weight || 0).toLocaleString(), `${((data.total_weight || 0) / 2000).toFixed(2)} tons`]);
  }

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: "bold" },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
      5: { halign: "right" },
    },
  });

  // Get position after table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 16;

  // Summary Card
  const totalWt = Number(data.total_weight || 0);
  const totalTons = (totalWt / 2000).toFixed(2);
  const totalPcs = data.total_pieces || 0;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin + contentWidth - 240, y, 240, 50, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`TOTAL PIECES: ${totalPcs}`, margin + contentWidth - 228, y + 18);
  doc.text(`TOTAL NET WEIGHT: ${totalWt.toLocaleString()} LBS`, margin + contentWidth - 228, y + 36);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`(${totalTons} TONS)`, margin + contentWidth - 30, y + 36, { align: "right" });

  y += 70;

  // Legal Sign-off Signatures
  doc.setLineWidth(0.5);
  doc.setDrawColor(148, 163, 184);

  // Shipper / Loader signature
  doc.line(margin, y + 30, margin + 220, y + 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Shipper / Loading Yard Signature & Date", margin, y + 42);

  // Driver signature
  doc.line(margin + contentWidth - 220, y + 30, margin + contentWidth, y + 30);
  doc.text("Carrier / Driver Signature & Date", margin + contentWidth - 220, y + 42);

  // Save PDF
  doc.save(`Shipping_BOL_${data.ticket_number}_${(data.project_name || "Project").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}
