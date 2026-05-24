"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { FabAPI } from "@/lib/api";
import { Plus, Wand2 } from "lucide-react";

interface Estimate {
  id: string; estimate_number: string; project_name: string; gc_name: string | null;
  status: string; total_amount: number; bid_per_ton: number | null; structural_tons: number | null;
  margin_pct: number | null; bid_due_date: string | null; created_at: string;
}

const STATUSES = ["draft", "submitted", "won", "lost"];

export default function EstimatingPage() {
  const list = useResourceList<Estimate>("estimates", { order_by: "created_at", dir: "desc" });
  const create = useCreate<Estimate>("estimates");
  const [showNew, setShowNew] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  async function convert(id: string) {
    setConverting(id);
    try {
      await FabAPI.convertEstimate({ estimate_id: id });
      list.refetch();
    } finally { setConverting(null); }
  }

  const cols: Column<Estimate>[] = [
    { key: "num", label: "Est #", mono: true, render: (r) => <strong>{r.estimate_number}</strong> },
    { key: "name", label: "Project", render: (r) => r.project_name },
    { key: "gc", label: "GC", render: (r) => r.gc_name ?? "—" },
    { key: "tons", label: "Tons", align: "right", mono: true, render: (r) => r.structural_tons ?? "—" },
    { key: "ton$", label: "$/ton", align: "right", mono: true, render: (r) => r.bid_per_ton ? `$${Number(r.bid_per_ton).toLocaleString()}` : "—" },
    { key: "total", label: "Total bid", align: "right", mono: true, render: (r) => `$${Number(r.total_amount ?? 0).toLocaleString()}` },
    { key: "margin", label: "Margin", align: "right", mono: true, render: (r) => r.margin_pct ? `${r.margin_pct}%` : "—" },
    { key: "due", label: "Bid due", render: (r) => r.bid_due_date ? new Date(r.bid_due_date).toLocaleDateString() : "—" },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action", label: "", render: (r) => r.status === "won" ? (
        <button className="btn btn-sm btn-primary" disabled={converting === r.id} onClick={(e) => { e.stopPropagation(); convert(r.id); }}>
          <Wand2 size={11} /> Convert
        </button>
      ) : null,
    },
  ];

  return (
    <PageWrapper title="Estimating">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Estimating</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>Steel bids · won estimates convert to projects automatically</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New estimate</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No estimates yet" }} rowKey={(r) => r.id} />

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
  onClose: () => void; onSubmit: (p: Record<string, unknown>) => void;
  submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({
    project_name: "", gc_name: "", structural_tons: "", bid_per_ton: "",
    margin_pct: "15", total_amount: "", bid_due_date: "", status: "draft", notes: "",
  });
  return (
    <ResourceModal title="New estimate" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        const tons = Number(f.structural_tons || 0);
        const perTon = Number(f.bid_per_ton || 0);
        const computedTotal = tons * perTon;
        onSubmit({
          project_name: f.project_name, gc_name: f.gc_name || undefined,
          structural_tons: tons || undefined,
          bid_per_ton: perTon || undefined,
          margin_pct: f.margin_pct ? Number(f.margin_pct) : undefined,
          total_amount: f.total_amount ? Number(f.total_amount) : computedTotal,
          bid_due_date: f.bid_due_date || undefined,
          status: f.status, notes: f.notes || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Project name" required><input className="input" required value={f.project_name} onChange={(e) => setF({ ...f, project_name: e.target.value })} /></Field>
        <Field label="GC name"><input className="input" value={f.gc_name} onChange={(e) => setF({ ...f, gc_name: e.target.value })} /></Field>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Structural tons"><input className="input" type="number" step="0.1" value={f.structural_tons} onChange={(e) => setF({ ...f, structural_tons: e.target.value })} /></Field>
        <Field label="$ / ton"><input className="input" type="number" step="0.01" value={f.bid_per_ton} onChange={(e) => setF({ ...f, bid_per_ton: e.target.value })} /></Field>
        <Field label="Margin %"><input className="input" type="number" step="0.01" value={f.margin_pct} onChange={(e) => setF({ ...f, margin_pct: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Total override ($)" hint="leave blank to auto-calculate"><input className="input" type="number" step="0.01" value={f.total_amount} onChange={(e) => setF({ ...f, total_amount: e.target.value })} /></Field>
        <Field label="Bid due"><input className="input" type="date" value={f.bid_due_date} onChange={(e) => setF({ ...f, bid_due_date: e.target.value })} /></Field>
      </div>
      <Field label="Status">
        <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Notes"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} /></Field>
    </ResourceModal>
  );
}
