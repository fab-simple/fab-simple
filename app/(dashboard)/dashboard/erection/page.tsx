"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus } from "lucide-react";

interface Seq {
  id: string; project_id: string; sequence_number: number;
  description: string | null; load_number: string | null; priority: number;
  phase: string | null; status: string;
}
interface Project { id: string; name: string; }

export default function ErectionPage() {
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const [projectId, setProjectId] = useState<string>("");
  const project = projectId || projects.data?.[0]?.id;
  const list = useResourceList<Seq>("erection_sequence", project ? { project_id: project, order_by: "sequence_number", dir: "asc", limit: "200" } : undefined);
  const create = useCreate<Seq>("erection_sequence");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<Seq>[] = [
    { key: "seq", label: "Seq #", mono: true, render: (r) => <strong>{r.sequence_number}</strong> },
    { key: "desc", label: "Description", render: (r) => r.description ?? "—" },
    { key: "phase", label: "Phase", mono: true, render: (r) => r.phase ?? "—" },
    { key: "load", label: "Load #", mono: true, render: (r) => r.load_number ?? "—" },
    { key: "prio", label: "Priority", align: "right", mono: true, render: (r) => r.priority },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageWrapper title="Erection Sequence">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Erection Sequence</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>Field erection plan in load/lift order</div>
        </div>
        <div className="flex items-center gap-2">
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ height: 32, width: 220 }}>
            <option value="">{projects.data?.[0]?.name ?? "Select project"}</option>
            {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowNew(true)} disabled={!project}><Plus size={14} /> New step</button>
        </div>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No erection steps yet" }} rowKey={(r) => r.id} />

      {showNew && project && (
        <NewModal projectId={project} onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function NewModal({ projectId, onClose, onSubmit, submitting, error }: {
  projectId: string; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({ sequence_number: "1", description: "", load_number: "", priority: "0", phase: "" });
  return (
    <ResourceModal title="New erection step" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: projectId, sequence_number: Number(f.sequence_number),
          description: f.description || undefined,
          load_number: f.load_number || undefined,
          priority: Number(f.priority || 0),
          phase: f.phase || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Sequence #" required><input className="input" type="number" min="1" required value={f.sequence_number} onChange={(e) => setF({ ...f, sequence_number: e.target.value })} /></Field>
        <Field label="Phase"><input className="input" value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value })} placeholder="P1" /></Field>
      </div>
      <Field label="Description"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Load #"><input className="input" value={f.load_number} onChange={(e) => setF({ ...f, load_number: e.target.value })} /></Field>
        <Field label="Priority"><input className="input" type="number" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} /></Field>
      </div>
    </ResourceModal>
  );
}
