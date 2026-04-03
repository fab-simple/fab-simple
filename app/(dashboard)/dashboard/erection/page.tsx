"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { ERECTION_SEQUENCES } from "@/lib/mock-data";

const DOT_COLORS: Record<string, string> = {
  Complete: "var(--green)",
  "In Progress": "var(--primary)",
  Queued: "var(--border-2)",
};

export default function ErectionPage() {
  return (
    <PageWrapper title="Erection Sequence">
      <div className="grid-4 gap-md mb-section">
        <div className="stat-card green"><div className="stat-label">Complete</div><div className="stat-value">{ERECTION_SEQUENCES.filter(e => e.status === "Complete").length}</div></div>
        <div className="stat-card blue"><div className="stat-label">In Progress</div><div className="stat-value">{ERECTION_SEQUENCES.filter(e => e.status === "In Progress").length}</div></div>
        <div className="stat-card primary"><div className="stat-label">Queued</div><div className="stat-value">{ERECTION_SEQUENCES.filter(e => e.status === "Queued").length}</div></div>
        <div className="stat-card amber"><div className="stat-label">Total Sequences</div><div className="stat-value">{ERECTION_SEQUENCES.length}</div></div>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <span className="font-bold text-[13px]" style={{ color: "var(--text)" }}>Dallas Skyline Tower — Erection Plan</span>
        <span className="pill pill-active">Phase 1–2</span>
      </div>

      {ERECTION_SEQUENCES.map((seq) => (
        <div key={seq.id} className="seq-item">
          <div className="seq-num" style={{ background: DOT_COLORS[seq.status] || "var(--sidebar)" }}>
            {seq.seq_number}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-semibold text-[13px]" style={{ color: "var(--text)" }}>{seq.description}</span>
              <span className="pill pill-info">{seq.phase}</span>
              <StatusPill status={seq.status} size="sm" />
            </div>
            <div className="flex gap-4 flex-wrap">
              <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>{seq.profiles}</span>
              <span className="text-[11px]" style={{ color: "var(--faint)" }}>Assemblies: {seq.assembly_ids}</span>
            </div>
          </div>
        </div>
      ))}
    </PageWrapper>
  );
}
