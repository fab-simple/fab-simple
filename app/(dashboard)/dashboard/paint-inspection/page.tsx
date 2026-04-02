"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { PAINT_INSPECTIONS } from "@/lib/mock-data";

export default function PaintInspectionPage() {
  const passing = PAINT_INSPECTIONS.filter((p) => p.result === "Pass").length;
  const failing = PAINT_INSPECTIONS.filter((p) => p.result !== "Pass" && p.result !== "Pending").length;

  return (
    <PageWrapper title="Paint & Coating Inspection">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card primary"><div className="stat-label">Total Inspections</div><div className="stat-value">{PAINT_INSPECTIONS.length}</div></div>
        <div className="stat-card green"><div className="stat-label">Pass</div><div className="stat-value">{passing}</div></div>
        <div className="stat-card red"><div className="stat-label">Fail / Rework</div><div className="stat-value">{failing}</div></div>
        <div className="stat-card amber"><div className="stat-label">Pass Rate</div><div className="stat-value">{Math.round((passing / PAINT_INSPECTIONS.length) * 100)}%</div></div>
      </div>

      <div className="alert alert-info mb-4" style={{ background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-2)" }}>
        <strong>Project Paint Spec — Dallas Skyline Tower:</strong> Primer: Sherwin-Williams Zinc Clad 4 — 3.0 mil DFT min · Topcoat: SW Macropoxy 646 — 2.5 mil DFT min · <strong>Total: 5.5 mil min</strong> · Surface Prep: SSPC SP-6 Commercial Blast.
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Inspection Records</div></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Insp. No.</th><th>Part ID</th><th>Assembly</th><th>Date</th><th>Inspector</th><th>Surface Prep</th><th>Primer DFT</th><th>Topcoat DFT</th><th>Total DFT</th><th>Required</th><th>Result</th></tr>
            </thead>
            <tbody>
              {PAINT_INSPECTIONS.map((p) => (
                <tr key={p.id} className={p.result.includes("Fail") ? "tr-danger" : p.result === "Pass" ? "tr-ok" : ""}>
                  <td className="td-mono">{p.insp_number}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{p.part_id_text}</td>
                  <td className="font-mono text-[11px]" style={{ color: "var(--primary)" }}>{p.assembly_id}</td>
                  <td style={{ fontSize: 12 }}>{p.insp_date}</td>
                  <td style={{ fontSize: 12 }}>{p.inspector}</td>
                  <td style={{ fontSize: 12 }}>{p.surface_prep}</td>
                  <td className="td-mono">{p.primer_dft}</td>
                  <td className="td-mono">{p.topcoat_dft}</td>
                  <td className="td-mono font-bold" style={{ color: p.total_dft >= p.total_req ? "var(--green)" : "var(--red)" }}>{p.total_dft}</td>
                  <td className="td-mono" style={{ color: "var(--muted)" }}>{p.total_req}</td>
                  <td><StatusPill status={p.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
