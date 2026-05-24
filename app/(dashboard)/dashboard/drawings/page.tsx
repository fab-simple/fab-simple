"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { AttachmentsDrawer } from "@/components/ui/AttachmentsDrawer";
import { useResourceList, useCreate, useUpdate } from "@/hooks/useResource";
import { Plus, Paperclip, Archive } from "lucide-react";

interface Drawing {
  id: string; drawing_number: string; revision: string; title: string | null;
  type: string; status: string; current_revision: boolean; date_issued: string | null;
  parts_count: number; project_id: string;
}
interface Project { id: string; name: string; }

const TYPES = ["shop", "erection", "connection"];
const STATUSES = ["in_progress", "submitted", "approved", "released", "superseded"];

export default function DrawingsPage() {
  const list = useResourceList<Drawing>("drawings", { order_by: "drawing_number", dir: "asc" });
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<Drawing>("drawings");
  const update = useUpdate<Drawing>("drawings");
  const [showNew, setShowNew] = useState(false);
  const [attachTarget, setAttachTarget] = useState<Drawing | null>(null);

  async function markSuperseded(d: Drawing) {
    if (!confirm(`Mark ${d.drawing_number} Rev ${d.revision} as superseded?`)) return;
    update.mutate({ id: d.id, body: { status: "superseded", current_revision: false } });
  }

  const cols: Column<Drawing>[] = [
    { key: "num", label: "Drawing #", mono: true, render: (r) => <strong>{r.drawing_number}</strong> },
    { key: "rev", label: "Rev", mono: true, render: (r) => r.revision + (r.current_revision ? " ★" : "") },
    { key: "title", label: "Title", render: (r) => r.title ?? "—" },
    { key: "type", label: "Type", render: (r) => <span style={{ textTransform: "capitalize" }}>{r.type}</span> },
    { key: "issued", label: "Issued", render: (r) => r.date_issued ? new Date(r.date_issued).toLocaleDateString() : "—" },
    { key: "parts", label: "Parts", align: "right", mono: true, render: (r) => r.parts_count },
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
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>Revs auto-supersede when a new one is approved</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New drawing</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No drawings yet" }} rowKey={(r) => r.id} />

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
