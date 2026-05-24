"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Inv {
  id: string; profile: string; grade: string | null; quantity: number;
  location: string | null; reorder_point: number; max_stock: number | null;
  unit_cost: number | null; status: string;
}

export default function InventoryPage() {
  const list = useResourceList<Inv>("inventory", { order_by: "profile", dir: "asc" });
  const create = useCreate<Inv>("inventory");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<Inv>[] = [
    { key: "profile", label: "Profile", mono: true, render: (r) => <strong>{r.profile}</strong> },
    { key: "grade", label: "Grade", render: (r) => r.grade ?? "—" },
    { key: "qty", label: "Quantity", align: "right", mono: true, render: (r) => Number(r.quantity).toFixed(0) },
    { key: "reorder", label: "Reorder Pt", align: "right", mono: true, render: (r) => r.reorder_point },
    { key: "max", label: "Max", align: "right", mono: true, render: (r) => r.max_stock ?? "—" },
    { key: "loc", label: "Location", render: (r) => r.location ?? "—" },
    { key: "cost", label: "Unit cost", align: "right", mono: true, render: (r) => r.unit_cost ? `$${Number(r.unit_cost).toLocaleString()}` : "—" },
    {
      key: "status", label: "Status", render: (r) => {
        if (r.status === "out") return <span className="pill pill-red" style={{ padding: "2px 8px" }}>Out</span>;
        if (r.status === "low") return <span className="pill pill-warn" style={{ padding: "2px 8px" }}><AlertTriangle size={10} /> Low</span>;
        return <span className="pill pill-done" style={{ padding: "2px 8px" }}><CheckCircle2 size={10} /> OK</span>;
      }
    },
  ];

  const lowCount = (list.data ?? []).filter((r) => r.status === "low").length;
  const outCount = (list.data ?? []).filter((r) => r.status === "out").length;
  const totalValue = (list.data ?? []).reduce((s, r) => s + (Number(r.quantity) * Number(r.unit_cost ?? 0)), 0);

  return (
    <PageWrapper title="Inventory">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Inventory</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {list.data?.length ?? 0} SKUs · {lowCount} low · {outCount} out · ${totalValue.toLocaleString()} on hand
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New SKU</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No inventory items yet" }} rowKey={(r) => r.id} />

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
  const [f, setF] = useState({ profile: "", grade: "A992", quantity: "0", reorder_point: "0", max_stock: "", unit_cost: "", location: "" });
  return (
    <ResourceModal title="New inventory SKU" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          profile: f.profile, grade: f.grade || undefined,
          quantity: Number(f.quantity),
          reorder_point: Number(f.reorder_point),
          max_stock: f.max_stock ? Number(f.max_stock) : undefined,
          unit_cost: f.unit_cost ? Number(f.unit_cost) : undefined,
          location: f.location || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Profile" required><input className="input" required value={f.profile} onChange={(e) => setF({ ...f, profile: e.target.value })} placeholder="W14x82" /></Field>
        <Field label="Grade"><input className="input" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} /></Field>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Qty on hand"><input className="input" type="number" min="0" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
        <Field label="Reorder pt"><input className="input" type="number" min="0" value={f.reorder_point} onChange={(e) => setF({ ...f, reorder_point: e.target.value })} /></Field>
        <Field label="Max stock"><input className="input" type="number" min="0" value={f.max_stock} onChange={(e) => setF({ ...f, max_stock: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Unit cost ($)"><input className="input" type="number" step="0.01" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} /></Field>
        <Field label="Location"><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Bay 1" /></Field>
      </div>
    </ResourceModal>
  );
}

