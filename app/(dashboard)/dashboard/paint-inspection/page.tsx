"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { AttachmentsDrawer } from "@/components/ui/AttachmentsDrawer";
import { Plus, Paperclip } from "lucide-react";

interface PaintInsp {
  id: string; insp_number: string; project_id: string | null; part_id: string | null;
  surface_prep: string; primer_dft: number; topcoat_dft: number; total_dft: number;
  required_min: number; inspector_name: string; result: string;
  ambient_temp: number | null; humidity_pct: number | null; notes: string | null;
  inspection_date: string;
}
interface Project { id: string; name: string; }
interface Part { id: string; part_mark: string; }

const SURFACE_PREPS = ["SSPC-SP1", "SSPC-SP2", "SSPC-SP3", "SSPC-SP5", "SSPC-SP6", "SSPC-SP10", "SSPC-SP11"];

export default function PaintInspectionPage() {
  const list = useResourceList<PaintInsp>("paint_inspections", { order_by: "inspection_date", dir: "desc" });
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const parts = useResourceList<Part>("parts", { limit: "200" });
  const create = useCreate<PaintInsp>("paint_inspections");
  const [showNew, setShowNew] = useState(false);
  const [attachTarget, setAttachTarget] = useState<PaintInsp | null>(null);

  const cols: Column<PaintInsp>[] = [
    { key: "insp", label: "Insp #", mono: true, render: (r) => r.insp_number },
    { key: "date", label: "Date", render: (r) => new Date(r.inspection_date).toLocaleDateString() },
    { key: "prep", label: "Surface Prep", mono: true, render: (r) => r.surface_prep },
    { key: "primer", label: "Primer DFT", align: "right", mono: true, render: (r) => `${r.primer_dft} mil` },
    { key: "top", label: "Topcoat DFT", align: "right", mono: true, render: (r) => `${r.topcoat_dft} mil` },
    { key: "total", label: "Total DFT", align: "right", mono: true, render: (r) => <strong>{r.total_dft} mil</strong> },
    { key: "req", label: "Required Min", align: "right", mono: true, render: (r) => `${r.required_min} mil` },
    { key: "insp_n", label: "Inspector", render: (r) => r.inspector_name },
    { key: "result", label: "Result", render: (r) => <StatusPill status={r.result} /> },
    { key: "actions", label: "", render: (r) => (
      <button title="Attach DFT gauge photo" className="btn btn-sm" onClick={() => setAttachTarget(r)}>
        <Paperclip size={12} />
      </button>
    ) },
  ];

  return (
    <PageWrapper title="Paint Inspection">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Paint Inspection (SSPC)</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>Auto-fails when total DFT &lt; required min</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New inspection</button>
      </div>

      <DataTable
        data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No inspections yet", subtitle: "Log your first paint inspection to start the QC paper trail." }}
        rowKey={(r) => r.id}
      />

      {showNew && (
        <NewModal
          projects={projects.data ?? []}
          parts={parts.data ?? []}
          onClose={() => setShowNew(false)}
          onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending}
          error={create.error?.message ?? null}
        />
      )}

      <AttachmentsDrawer
        open={!!attachTarget}
        onClose={() => setAttachTarget(null)}
        entityType="paint_inspections"
        entityId={attachTarget?.id ?? ""}
        bucket="photos"
        title={`DFT photos — ${attachTarget?.insp_number ?? ""}`}
        accept="image/*"
      />
    </PageWrapper>
  );
}

function NewModal({ projects, parts, onClose, onSubmit, submitting, error }: {
  projects: Project[]; parts: Part[];
  onClose: () => void; onSubmit: (p: Record<string, unknown>) => void;
  submitting: boolean; error: string | null;
}) {
  const [form, setForm] = useState({
    project_id: projects[0]?.id ?? "",
    part_id: "",
    surface_prep: "SSPC-SP10",
    primer_dft: "3.0", topcoat_dft: "3.0", required_min: "5.0",
    inspector_name: "",
    ambient_temp: "", humidity_pct: "",
    notes: "",
  });
  return (
    <ResourceModal
      title="New paint inspection" submitLabel="Submit"
      onClose={onClose} submitting={submitting} error={error} width={560}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          project_id: form.project_id || undefined,
          part_id: form.part_id || undefined,
          surface_prep: form.surface_prep,
          primer_dft: Number(form.primer_dft),
          topcoat_dft: Number(form.topcoat_dft),
          required_min: Number(form.required_min),
          inspector_name: form.inspector_name,
          ambient_temp: form.ambient_temp ? Number(form.ambient_temp) : undefined,
          humidity_pct: form.humidity_pct ? Number(form.humidity_pct) : undefined,
          notes: form.notes || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Project">
          <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
            <option value="">—</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Part">
          <select className="input" value={form.part_id} onChange={(e) => setForm({ ...form, part_id: e.target.value })}>
            <option value="">—</option>
            {parts.map((p) => <option key={p.id} value={p.id}>{p.part_mark}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Surface prep" required>
        <select className="input" value={form.surface_prep} onChange={(e) => setForm({ ...form, surface_prep: e.target.value })}>
          {SURFACE_PREPS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Primer DFT (mil)" required>
          <input className="input" type="number" step="0.1" required value={form.primer_dft} onChange={(e) => setForm({ ...form, primer_dft: e.target.value })} />
        </Field>
        <Field label="Topcoat DFT (mil)" required>
          <input className="input" type="number" step="0.1" required value={form.topcoat_dft} onChange={(e) => setForm({ ...form, topcoat_dft: e.target.value })} />
        </Field>
        <Field label="Required min (mil)" required>
          <input className="input" type="number" step="0.1" required value={form.required_min} onChange={(e) => setForm({ ...form, required_min: e.target.value })} />
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Ambient temp (°F)">
          <input className="input" type="number" step="0.1" value={form.ambient_temp} onChange={(e) => setForm({ ...form, ambient_temp: e.target.value })} />
        </Field>
        <Field label="Humidity %">
          <input className="input" type="number" step="0.1" value={form.humidity_pct} onChange={(e) => setForm({ ...form, humidity_pct: e.target.value })} />
        </Field>
      </div>
      <Field label="Inspector name" required>
        <input className="input" required value={form.inspector_name} onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} />
      </Field>
      <Field label="Notes" hint="Pass/fail is computed from DFT vs required min — an NCR auto-opens on fail.">
        <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
      </Field>
    </ResourceModal>
  );
}
