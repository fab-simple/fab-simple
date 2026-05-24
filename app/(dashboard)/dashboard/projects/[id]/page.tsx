"use client";

import Link from "next/link";
import { use } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { useResource, useResourceList, useUpdate } from "@/hooks/useResource";
import { FabAPI } from "@/lib/api";
import { useState } from "react";
import { Loader2, AlertCircle, Archive, ArrowLeft, Wand2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Project {
  id: string; name: string; number: string | null; gc_name: string | null;
  contract_value: number | null; est_tonnage: number | null; status: string;
  start_date: string | null; deadline: string | null; description: string | null;
  color: string | null; is_archived: boolean;
}
interface Part { id: string; part_mark: string; profile: string; status: string; quantity: number; }
interface Drawing { id: string; drawing_number: string; revision: string; status: string; }
interface CO { id: string; co_number: string; description: string; amount: number; status: string; }

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useResource<Project>("projects", id);
  const parts = useResourceList<Part>("parts", { project_id: id, limit: "20" });
  const drawings = useResourceList<Drawing>("drawings", { project_id: id, limit: "20" });
  const cos = useResourceList<CO>("change_orders", { project_id: id, limit: "20" });
  const update = useUpdate<Project>("projects");
  const [archiving, setArchiving] = useState(false);
  const [seedingAisc, setSeedingAisc] = useState(false);

  if (project.isLoading) {
    return <PageWrapper title="…"><div className="flex items-center justify-center" style={{ padding: 60, color: "var(--muted)" }}><Loader2 size={18} className="animate-spin" /><span style={{ marginLeft: 10 }}>Loading project…</span></div></PageWrapper>;
  }
  if (project.error || !project.data) {
    return <PageWrapper title="Project"><div className="card" style={{ padding: 24, color: "#DC2626" }}><AlertCircle size={18} /> {project.error?.message ?? "Project not found"}</div></PageWrapper>;
  }

  const p = project.data;
  const completed = (parts.data ?? []).filter((x) => ["complete", "shipped"].includes(x.status)).length;
  const progress = parts.data?.length ? Math.round((completed / parts.data.length) * 100) : 0;

  async function archive() {
    setArchiving(true);
    try { await FabAPI.archiveProject(id); project.refetch(); } finally { setArchiving(false); }
  }
  async function seedAisc() {
    setSeedingAisc(true);
    try { await FabAPI.seedAisc(id); } finally { setSeedingAisc(false); }
  }

  return (
    <PageWrapper title={p.name}>
      <div className="flex items-center gap-2 mb-4">
        <Link href="/dashboard/projects" className="btn btn-sm"><ArrowLeft size={12} /> Back</Link>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div className="text-[22px] font-bold" style={{ color: "var(--text)" }}>{p.name}</div>
            <div className="text-[12px] font-mono" style={{ color: "var(--muted)", marginTop: 4 }}>{p.number ?? "—"}</div>
            <div className="text-[13px]" style={{ color: "var(--muted)", marginTop: 8 }}>{p.description ?? ""}</div>
            <div className="grid-4" style={{ gap: 16, marginTop: 20 }}>
              <Stat label="GC" value={p.gc_name ?? "—"} />
              <Stat label="Contract" value={p.contract_value ? formatCurrency(p.contract_value) : "—"} />
              <Stat label="Est. tonnage" value={p.est_tonnage ? `${p.est_tonnage} tons` : "—"} />
              <Stat label="Deadline" value={p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"} />
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <StatusPill status={p.status} />
            <button className="btn btn-sm" onClick={seedAisc} disabled={seedingAisc}>
              {seedingAisc ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Seed AISC checklist
            </button>
            <button className="btn btn-sm" onClick={archive} disabled={archiving || p.is_archived}>
              {archiving ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
              Archive
            </button>
          </div>
        </div>
        <div className="card-body" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>Progress</span>
            <span className="text-[14px] font-bold font-mono" style={{ color: "var(--text)" }}>{completed} / {parts.data?.length ?? 0} ({progress}%)</span>
          </div>
          <div className="pbar"><div className="pbar-fill" style={{ width: `${progress}%`, background: p.color ?? "var(--primary)" }} /></div>
        </div>
      </div>

      <div className="grid-2 gap-md">
        <div className="card">
          <div className="card-header"><div className="card-title">Parts ({parts.data?.length ?? 0})</div></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Mark</th><th>Profile</th><th>Qty</th><th>Status</th></tr></thead>
              <tbody>
                {(parts.data ?? []).slice(0, 8).map((x) => (
                  <tr key={x.id}>
                    <td className="td-mono">{x.part_mark}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{x.profile}</td>
                    <td className="td-mono">{x.quantity}</td>
                    <td><StatusPill status={x.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Drawings ({drawings.data?.length ?? 0})</div></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Drawing</th><th>Rev</th><th>Status</th></tr></thead>
              <tbody>
                {(drawings.data ?? []).map((d) => (
                  <tr key={d.id}>
                    <td className="td-mono">{d.drawing_number}</td>
                    <td className="td-mono">{d.revision}</td>
                    <td><StatusPill status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mt-section">
        <div className="card-header"><div className="card-title">Change Orders ({cos.data?.length ?? 0})</div></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>CO #</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {(cos.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="td-mono">{c.co_number}</td>
                  <td>{c.description}</td>
                  <td className="td-mono">${Number(c.amount).toLocaleString()}</td>
                  <td><StatusPill status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-[14px] font-semibold mt-1" style={{ color: "var(--text)" }}>{value}</div>
    </div>
  );
}
