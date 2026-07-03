"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { Plus } from "lucide-react";

interface JC {
  id: string; cost_code: string; description: string | null;
  budget_amount: number; actual_amount: number; committed: number;
  variance: number; project_id: string;
}
interface Project { id: string; name: string; }

export default function JobCostPage() {
  const { selectedProjectId } = useGlobalProject();
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const project = selectedProjectId ?? projects.data?.[0]?.id;
  const list = useResourceList<JC>("job_costs", project ? { project_id: project, order_by: "cost_code", dir: "asc" } : undefined);
  const create = useCreate<JC>("job_costs");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<JC>[] = [
    { key: "code", label: "Cost code", mono: true, render: (r) => <strong>{r.cost_code}</strong> },
    { key: "desc", label: "Description", render: (r) => r.description ?? "—" },
    { key: "budget", label: "Budget", align: "right", mono: true, render: (r) => `$${Number(r.budget_amount).toLocaleString()}` },
    { key: "comm", label: "Committed", align: "right", mono: true, render: (r) => `$${Number(r.committed).toLocaleString()}` },
    { key: "actual", label: "Actual", align: "right", mono: true, render: (r) => `$${Number(r.actual_amount).toLocaleString()}` },
    {
      key: "var", label: "Variance", align: "right", mono: true, render: (r) => {
        const v = Number(r.variance);
        const color = v < 0 ? "#DC2626" : "#16A34A";
        return <span style={{ color, fontWeight: 700 }}>{v < 0 ? "-" : "+"}${Math.abs(v).toLocaleString()}</span>;
      }
    },
  ];

  const totalBudget = (list.data ?? []).reduce((s, r) => s + Number(r.budget_amount ?? 0), 0);
  const totalActual = (list.data ?? []).reduce((s, r) => s + Number(r.actual_amount ?? 0), 0);

  return (
    <PageWrapper title="Job Cost">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Job Cost Tracker</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Budget ${totalBudget.toLocaleString()} · Actual ${totalActual.toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={() => setShowNew(true)} disabled={!project}><Plus size={14} /> Add code</button>
        </div>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No cost codes yet", subtitle: "Add a cost code to start tracking budget vs actual." }}
        rowKey={(r) => r.id} />

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
  const [f, setF] = useState({ cost_code: "", description: "", budget_amount: "", actual_amount: "0", committed: "0" });
  return (
    <ResourceModal title="New cost code" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: projectId, cost_code: f.cost_code,
          description: f.description || undefined,
          budget_amount: Number(f.budget_amount || 0),
          actual_amount: Number(f.actual_amount || 0),
          committed: Number(f.committed || 0),
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Cost code" required><input className="input" required value={f.cost_code} onChange={(e) => setF({ ...f, cost_code: e.target.value })} placeholder="material" /></Field>
        <Field label="Description"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Budget"><input className="input" type="number" step="0.01" value={f.budget_amount} onChange={(e) => setF({ ...f, budget_amount: e.target.value })} /></Field>
        <Field label="Committed"><input className="input" type="number" step="0.01" value={f.committed} onChange={(e) => setF({ ...f, committed: e.target.value })} /></Field>
        <Field label="Actual"><input className="input" type="number" step="0.01" value={f.actual_amount} onChange={(e) => setF({ ...f, actual_amount: e.target.value })} /></Field>
      </div>
    </ResourceModal>
  );
}
