"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { PARTS, WELD_INSPECTIONS, PAINT_INSPECTIONS } from "@/lib/mock-data";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

const STATUS_HISTORY = [
  { status: "Not Started", by: "System", time: "2026-03-10 08:00", station: "—" },
  { status: "Cutting", by: "R. Torres", time: "2026-03-15 07:42", station: "Beam Line / CNC" },
  { status: "Welding", by: "D. Nguyen", time: "2026-03-20 09:14", station: "Welding Station 1" },
];

const DOT_COLORS: Record<string, string> = {
  "Not Started": "#94A3B8",
  Cutting: "#C2410C",
  Welding: "#2563EB",
  Painting: "#7C3AED",
  Completed: "#16A34A",
  Shipped: "#0D9488",
};

export default function PartDetailPage() {
  const params = useParams();
  const part = PARTS.find((p) => p.id === params.id) || PARTS[0];
  const welds = WELD_INSPECTIONS.filter((w) => w.part_id_text === part.part_id);
  const paint = PAINT_INSPECTIONS.find((p) => p.part_id_text === part.part_id);

  return (
    <PageWrapper title={`Part Detail — ${part.part_id}`}>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/dashboard/parts" className="btn btn-sm btn-ghost">
          <ArrowLeft size={13} /> Back
        </Link>
        <span className="font-mono font-bold text-[15px]" style={{ color: "var(--primary)" }}>
          {part.part_id}
        </span>
        <StatusPill status={part.status} />
        <div className="ml-auto no-print">
          <button className="btn btn-sm" onClick={() => window.print()}>
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Part Info */}
        <div className="flex flex-col gap-5">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Part Information</div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Part ID", value: part.part_id, mono: true },
                  { label: "Assembly ID", value: part.assembly_id, mono: true },
                  { label: "Drawing No.", value: part.drawing_no },
                  { label: "Phase", value: part.phase },
                  { label: "Profile", value: part.profile, mono: true },
                  { label: "Material", value: part.material },
                  { label: "Length", value: part.length, mono: true },
                  { label: "Weight", value: `${part.weight.toLocaleString()} lbs`, mono: true },
                  { label: "Heat Number", value: part.heat_number, mono: true },
                  { label: "Project", value: part.project },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="info-cell">
                    <div className="info-cell-label">{label}</div>
                    <div className={`info-cell-value ${mono ? "font-mono text-[12px]" : ""}`}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Paint Record */}
          {paint && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Paint Inspection Record</div>
                <StatusPill status={paint.result} />
              </div>
              <div className="card-body">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="info-cell text-center">
                    <div className="info-cell-label">Primer DFT</div>
                    <div className="info-cell-value font-mono">{paint.primer_dft} mil</div>
                  </div>
                  <div className="info-cell text-center">
                    <div className="info-cell-label">Topcoat DFT</div>
                    <div className="info-cell-value font-mono">{paint.topcoat_dft} mil</div>
                  </div>
                  <div className="info-cell text-center">
                    <div className="info-cell-label">Total DFT</div>
                    <div className="info-cell-value font-mono" style={{ color: paint.total_dft >= paint.total_req ? "var(--green)" : "var(--red)" }}>
                      {paint.total_dft} mil
                    </div>
                  </div>
                </div>
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Surface Prep: {paint.surface_prep} · Inspector: {paint.inspector} · {paint.insp_date}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Status History + Welds */}
        <div className="flex flex-col gap-5">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Status History</div>
            </div>
            <div className="card-body">
              <div className="timeline">
                {STATUS_HISTORY.map((h, i) => (
                  <div key={i} className="timeline-item">
                    <div className="timeline-dot" style={{ background: DOT_COLORS[h.status] || "var(--border-2)", borderColor: DOT_COLORS[h.status] || "var(--border-2)" }} />
                    <div className="flex items-start justify-between">
                      <div>
                        <StatusPill status={h.status} size="sm" />
                        <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                          {h.by} · {h.station}
                        </div>
                      </div>
                      <span className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>{h.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status update buttons */}
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--muted)" }}>Update Status</div>
                <div className="flex flex-wrap gap-2">
                  {["Cutting", "Welding", "Painting", "Completed", "Shipped"].map((s) => (
                    <button key={s} className="btn btn-sm">{s}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Weld Inspections */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Weld Inspections</div>
              <span className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{welds.length} records</span>
            </div>
            {welds.length > 0 ? (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Weld ID</th>
                      <th>Type</th>
                      <th>Method</th>
                      <th>Inspector</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {welds.map((w) => (
                      <tr key={w.id}>
                        <td className="td-mono">{w.weld_id}</td>
                        <td style={{ fontSize: 12 }}>{w.joint_type}</td>
                        <td><span className="pill pill-info">{w.insp_method}</span></td>
                        <td style={{ fontSize: 12 }}>{w.inspector.split("/")[0].trim()}</td>
                        <td><StatusPill status={w.result} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card-body text-center py-8" style={{ color: "var(--muted)", fontSize: 13 }}>
                No weld inspections recorded for this part
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
