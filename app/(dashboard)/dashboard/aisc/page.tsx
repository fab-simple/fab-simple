"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { useResourceList, useUpdate, FAB_MODE } from "@/hooks/useResource";
import { FabAPI } from "@/lib/api";
import { CheckCircle2, AlertCircle, MinusCircle, Loader2, Sparkles, FileDown } from "lucide-react";
import { generateQcReport } from "@/lib/pdf";

interface AiscItem {
  id: string; project_id: string; section_ref: string; item_text: string;
  category: string; status: string; notes: string | null; sort_order: number;
}
interface Project { id: string; name: string; }

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open:   <AlertCircle size={14} style={{ color: "#D97706" }} />,
  done:   <CheckCircle2 size={14} style={{ color: "#16A34A" }} />,
  hold:   <AlertCircle size={14} style={{ color: "#DC2626" }} />,
  na:     <MinusCircle size={14} style={{ color: "#94A3B8" }} />,
};
const STATUSES = ["open", "done", "hold", "na"];

export default function AiscPage() {
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const [projectId, setProjectId] = useState<string>("");
  const project = projectId || projects.data?.[0]?.id;
  const items = useResourceList<AiscItem>("aisc_checklist", project ? { project_id: project, order_by: "sort_order", dir: "asc", limit: "200" } : undefined, { enabled: FAB_MODE === "live" && !!project });
  const update = useUpdate<AiscItem>("aisc_checklist");
  const [seeding, setSeeding] = useState(false);

  async function handleSeed() {
    if (!project) return;
    setSeeding(true);
    try {
      await FabAPI.seedAisc(project);
      items.refetch();
    } finally { setSeeding(false); }
  }

  async function downloadQcPdf() {
    if (!project) return;
    const res = await FabAPI.qcReport(project) as {
      welds: Array<{ weld_number: string; project_id: string; result: string; inspected_at: string | null }>;
      paint: Array<{ insp_number: string; project_id: string; result: string; dft_avg: number | null; created_at: string }>;
      ncrs: Array<{ ncr_number: string; description: string; status: string; created_at: string }>;
      aisc: Array<{ section_ref: string; item_text: string; status: string; category: string }>;
      generated_at: string;
      project_id: string | null;
    };
    const projName = projects.data?.find((p) => p.id === project)?.name ?? "QC";
    const doc = generateQcReport({ ...res, project_name: projName });
    doc.save(`QC-Report-${projName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const grouped = (items.data ?? []).reduce<Record<string, AiscItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const stats = (items.data ?? []).reduce(
    (acc, it) => { acc[it.status] = (acc[it.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const total = items.data?.length ?? 0;
  const pct = total ? Math.round(((stats.done ?? 0) / total) * 100) : 0;

  return (
    <PageWrapper title="AISC 303 QC">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>AISC 303-10 Quality Manual</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{total} items · {stats.done ?? 0} cleared · {pct}% complete</div>
        </div>
        <div className="flex items-center gap-2">
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ height: 32, width: 220 }}>
            <option value="">{projects.data?.[0]?.name ?? "Select project"}</option>
            {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn" onClick={handleSeed} disabled={seeding || !project}>
            {seeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Seed catalogue (24 items)
          </button>
          <button className="btn btn-primary" onClick={downloadQcPdf} disabled={!project}>
            <FileDown size={14} /> QC Report PDF
          </button>
        </div>
      </div>

      <div className="grid-4" style={{ gap: 16, marginBottom: 24 }}>
        <Stat label="Open"   value={stats.open ?? 0} color="#D97706" />
        <Stat label="Done"   value={stats.done ?? 0} color="#16A34A" />
        <Stat label="Hold"   value={stats.hold ?? 0} color="#DC2626" />
        <Stat label="N/A"    value={stats.na ?? 0}   color="#94A3B8" />
      </div>

      {items.error ? (
        <div className="card" style={{ padding: 24, color: "var(--danger, #b91c1c)" }}>
          <strong>Failed to load AISC checklist.</strong>
          <div style={{ marginTop: 6, fontSize: 12 }}>{items.error.message}</div>
          <button className="btn" style={{ marginTop: 12, height: 30 }} onClick={() => items.refetch()}>Retry</button>
        </div>
      ) : items.isLoading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>
      ) : total === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <Sparkles size={28} style={{ color: "var(--primary)", margin: "0 auto 12px" }} />
          <div className="text-[16px] font-bold" style={{ color: "var(--text)", marginBottom: 6 }}>
            No AISC items yet for this project
          </div>
          <div className="text-[13px]" style={{ color: "var(--muted)", marginBottom: 16 }}>
            Seed the 24-item AISC 303-10 checklist to start the compliance binder. Items cover
            Materials, Fabrication, Welding, Connections, Erection, Coatings, and Documentation.
          </div>
          <button className="btn btn-primary" onClick={handleSeed} disabled={seeding || !project} style={{ height: 36 }}>
            {seeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Seed catalogue (24 items)
          </button>
        </div>
      ) : Object.entries(grouped).map(([category, list]) => (
        <div className="card" key={category} style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">{category}</div>
            <span className="pill" style={{ fontSize: 10 }}>{list.length} items</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {list.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3" style={{ borderBottom: "1px solid var(--bg-muted)" }}>
                {STATUS_ICONS[item.status]}
                <div style={{ flex: 1 }}>
                  <div className="text-[13px]" style={{ color: "var(--text)" }}>{item.item_text}</div>
                  <div className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{item.section_ref}</div>
                </div>
                <select
                  className="input"
                  value={item.status}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ id: item.id, body: { status: e.target.value } })}
                  style={{ height: 28, width: 120, fontSize: 11 }}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <StatusPill status={item.status === "done" ? "done" : item.status === "hold" ? "warn" : item.status === "na" ? "ns" : "open"} size="sm" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </PageWrapper>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: 24 }}>{value}</div>
    </div>
  );
}
