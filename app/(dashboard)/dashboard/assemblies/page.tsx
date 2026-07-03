"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { Plus } from "lucide-react";

interface Assembly {
  id: string; assembly_mark: string; description: string | null;
  total_weight: number | null; total_parts: number; completed_parts: number;
  status: string; project_id: string;
}
interface Project { id: string; name: string; }

export default function AssembliesPage() {
  const { selectedProjectId } = useGlobalProject();
  const asmQuery = selectedProjectId
    ? { order_by: "assembly_mark", dir: "asc", project_id: selectedProjectId }
    : { order_by: "assembly_mark", dir: "asc" };
  const list = useResourceList<Assembly>("assemblies", asmQuery);
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<Assembly>("assemblies");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<Assembly>[] = [
    { key: "mark", label: "Assembly Mark", mono: true, render: (r) => <strong>{r.assembly_mark}</strong> },
    { key: "desc", label: "Description", render: (r) => r.description ?? "—" },
    { key: "weight", label: "Weight", align: "right", mono: true, render: (r) => r.total_weight ? `${Number(r.total_weight).toLocaleString()} lb` : "—" },
    {
      key: "progress", label: "Progress", render: (r) => {
        const pct = r.total_parts === 0 ? 0 : Math.round((r.completed_parts / r.total_parts) * 100);
        return (
          <div style={{ minWidth: 140 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
              <span style={{ color: "var(--muted)" }}>{r.completed_parts}/{r.total_parts}</span>
              <strong>{pct}%</strong>
            </div>
            <div className="pbar"><div className="pbar-fill" style={{ width: `${pct}%`, background: "var(--primary)" }} /></div>
          </div>
        );
      }
    },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageWrapper title="Assemblies">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Assemblies</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{list.data?.length ?? 0} assemblies — progress auto-rolls up from parts</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New assembly</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No assemblies yet" }} rowKey={(r) => r.id} />

      {showNew && (
        <NewModal projects={projects.data ?? []} onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function NewModal({ projects, onClose, onSubmit, submitting, error }: {
  projects: Project[]; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({ project_id: projects[0]?.id ?? "", assembly_mark: "", description: "", total_weight: "" });
  return (
    <ResourceModal title="New assembly" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: f.project_id, assembly_mark: f.assembly_mark,
          description: f.description || undefined,
          total_weight: f.total_weight ? Number(f.total_weight) : undefined,
        });
      }}
    >
      <Field label="Project" required>
        <select className="input" required value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Assembly mark" required>
        <input className="input" required value={f.assembly_mark} onChange={(e) => setF({ ...f, assembly_mark: e.target.value })} placeholder="A-204" />
      </Field>
      <Field label="Description">
        <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      <Field label="Total weight (lb)">
        <input className="input" type="number" step="0.01" value={f.total_weight} onChange={(e) => setF({ ...f, total_weight: e.target.value })} />
      </Field>
    </ResourceModal>
  );
}
