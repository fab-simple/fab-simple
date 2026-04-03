"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DRAWINGS } from "@/lib/mock-data";
import { AlertTriangle } from "lucide-react";

export default function DrawingsPage() {
  const superseded = DRAWINGS.filter((d) => d.status === "Superseded");

  return (
    <PageWrapper title="Shop Drawing Log">
      {superseded.length > 0 && (
        <div className="alert alert-danger mb-4">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <div><strong>{superseded.length} SUPERSEDED DRAWING{superseded.length > 1 ? "S" : ""}</strong> — Verify no parts are being fabricated from obsolete revisions. Check: {superseded.map((d) => `${d.drawing_no} ${d.revision}`).join(", ")}.</div>
        </div>
      )}

      <div className="grid-4 gap-md mb-section">
        <div className="stat-card green"><div className="stat-label">Current</div><div className="stat-value">{DRAWINGS.filter((d) => d.status === "Current").length}</div></div>
        <div className="stat-card red"><div className="stat-label">Superseded</div><div className="stat-value">{superseded.length}</div></div>
        <div className="stat-card amber"><div className="stat-label">Draft</div><div className="stat-value">0</div></div>
        <div className="stat-card primary"><div className="stat-label">Total Parts Linked</div><div className="stat-value">{DRAWINGS.reduce((s, d) => s + d.parts_linked, 0)}</div></div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Drawing Log</div></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Drawing No.</th><th>Revision</th><th>Project</th><th>Description</th><th>Date Issued</th><th>Approved By</th><th>Parts Linked</th><th>Status</th></tr>
            </thead>
            <tbody>
              {DRAWINGS.map((d) => (
                <tr key={d.id} className={d.status === "Superseded" ? "tr-danger" : ""}>
                  <td className="td-mono">{d.drawing_no}</td>
                  <td><span className="pill pill-info">{d.revision}</span></td>
                  <td style={{ fontSize: 12 }}>{d.project}</td>
                  <td style={{ fontSize: 12, maxWidth: 200 }}>{d.description}</td>
                  <td style={{ fontSize: 12 }}>{d.date_issued}</td>
                  <td style={{ fontSize: 12 }}>{d.approved_by}</td>
                  <td className="td-mono">{d.parts_linked}</td>
                  <td><StatusPill status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
