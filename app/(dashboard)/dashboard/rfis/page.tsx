"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus } from "lucide-react";

interface RFI {
  id: string; rfi_number: string; question: string; answer: string | null;
  status: string; due_date: string | null; project_id: string;
  drawing_id: string | null; submitted_by_name: string | null;
  created_at: string;
}
interface Project { id: string; name: string; }

export default function RfisPage() {
  const list = useResourceList<RFI>("rfis", { order_by: "created_at", dir: "desc" });
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<RFI>("rfis");
  const [showNew, setShowNew] = useState(false);

  const open = (list.data ?? []).filter((r) => r.status === "open").length;
  const overdue = (list.data ?? []).filter((r) => r.status === "open" && r.due_date && new Date(r.due_date) < new Date()).length;

  const cols: Column<RFI>[] = [
    { key: "num", label: "RFI #", mono: true, render: (r) => <strong>{r.rfi_number}</strong> },
    { key: "q", label: "Question", render: (r) => <span style={{ maxWidth: 360, display: "inline-block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.question}</span> },
    { key: "submitter", label: "From", render: (r) => r.submitted_by_name ?? "—" },
    { key: "due", label: "Due", render: (r) => r.due_date ? new Date(r.due_date).toLocaleDateString() : "—" },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageWrapper title="RFI Log">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>RFI Log</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {open} open · {overdue} overdue
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New RFI</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No RFIs yet" }} rowKey={(r) => r.id} />

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
  const [f, setF] = useState({
    project_id: projects[0]?.id ?? "", question: "", submitted_by_name: "",
    due_date: "", status: "open", impacts_cost: false, impacts_schedule: false,
  });
  return (
    <ResourceModal title="New RFI" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: f.project_id, question: f.question,
          submitted_by_name: f.submitted_by_name || undefined,
          due_date: f.due_date || undefined,
          status: f.status,
          impacts_cost: f.impacts_cost, impacts_schedule: f.impacts_schedule,
        });
      }}
    >
      <Field label="Project" required>
        <select className="input" required value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Question" required>
        <textarea className="input" required rows={4} value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
      </Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Submitted by"><input className="input" value={f.submitted_by_name} onChange={(e) => setF({ ...f, submitted_by_name: e.target.value })} /></Field>
        <Field label="Due date"><input className="input" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text)" }}>
          <input type="checkbox" checked={f.impacts_cost} onChange={(e) => setF({ ...f, impacts_cost: e.target.checked })} />
          Impacts cost
        </label>
        <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text)" }}>
          <input type="checkbox" checked={f.impacts_schedule} onChange={(e) => setF({ ...f, impacts_schedule: e.target.checked })} />
          Impacts schedule
        </label>
      </div>
    </ResourceModal>
  );
}
