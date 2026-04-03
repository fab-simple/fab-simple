"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { RECEIPTS } from "@/lib/mock-data";
import { AlertTriangle } from "lucide-react";

export default function ReceivingPage() {
  const awaitingMTR = RECEIPTS.filter((r) => r.mtr_status === "Awaiting");
  return (
    <PageWrapper title="Material Receiving">
      {awaitingMTR.length > 0 && (
        <div className="alert alert-warn mb-4">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <div><strong>{awaitingMTR.length} receipt(s)</strong> awaiting MTR (Mill Test Report). Parts with heat numbers {awaitingMTR.map((r) => r.heat_number).join(", ")} are in quarantine until certs are received and on file.</div>
        </div>
      )}
      <div className="grid-4 gap-md mb-section">
        <div className="stat-card primary"><div className="stat-label">Total Receipts</div><div className="stat-value">{RECEIPTS.length}</div></div>
        <div className="stat-card green"><div className="stat-label">MTR On File</div><div className="stat-value">{RECEIPTS.filter(r => r.mtr_status === "On File").length}</div></div>
        <div className="stat-card amber"><div className="stat-label">Awaiting MTR</div><div className="stat-value">{awaitingMTR.length}</div></div>
        <div className="stat-card green"><div className="stat-label">Released</div><div className="stat-value">{RECEIPTS.filter(r => r.released).length}</div></div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Material Receipts</div></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Receipt No.</th><th>PO No.</th><th>Delivery Date</th><th>Supplier</th><th>Material</th><th>Bundle Tag</th><th>Heat No.</th><th>Qty Rec.</th><th>Qty Ord.</th><th>MTR Status</th><th>Damage</th><th>Released</th></tr>
            </thead>
            <tbody>
              {RECEIPTS.map((r) => (
                <tr key={r.id} className={r.mtr_status === "Awaiting" ? "tr-warn" : ""}>
                  <td className="td-mono">{r.receipt_number}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{r.po_number}</td>
                  <td style={{ fontSize: 12 }}>{r.delivery_date}</td>
                  <td style={{ fontSize: 12 }}>{r.supplier}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{r.material}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{r.bundle_tag}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{r.heat_number}</td>
                  <td className="td-mono">{r.qty_received}</td>
                  <td className="td-mono">{r.qty_ordered}</td>
                  <td><StatusPill status={r.mtr_status} /></td>
                  <td style={{ fontSize: 12 }}>{r.damage_notes}</td>
                  <td><span className={`pill ${r.released ? "pill-done" : "pill-danger"}`}>{r.released ? "Released" : "Quarantine"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
