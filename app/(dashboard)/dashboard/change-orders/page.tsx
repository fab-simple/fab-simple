"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { Modal } from "@/components/ui/Modal";
import { CHANGE_ORDERS, RFIS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";

export default function ChangeOrdersPage() {
  const [tab, setTab] = useState<"co" | "rfi">("co");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"co" | "rfi">("co");

  const pendingValue = CHANGE_ORDERS.filter((c) => c.status === "Pending Approval").reduce((s, c) => s + c.total_value, 0);

  return (
    <PageWrapper title="Change Orders & RFI">
      <div className="grid-4 gap-md mb-section">
        <div className="stat-card amber"><div className="stat-label">Pending CO Value</div><div className="stat-value" style={{ fontSize: 18 }}>{formatCurrency(pendingValue)}</div><div className="stat-sub">awaiting approval</div></div>
        <div className="stat-card blue"><div className="stat-label">Total COs</div><div className="stat-value">{CHANGE_ORDERS.length}</div></div>
        <div className="stat-card red"><div className="stat-label">Open RFIs</div><div className="stat-value">{RFIS.filter((r) => r.status === "Open").length}</div></div>
        <div className="stat-card green"><div className="stat-label">Answered RFIs</div><div className="stat-value">{RFIS.filter((r) => r.status === "Answered").length}</div></div>
      </div>

      {CHANGE_ORDERS.some((c) => c.status === "Pending Approval") && (
        <div className="alert alert-warn mb-4">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <div><strong>{CHANGE_ORDERS.filter((c) => c.status === "Pending Approval").length} Change Orders</strong> pending approval — {formatCurrency(pendingValue)} total value awaiting GC sign-off. Fabrication on affected parts may be impacted.</div>
        </div>
      )}

      <div className="tab-row">
        <button className={`tab-btn ${tab === "co" ? "active" : ""}`} onClick={() => setTab("co")}>Change Orders ({CHANGE_ORDERS.length})</button>
        <button className={`tab-btn ${tab === "rfi" ? "active" : ""}`} onClick={() => setTab("rfi")}>RFI Log ({RFIS.length})</button>
      </div>

      <div className="flex justify-end mb-3">
        <button className="btn btn-primary" onClick={() => { setModalType(tab); setShowModal(true); }}>
          <Plus size={14} /> New {tab === "co" ? "Change Order" : "RFI"}
        </button>
      </div>

      {tab === "co" && (
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>CO No.</th><th>Project</th><th>Description</th><th>Dwg Rev</th><th>Requested By</th><th>Date</th><th>Total Value</th><th>Status</th></tr>
              </thead>
              <tbody>
                {CHANGE_ORDERS.map((c) => (
                  <tr key={c.id} className={c.status === "Pending Approval" ? "tr-warn" : ""}>
                    <td className="td-mono">{c.co_number}</td>
                    <td style={{ fontSize: 12 }}>{c.project}</td>
                    <td style={{ fontSize: 12, maxWidth: 200 }}>{c.description}</td>
                    <td><span className="pill pill-info">{c.drawing_rev}</span></td>
                    <td style={{ fontSize: 12 }}>{c.requested_by}</td>
                    <td style={{ fontSize: 12 }}>{c.date_submitted}</td>
                    <td className="td-mono font-bold">{formatCurrency(c.total_value)}</td>
                    <td><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "rfi" && (
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>RFI No.</th><th>Project</th><th>Question</th><th>Submitted To</th><th>Date Submitted</th><th>Date Answered</th><th>Status</th></tr>
              </thead>
              <tbody>
                {RFIS.map((r) => (
                  <tr key={r.id} className={r.status === "Open" ? "tr-warn" : ""}>
                    <td className="td-mono">{r.rfi_number}</td>
                    <td style={{ fontSize: 12 }}>{r.project}</td>
                    <td style={{ fontSize: 12, maxWidth: 240 }}>{r.question}</td>
                    <td style={{ fontSize: 12 }}>{r.submitted_to}</td>
                    <td style={{ fontSize: 12 }}>{r.date_submitted}</td>
                    <td style={{ fontSize: 12 }}>{r.date_answered || "—"}</td>
                    <td><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={modalType === "co" ? "New Change Order" : "New RFI"} size="md">
        {modalType === "co" ? (
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="fld"><label>Project</label><select><option>Dallas Skyline Tower</option><option>Houston Refinery</option></select></div>
            <div className="fld"><label>Drawing Rev</label><input placeholder="Rev D" /></div>
            <div className="fld col-span-2"><label>Description *</label><input placeholder="Describe the scope change" /></div>
            <div className="fld col-span-2"><label>Requested By</label><input placeholder="GC / EOR contact" /></div>
            <div className="fld"><label>Est. Labor Hours</label><input type="number" /></div>
            <div className="fld"><label>Est. Material ($)</label><input type="number" /></div>
            <div className="fld"><label>Markup %</label><input type="number" defaultValue={18} /></div>
            <div className="fld"><label>Total Value ($)</label><input type="number" readOnly placeholder="Auto-calculated" /></div>
          </div>
        ) : (
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="fld"><label>Project</label><select><option>Dallas Skyline Tower</option><option>Houston Refinery</option></select></div>
            <div className="fld"><label>Drawing Reference</label><input placeholder="DS-104" /></div>
            <div className="fld col-span-2"><label>Question *</label><textarea rows={3} placeholder="Describe the RFI question clearly" /></div>
            <div className="fld"><label>Submitted To</label><input placeholder="EOR / GC contact" /></div>
            <div className="fld"><label>Date Needed</label><input type="date" /></div>
          </div>
        )}
        <div className="modal-footer">
          <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary">Submit</button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
