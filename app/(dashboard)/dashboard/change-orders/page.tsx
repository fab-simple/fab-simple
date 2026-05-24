"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus } from "lucide-react";

interface CO {
  id: string; co_number: string; description: string; amount: number; status: string;
  drawing_rev: string | null; project_id: string; created_at: string;
}
interface Project { id: string; name: string; }

export default function ChangeOrdersPage() {
  const list = useResourceList<CO>("change_orders", { order_by: "created_at", dir: "desc" });
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<CO>("change_orders");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<CO>[] = [
    { key: "num", label: "CO #", mono: true, render: (r) => <strong>{r.co_number}</strong> },
    { key: "desc", label: "Description", render: (r) => r.description },
    { key: "rev", label: "Drawing Rev", mono: true, render: (r) => r.drawing_rev ?? "—" },
    { key: "amount", label: "Amount", align: "right", mono: true, render: (r) => `$${Number(r.amount).toLocaleString()}` },
    { key: "date", label: "Submitted", render: (r) => new Date(r.created_at).toLocaleDateString() },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  const totalPending = (list.data ?? []).filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amount ?? 0), 0);

  return (
    <PageWrapper title="Change Orders & RFI">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Change Orders</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {list.data?.length ?? 0} total · ${totalPending.toLocaleString()} pending approval
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New CO</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No change orders yet" }} rowKey={(r) => r.id} />

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
  const [f, setF] = useState({ project_id: projects[0]?.id ?? "", description: "", amount: "", drawing_rev: "", status: "pending", notes: "" });
  return (
    <ResourceModal title="New change order" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: f.project_id, description: f.description, amount: Number(f.amount || 0),
          drawing_rev: f.drawing_rev || undefined, status: f.status, notes: f.notes || undefined,
        });
      }}
    >
      <Field label="Project" required>
        <select className="input" required value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Description" required>
        <textarea className="input" required rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
      </Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Amount ($)" required>
          <input className="input" type="number" step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="Drawing rev affected">
          <input className="input" value={f.drawing_rev} onChange={(e) => setF({ ...f, drawing_rev: e.target.value })} placeholder="DS-101 Rev D" />
        </Field>
      </div>
      <Field label="Notes">
        <textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
      </Field>
    </ResourceModal>
  );
}
