"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DAILY_LOGS } from "@/lib/mock-data";
import { Modal } from "@/components/ui/Modal";
import { useState } from "react";
import { Plus } from "lucide-react";

export default function DailyLogPage() {
  const [showModal, setShowModal] = useState(false);
  const totalParts = DAILY_LOGS.reduce((s, d) => s + d.parts_completed, 0);
  const budgetParts = DAILY_LOGS.reduce((s, d) => s + d.budget_parts, 0);

  return (
    <PageWrapper title="Daily Production Log">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-2 items-center">
          <span className="font-mono font-bold text-[14px]" style={{ color: "var(--text)" }}>2026-03-23</span>
          <button className="btn btn-sm">&lt; Prev</button>
          <button className="btn btn-sm">Next &gt;</button>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Log Entry</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card green"><div className="stat-label">Parts Completed</div><div className="stat-value">{totalParts}</div><div className="stat-sub">Budget: {budgetParts}</div></div>
        <div className="stat-card blue"><div className="stat-label">Stations Active</div><div className="stat-value">{DAILY_LOGS.length}</div></div>
        <div className="stat-card primary"><div className="stat-label">Total Hours</div><div className="stat-value">{DAILY_LOGS.reduce((s, d) => s + d.hours_worked, 0)}</div></div>
        <div className={`stat-card ${totalParts >= budgetParts ? "green" : "amber"}`}>
          <div className="stat-label">Vs Budget</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{totalParts >= budgetParts ? "✓" : "↓"} {Math.round((totalParts / budgetParts) * 100)}%</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Station Log — Today</div></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Station</th><th>Operators</th><th>Operation</th><th>Parts Completed</th><th>Budget</th><th>vs Budget</th><th>Hours</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {DAILY_LOGS.map((d) => {
                const vs = Math.round((d.parts_completed / d.budget_parts) * 100);
                return (
                  <tr key={d.id} className={vs < 80 ? "tr-warn" : vs > 100 ? "tr-ok" : ""}>
                    <td className="font-semibold" style={{ color: "var(--text)", fontSize: 12 }}>{d.station}</td>
                    <td style={{ fontSize: 12 }}>{d.operators}</td>
                    <td><StatusPill status={d.operation_type} /></td>
                    <td className="td-mono">{d.parts_completed}</td>
                    <td className="td-mono" style={{ color: "var(--muted)" }}>{d.budget_parts}</td>
                    <td className="td-mono" style={{ color: vs >= 100 ? "var(--green)" : vs < 80 ? "var(--red)" : "#D97706" }}>{vs}%</td>
                    <td className="td-mono">{d.hours_worked}h</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{d.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Log Daily Production Entry" size="md">
        <div className="grid grid-cols-2 gap-3">
          <div className="fld"><label>Date</label><input type="date" defaultValue="2026-03-23" /></div>
          <div className="fld"><label>Station *</label><select><option>Beam Line / CNC</option><option>Welding Station 1</option><option>Welding Station 2</option><option>Paint Booth</option><option>Touch-up / Shipping Prep</option></select></div>
          <div className="fld"><label>Operators</label><input placeholder="Names" /></div>
          <div className="fld"><label>Operation</label><select><option>Cutting</option><option>Welding</option><option>Painting</option><option>Finishing</option></select></div>
          <div className="fld"><label>Parts Completed</label><input type="number" /></div>
          <div className="fld"><label>Budget Parts</label><input type="number" /></div>
          <div className="fld"><label>Hours Worked</label><input type="number" step="0.5" /></div>
          <div className="fld col-span-2"><label>Notes</label><textarea rows={2} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary">Save Log</button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
