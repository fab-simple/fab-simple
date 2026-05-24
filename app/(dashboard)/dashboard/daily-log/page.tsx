"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { AttachmentsDrawer } from "@/components/ui/AttachmentsDrawer";
import { Plus, Paperclip } from "lucide-react";

interface Log {
  id: string; log_date: string; shift: string | null; station: string;
  operators: string[] | null; parts_completed: number; hours_worked: number;
  operation_type: string | null; notes: string | null; project_id: string | null;
}
interface Project { id: string; name: string; }

const OPERATIONS = ["Cutting", "Drilling", "Welding", "Painting", "Assembly", "Shipping", "Other"];

export default function DailyLogPage() {
  const list = useResourceList<Log>("daily_production_log", { order_by: "log_date", dir: "desc" });
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<Log>("daily_production_log");
  const [showNew, setShowNew] = useState(false);
  const [attachTarget, setAttachTarget] = useState<Log | null>(null);

  const cols: Column<Log>[] = [
    { key: "date", label: "Date", render: (r) => new Date(r.log_date).toLocaleDateString() },
    { key: "shift", label: "Shift", render: (r) => r.shift ?? "Day" },
    { key: "station", label: "Station", render: (r) => <strong>{r.station}</strong> },
    { key: "op", label: "Operation", render: (r) => r.operation_type ?? "—" },
    { key: "operators", label: "Operators", render: (r) => (r.operators ?? []).join(", ") || "—" },
    { key: "parts", label: "Parts", align: "right", mono: true, render: (r) => r.parts_completed },
    { key: "hours", label: "Hours", align: "right", mono: true, render: (r) => `${r.hours_worked}h` },
    { key: "actions", label: "", render: (r) => (
      <button title="Attach photo / scan" className="btn btn-sm" onClick={() => setAttachTarget(r)}>
        <Paperclip size={12} />
      </button>
    ) },
  ];

  return (
    <PageWrapper title="Daily Production Log">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Daily Production Log</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{list.data?.length ?? 0} entries</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> Log shift</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No production logs yet" }} rowKey={(r) => r.id} />

      {showNew && (
        <NewModal projects={projects.data ?? []} onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}

      <AttachmentsDrawer
        open={!!attachTarget}
        onClose={() => setAttachTarget(null)}
        entityType="daily_production_log"
        entityId={attachTarget?.id ?? ""}
        bucket="photos"
        title={`Photos — ${attachTarget?.station ?? ""}`}
        subtitle={attachTarget ? new Date(attachTarget.log_date).toLocaleDateString() : undefined}
        accept="image/*"
      />
    </PageWrapper>
  );
}

function NewModal({ projects, onClose, onSubmit, submitting, error }: {
  projects: Project[]; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({
    project_id: projects[0]?.id ?? "",
    log_date: new Date().toISOString().slice(0, 10),
    shift: "Day", station: "", operators: "", parts_completed: "0", hours_worked: "8",
    operation_type: "Cutting", notes: "",
  });
  return (
    <ResourceModal title="Log production shift" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: f.project_id || undefined,
          log_date: f.log_date, shift: f.shift,
          station: f.station,
          operators: f.operators ? f.operators.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          parts_completed: Number(f.parts_completed),
          hours_worked: Number(f.hours_worked),
          operation_type: f.operation_type, notes: f.notes || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Project">
          <select className="input" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
            <option value="">—</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required>
          <input className="input" type="date" required value={f.log_date} onChange={(e) => setF({ ...f, log_date: e.target.value })} />
        </Field>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Shift">
          <select className="input" value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })}>
            <option>Day</option><option>Swing</option><option>Night</option>
          </select>
        </Field>
        <Field label="Station" required>
          <input className="input" required value={f.station} onChange={(e) => setF({ ...f, station: e.target.value })} placeholder="Bay 1 / Cutting" />
        </Field>
        <Field label="Operation">
          <select className="input" value={f.operation_type} onChange={(e) => setF({ ...f, operation_type: e.target.value })}>
            {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Operators (comma-separated)">
        <input className="input" value={f.operators} onChange={(e) => setF({ ...f, operators: e.target.value })} placeholder="Roberto Torres, Marcus Johnson" />
      </Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Parts completed"><input className="input" type="number" min="0" value={f.parts_completed} onChange={(e) => setF({ ...f, parts_completed: e.target.value })} /></Field>
        <Field label="Hours worked"><input className="input" type="number" step="0.1" min="0" value={f.hours_worked} onChange={(e) => setF({ ...f, hours_worked: e.target.value })} /></Field>
      </div>
      <Field label="Notes">
        <textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
      </Field>
    </ResourceModal>
  );
}
