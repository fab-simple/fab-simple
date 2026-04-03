"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { SHIPMENTS, PARTS } from "@/lib/mock-data";
import { Modal } from "@/components/ui/Modal";
import { useState } from "react";
import { Plus, Printer } from "lucide-react";

export default function ShippingPage() {
  const [showModal, setShowModal] = useState(false);
  const [printTicket, setPrintTicket] = useState<(typeof SHIPMENTS)[0] | null>(null);

  return (
    <PageWrapper title="Shipping Tickets">
      <div className="flex justify-end mb-4">
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Create Load Ticket</button>
      </div>

      <div className="grid-4 gap-md mb-section">
        <div className="stat-card teal"><div className="stat-label">Delivered</div><div className="stat-value">{SHIPMENTS.filter(s => s.status === "Delivered").length}</div></div>
        <div className="stat-card blue"><div className="stat-label">Scheduled</div><div className="stat-value">{SHIPMENTS.filter(s => s.status === "Scheduled").length}</div></div>
        <div className="stat-card amber"><div className="stat-label">Draft</div><div className="stat-value">{SHIPMENTS.filter(s => s.status === "Draft").length}</div></div>
        <div className="stat-card primary"><div className="stat-label">Total Loads</div><div className="stat-value">{SHIPMENTS.length}</div></div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Load Tickets</div></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Load No.</th><th>Ship Date</th><th>Project</th><th>Carrier</th><th>Driver</th><th>Erection Seq.</th><th>Pieces</th><th>Weight (lbs)</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {SHIPMENTS.map((s) => (
                <tr key={s.id}>
                  <td className="td-mono">{s.load_number}</td>
                  <td style={{ fontSize: 12 }}>{s.ship_date}</td>
                  <td style={{ fontSize: 12 }}>{s.project}</td>
                  <td style={{ fontSize: 12 }}>{s.carrier}</td>
                  <td style={{ fontSize: 12 }}>{s.driver}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{s.erection_seq}</td>
                  <td className="td-mono">{s.total_pieces}</td>
                  <td className="td-mono">{s.total_weight.toLocaleString()}</td>
                  <td><StatusPill status={s.status} /></td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setPrintTicket(s)}>
                      <Printer size={12} /> Print BOL
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Ticket Modal */}
      {printTicket && (
        <Modal open={true} onClose={() => setPrintTicket(null)} title="" size="lg">
          <div
            style={{
              background: "#fff",
              border: "2px solid var(--sidebar)",
              borderRadius: 8,
              padding: 24,
              fontFamily: "var(--font-jetbrains-mono), monospace",
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="font-bold text-[18px]" style={{ color: "var(--sidebar)" }}>LOAD TICKET / BILL OF LADING</div>
                <div className="font-mono text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>Texas Steel Fab LLC · Mesquite, TX 75149</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[20px]" style={{ color: "var(--primary)" }}>{printTicket.load_number}</div>
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>{printTicket.ship_date}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                ["Project", printTicket.project],
                ["Erection Sequence", printTicket.erection_seq],
                ["Carrier", printTicket.carrier],
                ["Driver", printTicket.driver],
                ["Total Pieces", printTicket.total_pieces],
                ["Total Weight", `${printTicket.total_weight.toLocaleString()} lbs`],
              ].map(([label, value]) => (
                <div key={`${label}`} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: 12, background: "var(--bg-muted)", borderRadius: 8, fontSize: 11, color: "var(--muted)" }}>
              Parts manifest included with load. See attached packing slip for individual heat numbers and ASTM certs.
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setPrintTicket(null)}>Close</button>
            <button className="btn btn-primary" onClick={() => window.print()}><Printer size={13} /> Print</button>
          </div>
        </Modal>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Load Ticket" size="md">
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="fld"><label>Project</label><select><option>Dallas Skyline Tower</option><option>Houston Refinery</option></select></div>
          <div className="fld"><label>Ship Date</label><input type="date" /></div>
          <div className="fld"><label>Carrier</label><input placeholder="J&amp;L Trucking" /></div>
          <div className="fld"><label>Driver</label><input placeholder="Driver name" /></div>
          <div className="fld col-span-2"><label>Erection Sequence</label><input placeholder="Seq. 3 — Interior framing Level 2" /></div>
          <div className="fld"><label>Total Pieces</label><input type="number" /></div>
          <div className="fld"><label>Total Weight (lbs)</label><input type="number" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary">Create Ticket</button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
