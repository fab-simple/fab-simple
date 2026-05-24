"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus } from "lucide-react";

interface Heat {
  id: string; heat_number: string; material_grade: string;
  mill_name: string | null; supplier: string | null;
  mtr_status: string; receipt_number: string | null; parts_count: number;
}

const MTR_STATUSES = ["pending", "received", "verified"];

export default function HeatNumbersPage() {
  const list = useResourceList<Heat>("heat_numbers", { order_by: "heat_number", dir: "desc" });
  const create = useCreate<Heat>("heat_numbers");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<Heat>[] = [
    { key: "heat", label: "Heat #", mono: true, render: (r) => <strong>{r.heat_number}</strong> },
    { key: "grade", label: "Material Grade", render: (r) => r.material_grade },
    { key: "mill", label: "Mill", render: (r) => r.mill_name ?? "—" },
    { key: "supplier", label: "Supplier", render: (r) => r.supplier ?? "—" },
    { key: "rcpt", label: "Receipt #", mono: true, render: (r) => r.receipt_number ?? "—" },
    { key: "parts", label: "Parts", align: "right", mono: true, render: (r) => r.parts_count },
    { key: "mtr", label: "MTR Status", render: (r) => <StatusPill status={r.mtr_status} /> },
  ];

  return (
    <PageWrapper title="Heat Numbers">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Heat Number Traceability</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>Mill test reports linked to each material batch</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New heat</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No heat numbers tracked yet" }} rowKey={(r) => r.id} />

      {showNew && (
        <NewModal onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function NewModal({ onClose, onSubmit, submitting, error }: {
  onClose: () => void; onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({ heat_number: "", material_grade: "A992", mill_name: "", supplier: "", mtr_status: "pending", receipt_number: "" });
  return (
    <ResourceModal title="New heat number" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          heat_number: f.heat_number, material_grade: f.material_grade,
          mill_name: f.mill_name || undefined, supplier: f.supplier || undefined,
          mtr_status: f.mtr_status, receipt_number: f.receipt_number || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Heat #" required><input className="input" required value={f.heat_number} onChange={(e) => setF({ ...f, heat_number: e.target.value })} placeholder="HT-23845" /></Field>
        <Field label="Material grade" required><input className="input" required value={f.material_grade} onChange={(e) => setF({ ...f, material_grade: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Mill"><input className="input" value={f.mill_name} onChange={(e) => setF({ ...f, mill_name: e.target.value })} placeholder="Nucor Steel" /></Field>
        <Field label="Supplier"><input className="input" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} placeholder="Triple S Steel" /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="MTR status">
          <select className="input" value={f.mtr_status} onChange={(e) => setF({ ...f, mtr_status: e.target.value })}>
            {MTR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Receipt #"><input className="input" value={f.receipt_number} onChange={(e) => setF({ ...f, receipt_number: e.target.value })} /></Field>
      </div>
    </ResourceModal>
  );
}
