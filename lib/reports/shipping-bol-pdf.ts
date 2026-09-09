import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ShippingLoad, CustomerBranding } from '../shipping-types';
import { DEMO_CUSTOMER_BRANDING } from '../shipping-demo-data';

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

export function generateShippingBolPdf(
  load: ShippingLoad | ShippingTicketReportData,
  branding: CustomerBranding = DEMO_CUSTOMER_BRANDING
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const pageWidth = doc.internal.pageSize.getWidth(); // 612
  const pageHeight = doc.internal.pageSize.getHeight(); // 792
  const margin = 36;
  const contentWidth = pageWidth - margin * 2; // 540
  let y = margin;

  // Standardize load data
  const isFullLoad = 'ticket_number' in load && 'origin_name' in load;
  
  const ticketNumber = load.ticket_number;
  const projectName = load.project_name || 'General Project';
  const jobNumber = ('job_number' in load && load.job_number) ? load.job_number : '2026-001';
  const shipDate = ('shipped_at' in load && load.shipped_at)
    ? new Date(load.shipped_at).toLocaleDateString('en-US')
    : new Date().toLocaleDateString('en-US');
  const carrierName = ('carrier_name' in load && load.carrier_name) ? load.carrier_name : (load as ShippingTicketReportData).carrier || 'Self-Transport';
  const driverName = ('driver_name' in load && load.driver_name) ? load.driver_name : (load as ShippingTicketReportData).driver_name || 'N/A';
  const truckNum = ('truck_number' in load && load.truck_number) ? load.truck_number : (load as ShippingTicketReportData).truck_number || 'N/A';
  const trailerNum = ('trailer_number' in load && load.trailer_number) ? load.trailer_number : 'N/A';
  const trailerType = ('trailer_type' in load && load.trailer_type) ? load.trailer_type : 'FLATBED';

  const originName = isFullLoad ? (load as ShippingLoad).origin_name : 'Apex Fabrication Plant';
  const originAddr = isFullLoad ? (load as ShippingLoad).origin_address : '1500 Steel Mill Rd, Taylor, TX 76574';

  const destName = isFullLoad ? (load as ShippingLoad).destination_name : (load as ShippingTicketReportData).destination || 'Jobsite';
  const destAddr = isFullLoad ? ((load as ShippingLoad).destination_address || 'Jobsite Yard') : 'Jobsite Drop';
  const destContact = isFullLoad ? ((load as ShippingLoad).destination_contact || 'Site Super') : 'Field Superintendent';
  const destPhone = isFullLoad ? ((load as ShippingLoad).destination_phone || '') : '';

  const bolNotes = isFullLoad ? (load as ShippingLoad).bol_notes : '';

  // Calculate items and weights
  let itemsRows: string[][] = [];
  let additionalRows: string[][] = [];
  let totalPcs = 0;
  let totalWtLbs = 0;

  if (isFullLoad) {
    const fullLoad = load as ShippingLoad;
    itemsRows = (fullLoad.items || []).map((it) => {
      totalPcs += it.qty_on_load;
      totalWtLbs += Number(it.total_weight_lbs);
      return [
        it.mark,
        String(it.qty_on_load),
        it.main_material,
        it.length_ft_in,
        it.sequence || '—',
        it.finish || 'PRIMER',
        it.drawing_no || '—',
        Number(it.unit_weight_lbs).toLocaleString(),
        Number(it.total_weight_lbs).toLocaleString(),
      ];
    });

    additionalRows = (fullLoad.additional_items || []).map((ai) => {
      const wt = Number(ai.weight_lbs || 0);
      totalWtLbs += wt;
      return [
        ai.category,
        ai.description,
        `${ai.qty} ${ai.unit}`,
        wt > 0 ? `${wt.toLocaleString()} lbs` : '—',
        ai.notes || '—',
      ];
    });
  } else {
    const legacy = load as ShippingTicketReportData;
    itemsRows = (legacy.items || []).map((it) => {
      totalPcs += it.quantity;
      totalWtLbs += it.weight_lbs;
      return [
        it.mark,
        String(it.quantity),
        it.description || 'Steel Assembly',
        '—',
        it.sequence || '—',
        'PRIMER',
        it.drawing_ref || '—',
        (it.weight_lbs / Math.max(1, it.quantity)).toFixed(0),
        it.weight_lbs.toLocaleString(),
      ];
    });
  }

  const netWt = isFullLoad && (load as ShippingLoad).net_weight_lbs ? (load as ShippingLoad).net_weight_lbs! : totalWtLbs;
  const grossWt = isFullLoad && (load as ShippingLoad).gross_weight_lbs ? (load as ShippingLoad).gross_weight_lbs! : 0;
  const tareWt = isFullLoad && (load as ShippingLoad).tare_weight_lbs ? (load as ShippingLoad).tare_weight_lbs! : 0;
  const maxWt = isFullLoad ? (load as ShippingLoad).max_weight_lbs : 48000;

  // 1. Header Top Bar (Brand Header)
  doc.setFillColor(15, 23, 42); // Primary Dark Navy (#0f172a)
  doc.rect(margin, y, contentWidth, 52, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(branding.company_name.toUpperCase(), margin + 14, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${branding.address} | Tel: ${branding.phone}`, margin + 14, y + 38);

  // Ticket Box Top Right
  doc.setFillColor(30, 41, 59);
  doc.rect(margin + contentWidth - 160, y, 160, 52, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('BILL OF LADING', margin + contentWidth - 80, y + 20, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(59, 130, 246); // Accent Blue
  doc.text(`# ${ticketNumber}`, margin + contentWidth - 80, y + 36, { align: 'center' });

  y += 60;

  // 2. Info Cards Grid (Job / Shipping / Carrier Details)
  doc.setLineWidth(0.75);
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);

  const colWidth = (contentWidth - 12) / 3;

  // Box 1: Job & Customer Info
  doc.rect(margin, y, colWidth, 90, 'FD');
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, colWidth, 18, 'F');
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PROJECT / JOB DETAILS', margin + 8, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Job No: ${jobNumber}`, margin + 8, y + 32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Project: ${projectName.substring(0, 26)}`, margin + 8, y + 45);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Ship Date: ${shipDate}`, margin + 8, y + 58);
  doc.text(`Status: ${load.status.replace(/_/g, ' ')}`, margin + 8, y + 71);

  // Box 2: Origin & Destination
  const box2X = margin + colWidth + 6;
  doc.rect(box2X, y, colWidth, 90, 'FD');
  doc.setFillColor(241, 245, 249);
  doc.rect(box2X, y, colWidth, 18, 'F');
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('SHIP FROM / TO', box2X + 8, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`FROM: ${originName.substring(0, 24)}`, box2X + 8, y + 30);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`TO: ${destName.substring(0, 24)}`, box2X + 8, y + 45);
  if (destAddr) doc.text(`Addr: ${destAddr.substring(0, 26)}`, box2X + 8, y + 58);
  if (destContact) doc.text(`Attn: ${destContact} ${destPhone}`, box2X + 8, y + 71);

  // Box 3: Carrier & Equipment
  const box3X = box2X + colWidth + 6;
  doc.rect(box3X, y, colWidth, 90, 'FD');
  doc.setFillColor(241, 245, 249);
  doc.rect(box3X, y, colWidth, 18, 'F');
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CARRIER / EQUIPMENT', box3X + 8, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Carrier: ${carrierName.substring(0, 24)}`, box3X + 8, y + 30);
  doc.text(`Driver: ${driverName}`, box3X + 8, y + 43);
  doc.text(`Truck #: ${truckNum}`, box3X + 8, y + 56);
  doc.text(`Trailer #: ${trailerNum} (${trailerType})`, box3X + 8, y + 69);
  if (maxWt) doc.text(`Max Legal Cap: ${maxWt.toLocaleString()} lbs`, box3X + 8, y + 82);

  y += 98;

  // 3. Steel Assemblies Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('FABRICATED STEEL ASSEMBLIES ON LOAD', margin, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Mark', 'Qty', 'Main Section', 'Length', 'Seq', 'Finish', 'Drawing', 'Unit Wt', 'Total Wt (Lbs)']],
    body: itemsRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 4, halign: 'left' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', halign: 'left' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold', width: 55 },
      1: { halign: 'center', width: 35 },
      2: { fontStyle: 'bold' },
      4: { halign: 'center' },
      7: { halign: 'right' },
      8: { halign: 'right', fontStyle: 'bold' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // 4. Additional Loose Items Table (if any)
  if (additionalRows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('LOOSE ACCESSORIES, HARDWARE & DUNNAGE', margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Category', 'Description', 'Quantity / Unit', 'Weight', 'Notes']],
      body: additionalRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7.5, cellPadding: 3.5 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        3: { halign: 'right' },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Check if signature section will overflow page, if so add page
  if (y + 120 > pageHeight - margin) {
    doc.addPage();
    y = margin + 20;
  }

  // 5. Weight Summary Box & Special Instructions
  doc.setLineWidth(0.75);
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(241, 245, 249);
  
  const summaryBoxWidth = 220;
  const notesBoxWidth = contentWidth - summaryBoxWidth - 12;

  // Notes Box Left
  doc.rect(margin, y, notesBoxWidth, 54, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('SPECIAL DELIVERY INSTRUCTIONS & REMARKS:', margin + 8, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const splitNotes = doc.splitTextToSize(bolNotes || 'Verify piece counts upon arrival. Material must be stored off ground on suitable timber dunnage.', notesBoxWidth - 16);
  doc.text(splitNotes, margin + 8, y + 26);

  // Weight Summary Box Right
  const weightBoxX = margin + notesBoxWidth + 12;
  doc.setFillColor(15, 23, 42);
  doc.rect(weightBoxX, y, summaryBoxWidth, 54, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL PIECE COUNT: ${totalPcs} PCS`, weightBoxX + 10, y + 16);
  
  doc.setFontSize(10);
  doc.setTextColor(59, 130, 246);
  doc.text(`TOTAL NET WEIGHT: ${netWt.toLocaleString()} LBS`, weightBoxX + 10, y + 33);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`(${ (netWt / 2000).toFixed(2) } TONS)`, weightBoxX + summaryBoxWidth - 10, y + 33, { align: 'right' });

  if (grossWt > 0 && tareWt > 0) {
    doc.setFontSize(7);
    doc.text(`Scale Gross: ${grossWt.toLocaleString()} lbs | Tare: ${tareWt.toLocaleString()} lbs`, weightBoxX + 10, y + 46);
  }

  y += 66;

  // 6. Certification & Signatures Section
  doc.setLineWidth(0.5);
  doc.setDrawColor(148, 163, 184);

  const sigWidth = (contentWidth - 24) / 3;

  // Shipper Sign
  doc.rect(margin, y, sigWidth, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('1. FABRICATOR / SHIPPER SIGN-OFF', margin + 6, y + 12);
  doc.line(margin + 6, y + 42, margin + sigWidth - 6, y + 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Loaded & Inspected By / Date', margin + 6, y + 52);

  // Driver Sign
  const sig2X = margin + sigWidth + 12;
  doc.rect(sig2X, y, sigWidth, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('2. CARRIER / DRIVER SIGN-OFF', sig2X + 6, y + 12);
  doc.line(sig2X + 6, y + 42, sig2X + sigWidth - 6, y + 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Driver Signature & Pickup Date', sig2X + 6, y + 52);

  // Receiver Sign
  const sig3X = sig2X + sigWidth + 12;
  doc.rect(sig3X, y, sigWidth, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('3. JOBSITE RECEIVER SIGN-OFF', sig3X + 6, y + 12);
  if ('signed_by' in load && load.signed_by) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`Received by: ${load.signed_by}`, sig3X + 6, y + 30);
  }
  doc.line(sig3X + 6, y + 42, sig3X + sigWidth - 6, y + 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Receiver Signature & Delivery Date', sig3X + 6, y + 52);

  // Add Page Numbers footer to all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`FabSimple Shipping System • BOL Ticket ${ticketNumber}`, margin, pageHeight - 20);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
  }

  // Save File
  const sanitizeName = (projectName || 'Project').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Shipping_BOL_${ticketNumber}_${sanitizeName}.pdf`);
}
