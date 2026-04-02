"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { WELD_INSPECTIONS } from "@/lib/mock-data";
import { Modal } from "@/components/ui/Modal";
import { useState } from "react";
import { Plus } from "lucide-react";

export default function WeldLogPage() {
  const [showModal, setShowModal] = useState(false);
  const passing = WELD_INSPECTIONS.filter((w) => w.result === "Pass").length;
  const failing = WELD_INSPECTIONS.filter((w) => w.result.includes("Fail")).length;

  return (
    <PageWrapper title="AWS D1.1 Weld Log">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card primary"><div className="stat-label">Total Welds</div><div className="stat-value">{WELD_INSPECTIONS.length}</div></div>
        <div className="stat-card green"><div className="stat-label">Pass</div><div className="stat-value">{passing}</div></div>
        <div className="stat-card red"><div className="stat-label">Fail / Repair</div><div className="stat-value">{failing}</div></div>
        <div className="stat-card amber"><div className="stat-label">Pending</div><div className="stat-value">{WELD_INSPECTIONS.filter((w) => w.result === "Pending").length}</div></div>
      </div>

      <div className="flex justify-end mb-3">
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Log Weld</button>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">AWS D1.1 Inspection Records</div></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Weld ID</th><th>Part ID</th><th>Date</th><th>Joint Type</th><th>Process</th><th>Filler Metal</th><th>Method</th><th>Inspector</th><th>Result</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {WELD_INSPECTIONS.map((w) => (
                <tr key={w.id} className={w.result.includes("Fail") ? "tr-danger" : w.result === "Pass" ? "tr-ok" : ""}>
                  <td className="td-mono">{w.weld_id}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{w.part_id_text}</td>
                  <td style={{ fontSize: 12 }}>{w.insp_date}</td>
                  <td style={{ fontSize: 12 }}>{w.joint_type}</td>
                  <td className="font-mono text-[11px]">{w.weld_process}</td>
                  <td className="font-mono text-[11px]">{w.filler_metal}</td>
                  <td><span className="pill pill-info">{w.insp_method}</span></td>
                  <td style={{ fontSize: 12 }}>{w.inspector}</td>
                  <td><StatusPill status={w.result} /></td>
                  <td style={{ fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)" }}>{w.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Log Weld Inspection" size="md">
        <div className="grid grid-cols-2 gap-3">
          <div className="fld"><label>Part ID</label><input placeholder="W14×82-1044" /></div>
          <div className="fld"><label>Joint Type</label><select><option>CJP Groove</option><option>PJP Groove</option><option>Fillet</option><option>Plug / Slot</option></select></div>
          <div className="fld"><label>Weld Process</label><input placeholder="FCAW" /></div>
          <div className="fld"><label>Filler Metal</label><input placeholder="E71T-1" /></div>
          <div className="fld"><label>Insp. Method</label><select><option>VT</option><option>UT</option><option>MT</option><option>PT</option><option>RT</option></select></div>
          <div className="fld"><label>CWI Inspector</label><input placeholder="D. Nguyen / CWI-2841" /></div>
          <div className="fld col-span-2"><label>Result</label><select><option>Pass</option><option>Fail — Repair Required</option><option>Pending</option></select></div>
          <div className="fld col-span-2"><label>Notes</label><textarea rows={2} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary">Save</button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
