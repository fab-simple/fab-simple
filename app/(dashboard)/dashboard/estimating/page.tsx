"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { Modal } from "@/components/ui/Modal";
import { ESTIMATES } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const BID_DATA = [
  { month: "Nov", won: 2, lost: 1 }, { month: "Dec", won: 1, lost: 2 },
  { month: "Jan", won: 3, lost: 1 }, { month: "Feb", won: 2, lost: 0 },
  { month: "Mar", won: 1, lost: 1 }, { month: "Apr", won: 1, lost: 0 },
];

export default function EstimatingPage() {
  const [showModal, setShowModal] = useState(false);
  const won = ESTIMATES.filter((e) => e.status === "Won").length;
  const total = ESTIMATES.length;
  const hitRate = Math.round((won / total) * 100);

  return (
    <PageWrapper title="Estimating">
      <div className="flex justify-end mb-4">
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Estimate
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card primary"><div className="stat-label">Total Bids</div><div className="stat-value">{total}</div></div>
        <div className="stat-card green"><div className="stat-label">Won</div><div className="stat-value">{won}</div><div className="stat-sub">Hit rate: {hitRate}%</div></div>
        <div className="stat-card blue"><div className="stat-label">Avg Margin</div><div className="stat-value">21%</div></div>
        <div className="stat-card amber"><div className="stat-label">Pipeline</div><div className="stat-value">{formatCurrency(ESTIMATES.reduce((s, e) => s + e.total_bid, 0))}</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="card lg:col-span-2">
          <div className="card-header"><div className="card-title">Win / Loss — Last 6 Months</div></div>
          <div className="card-body">
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={BID_DATA} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="won" name="Won" fill="var(--green)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="lost" name="Lost" fill="var(--red-bd)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Bid Calculator</div></div>
          <div className="card-body">
            <div className="fld"><label>Structural Tons</label><input type="number" placeholder="0" /></div>
            <div className="fld"><label>Labor Hours</label><input type="number" placeholder="0" /></div>
            <div className="fld"><label>Material Cost ($)</label><input type="number" placeholder="0.00" /></div>
            <div className="fld"><label>Margin %</label><input type="number" defaultValue={18} /></div>
            <div style={{ background: "var(--primary-bg)", border: "1px solid var(--primary-bd)", borderRadius: 8, padding: "12px", textAlign: "center", marginTop: 8 }}>
              <div className="stat-label">Estimated Total Bid</div>
              <div className="font-mono font-bold text-[20px]" style={{ color: "var(--primary)" }}>$0</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Estimates</div></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Est. No.</th><th>Project Name</th><th>Client</th><th>Structural Tons</th><th>Labor Hrs</th><th>Material Cost</th><th>Total Bid</th><th>Margin</th><th>Bid Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {ESTIMATES.map((e) => (
                <tr key={e.id}>
                  <td className="td-mono">{e.est_number}</td>
                  <td className="font-semibold" style={{ color: "var(--text)" }}>{e.project_name}</td>
                  <td style={{ fontSize: 12 }}>{e.client}</td>
                  <td className="td-mono">{e.structural_tons}</td>
                  <td className="td-mono">{e.labor_hours}</td>
                  <td className="td-mono">{formatCurrency(e.material_cost)}</td>
                  <td className="td-mono font-bold">{formatCurrency(e.total_bid)}</td>
                  <td className="td-mono" style={{ color: "var(--green)" }}>{e.margin_pct}%</td>
                  <td style={{ fontSize: 12 }}>{e.bid_due_date}</td>
                  <td><StatusPill status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Estimate" size="lg">
        <div className="grid grid-cols-2 gap-3">
          <div className="fld col-span-2"><label>Project Name *</label><input placeholder="e.g. Dallas Office Building" /></div>
          <div className="fld"><label>Client</label><input placeholder="Turner Construction" /></div>
          <div className="fld"><label>Project Type</label><select><option>Commercial Building</option><option>Industrial</option><option>Bridge / Infrastructure</option><option>Misc Metals Only</option></select></div>
          <div className="fld"><label>Structural Tons</label><input type="number" /></div>
          <div className="fld"><label>Misc Metal (lbs)</label><input type="number" /></div>
          <div className="fld"><label>Labor Hours</label><input type="number" /></div>
          <div className="fld"><label>Material Cost ($)</label><input type="number" /></div>
          <div className="fld"><label>Margin %</label><input type="number" defaultValue={18} /></div>
          <div className="fld"><label>Bid Due Date</label><input type="date" /></div>
          <div className="fld col-span-2"><label>Scope Notes</label><textarea rows={2} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary">Save Estimate</button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
