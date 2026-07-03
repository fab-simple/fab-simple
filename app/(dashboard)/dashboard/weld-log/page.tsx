"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { Plus } from "lucide-react";

interface Weld {
  id: string; weld_number: string; joint_type: string; weld_process: string;
  filler_metal: string; inspection_method: string; cwi_reference: string | null;
  inspector_name: string; result: string; aws_d11_reference: string | null;
  notes: string | null; inspection_date: string;
}
interface Project { id: string; name: string; }
interface Part { id: string; part_mark: string; }

const JOINT_TYPES = ["CJP Groove", "PJP Groove", "Fillet", "Plug / Slot"];
const PROCESSES = ["FCAW / E71T-1", "SMAW / E7018", "GMAW / ER70S-6", "SAW"];
const METHODS = ["VT (Visual)", "UT (Ultrasonic)", "MT (Magnetic Particle)", "PT (Dye Penetrant)", "RT (Radiographic)"];

export default function WeldLogPage() {
  const { selectedProjectId } = useGlobalProject();
  const weldQuery = selectedProjectId
    ? { order_by: "inspection_date", dir: "desc", project_id: selectedProjectId }
    : { order_by: "inspection_date", dir: "desc" };
  const list = useResourceList<Weld>("weld_inspections", weldQuery);
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const parts = useResourceList<Part>("parts", selectedProjectId ? { limit: "200", project_id: selectedProjectId } : { limit: "200" });
  const create = useCreate<Weld>("weld_inspections");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<Weld>[] = [
    { key: "wno", label: "Weld #", mono: true, render: (r) => r.weld_number },
    { key: "date", label: "Date", render: (r) => new Date(r.inspection_date).toLocaleDateString() },
    { key: "joint", label: "Joint", render: (r) => r.joint_type },
    { key: "proc", label: "Process", render: (r) => r.weld_process },
    { key: "filler", label: "Filler", mono: true, render: (r) => r.filler_metal },
    { key: "method", label: "Method", render: (r) => r.inspection_method },
    { key: "cwi", label: "CWI", mono: true, render: (r) => r.cwi_reference ?? "—" },
    { key: "insp", label: "Inspector", render: (r) => r.inspector_name },
    { key: "result", label: "Result", render: (r) => <StatusPill status={r.result} /> },
  ];

  return (
    <PageWrapper title="AWS Weld Log">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>AWS D1.1 Weld Log</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>CWI-signed visual/UT/MT/PT records</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> Log weld</button>
      </div>

      <DataTable
        data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No weld inspections yet" }}
        rowKey={(r) => r.id}
      />

      {showNew && (
        <NewModal projects={projects.data ?? []} parts={parts.data ?? []}
          onClose={() => setShowNew(false)}
          onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending}
          error={create.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function NewModal({ projects, parts, onClose, onSubmit, submitting, error }: {
  projects: Project[]; parts: Part[];
  onClose: () => void; onSubmit: (p: Record<string, unknown>) => void;
  submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({
    project_id: projects[0]?.id ?? "", part_id: "",
    joint_type: "Fillet", fillet_size: "",
    weld_process: "FCAW / E71T-1", filler_metal: "",
    inspection_method: "VT (Visual)", cwi_reference: "",
    inspector_name: "", result: "pass", aws_d11_reference: "", notes: "",
  });
  return (
    <ResourceModal title="Log weld inspection" submitLabel="Submit"
      onClose={onClose} submitting={submitting} error={error} width={580}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: f.project_id || undefined,
          part_id: f.part_id || undefined,
          joint_type: f.joint_type,
          fillet_size: f.fillet_size || undefined,
          weld_process: f.weld_process,
          filler_metal: f.filler_metal,
          inspection_method: f.inspection_method,
          cwi_reference: f.cwi_reference || undefined,
          inspector_name: f.inspector_name,
          result: f.result,
          aws_d11_reference: f.aws_d11_reference || undefined,
          notes: f.notes || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Project"><select className="input" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
          <option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Part"><select className="input" value={f.part_id} onChange={(e) => setF({ ...f, part_id: e.target.value })}>
          <option value="">—</option>{parts.map((p) => <option key={p.id} value={p.id}>{p.part_mark}</option>)}</select></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Joint type" required>
          <select className="input" required value={f.joint_type} onChange={(e) => setF({ ...f, joint_type: e.target.value })}>
            {JOINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Fillet size">
          <input className="input" value={f.fillet_size} onChange={(e) => setF({ ...f, fillet_size: e.target.value })} placeholder='5/16"' />
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Process" required>
          <select className="input" required value={f.weld_process} onChange={(e) => setF({ ...f, weld_process: e.target.value })}>
            {PROCESSES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Filler metal" required>
          <input className="input" required value={f.filler_metal} onChange={(e) => setF({ ...f, filler_metal: e.target.value })} placeholder="E71T-1 / 0.045in" />
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Inspection method" required>
          <select className="input" required value={f.inspection_method} onChange={(e) => setF({ ...f, inspection_method: e.target.value })}>
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="CWI reference">
          <input className="input" value={f.cwi_reference} onChange={(e) => setF({ ...f, cwi_reference: e.target.value })} placeholder="AWS-CWI-23145" />
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Inspector name" required>
          <input className="input" required value={f.inspector_name} onChange={(e) => setF({ ...f, inspector_name: e.target.value })} />
        </Field>
        <Field label="Result" required>
          <select className="input" required value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}>
            <option value="pass">Pass</option>
            <option value="fail">Fail (NCR auto-created)</option>
            <option value="hold">Hold</option>
          </select>
        </Field>
      </div>
      <Field label="AWS D1.1 §"><input className="input" value={f.aws_d11_reference} onChange={(e) => setF({ ...f, aws_d11_reference: e.target.value })} placeholder="§6.5" /></Field>
      <Field label="Notes"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} /></Field>
    </ResourceModal>
  );
}
