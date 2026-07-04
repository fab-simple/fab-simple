"use client";

import { useState, useMemo } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { AttachmentsDrawer } from "@/components/ui/AttachmentsDrawer";
import { useResourceList, useCreate, useUpdate } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { Plus, Paperclip, Archive, FileText, Compass } from "lucide-react";

interface Drawing {
  id: string; drawing_number: string; revision: string; title: string | null;
  type: string; status: string; current_revision: boolean; date_issued: string | null;
  parts_count: number; project_id: string;
}
interface Project { id: string; name: string; }

const TYPES = ["shop", "erection_plan", "erection", "connection"];
const STATUSES = ["in_progress", "submitted", "approved", "released", "superseded"];

export default function DrawingsPage() {
  const { selectedProjectId } = useGlobalProject();
  const listQuery = selectedProjectId
    ? { order_by: "drawing_number", dir: "asc", project_id: selectedProjectId }
    : { order_by: "drawing_number", dir: "asc" };
  const list = useResourceList<Drawing>("drawings", listQuery);
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<Drawing>("drawings");
  const update = useUpdate<Drawing>("drawings");
  const [showNew, setShowNew] = useState(false);
  const [attachTarget, setAttachTarget] = useState<Drawing | null>(null);
  const [selectedType, setSelectedType] = useState<string>("all");

  const filteredData = useMemo(() => {
    if (!list.data) return [];
    if (selectedType === "all") return list.data;
    if (selectedType === "erection_plan") {
      return list.data.filter((d) => d.type === "erection_plan" || d.type === "erection");
    }
    return list.data.filter((d) => d.type === selectedType);
  }, [list.data, selectedType]);

  async function markSuperseded(d: Drawing) {
    if (!confirm(`Mark ${d.drawing_number} Rev ${d.revision} as superseded?`)) return;
    update.mutate({ id: d.id, body: { status: "superseded", current_revision: false } });
  }

  const cols: Column<Drawing>[] = [
    { key: "num", label: "Drawing #", mono: true, render: (r) => <strong>{r.drawing_number}</strong> },
    { key: "rev", label: "Rev", mono: true, render: (r) => r.revision + (r.current_revision ? " ★" : "") },
    { key: "title", label: "Title", render: (r) => r.title ?? "—" },
    { key: "type", label: "Type", render: (r) => (
      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
        r.type === "erection_plan" || r.type === "erection"
          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
          : r.type === "shop"
          ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
          : "bg-slate-700 text-slate-300"
      }`}>
        {r.type === "erection_plan" ? "E-Plan (GA)" : r.type}
      </span>
    ) },
    { key: "issued", label: "Issued", render: (r) => r.date_issued ? new Date(r.date_issued).toLocaleDateString() : "—" },
    { key: "parts", label: "Parts", align: "right", mono: true, render: (r) => r.parts_count ?? 0 },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "actions", label: "", render: (r) => (
      <div className="flex items-center gap-1">
        <button title="Attachments" className="btn btn-sm" onClick={() => setAttachTarget(r)}><Paperclip size={12} /></button>
        {r.status !== "superseded" && (
          <button title="Mark superseded" className="btn btn-sm" onClick={() => markSuperseded(r)} disabled={update.isPending}>
            <Archive size={12} />
          </button>
        )}
      </div>
    ) },
  ];

  return (
    <PageWrapper title="Drawings">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Drawing Log</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>Manage Shop Drawings, Erection Plans (E-Plans), and Revision Sets</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New drawing</button>
      </div>

      {/* Type Filter Pills */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedType("all")}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer border transition-colors ${
            selectedType === "all" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          All Drawings ({list.data?.length ?? 0})
        </button>
        <button
          onClick={() => setSelectedType("erection_plan")}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer border transition-colors ${
            selectedType === "erection_plan" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          E-Plans / GA ({list.data?.filter((d) => d.type === "erection_plan" || d.type === "erection").length ?? 0})
        </button>
        <button
          onClick={() => setSelectedType("shop")}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer border transition-colors ${
            selectedType === "shop" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Shop Drawings ({list.data?.filter((d) => d.type === "shop").length ?? 0})
        </button>
        <button
          onClick={() => setSelectedType("connection")}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer border transition-colors ${
            selectedType === "connection" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Connection Drawings ({list.data?.filter((d) => d.type === "connection").length ?? 0})
        </button>
      </div>

      <DataTable data={filteredData} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No drawings found for selected type" }} rowKey={(r) => r.id} />

      {showNew && (
        <NewModal projects={projects.data ?? []} onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}

      <AttachmentsDrawer
        open={!!attachTarget}
        onClose={() => setAttachTarget(null)}
        entityType="drawings"
        entityId={attachTarget?.id ?? ""}
        bucket="drawings"
        title={`Attachments — ${attachTarget?.drawing_number ?? ""} Rev ${attachTarget?.revision ?? ""}`}
        subtitle={attachTarget?.title ?? undefined}
        accept=".pdf,application/pdf,image/*,.dwg,.dxf"
      />
    </PageWrapper>
  );
}

function NewModal({ projects, onClose, onSubmit, submitting, error }: {
  projects: Project[]; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({ project_id: projects[0]?.id ?? "", drawing_number: "", revision: "A", title: "", type: "shop", status: "in_progress", date_issued: "" });
  return (
    <ResourceModal title="New drawing" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: f.project_id, drawing_number: f.drawing_number, revision: f.revision,
          title: f.title || undefined, type: f.type, status: f.status, date_issued: f.date_issued || undefined,
        });
      }}
    >
      <Field label="Project" required>
        <select className="input" required value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Drawing number" required>
          <input className="input" required value={f.drawing_number} onChange={(e) => setF({ ...f, drawing_number: e.target.value })} placeholder="DS-101" />
        </Field>
        <Field label="Revision" required>
          <input className="input" required value={f.revision} onChange={(e) => setF({ ...f, revision: e.target.value })} placeholder="A" />
        </Field>
      </div>
      <Field label="Title">
        <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </Field>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Type">
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        </Field>
        <Field label="Status">
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </Field>
        <Field label="Date issued">
          <input className="input" type="date" value={f.date_issued} onChange={(e) => setF({ ...f, date_issued: e.target.value })} />
        </Field>
      </div>
    </ResourceModal>
  );
}
