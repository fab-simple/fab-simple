"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus } from "lucide-react";

interface PO {
  id: string; po_number: string; vendor: string; total_amount: number;
  status: string; issued_date: string | null; expected_date: string | null;
  qty_ordered: number | null; qty_received: number; project_id: string | null;
}
interface Project { id: string; name: string; }

const STATUSES = ["draft", "issued", "partial", "received", "closed"];

export default function PurchaseOrdersPage() {
  const list = useResourceList<PO>("purchase_orders", { order_by: "created_at", dir: "desc" });
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<PO>("purchase_orders");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<PO>[] = [
    { key: "num", label: "PO #", mono: true, render: (r) => <strong>{r.po_number}</strong> },
    { key: "vendor", label: "Vendor", render: (r) => r.vendor },
    { key: "amount", label: "Amount", align: "right", mono: true, render: (r) => `$${Number(r.total_amount).toLocaleString()}` },
    { key: "issued", label: "Issued", render: (r) => r.issued_date ? new Date(r.issued_date).toLocaleDateString() : "—" },
    { key: "expected", label: "Expected", render: (r) => r.expected_date ? new Date(r.expected_date).toLocaleDateString() : "—" },
    { key: "qty", label: "Qty (rcv/ord)", align: "right", mono: true, render: (r) => `${r.qty_received ?? 0} / ${r.qty_ordered ?? 0}` },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  const totalOpen = (list.data ?? []).filter((p) => p.status !== "closed").reduce((s, p) => s + Number(p.total_amount ?? 0), 0);

  return (
    <PageWrapper title="Purchase Orders">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Purchase Orders</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{list.data?.length ?? 0} POs · ${totalOpen.toLocaleString()} open commitments</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New PO</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No purchase orders yet" }} rowKey={(r) => r.id} />

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
    project_id: "", vendor: "", total_amount: "", qty_ordered: "", status: "draft",
    issued_date: "", expected_date: "", notes: "",
  });
  return (
    <ResourceModal title="New purchase order" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: f.project_id || undefined,
          vendor: f.vendor, total_amount: Number(f.total_amount || 0),
          qty_ordered: f.qty_ordered ? Number(f.qty_ordered) : undefined,
          status: f.status, issued_date: f.issued_date || undefined,
          expected_date: f.expected_date || undefined,
          notes: f.notes || undefined,
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
        <Field label="Vendor" required>
          <input className="input" required value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} placeholder="Triple S Steel" />
        </Field>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Amount ($)" required>
          <input className="input" type="number" step="0.01" required value={f.total_amount} onChange={(e) => setF({ ...f, total_amount: e.target.value })} />
        </Field>
        <Field label="Qty ordered"><input className="input" type="number" step="0.01" value={f.qty_ordered} onChange={(e) => setF({ ...f, qty_ordered: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Issued date"><input className="input" type="date" value={f.issued_date} onChange={(e) => setF({ ...f, issued_date: e.target.value })} /></Field>
        <Field label="Expected date"><input className="input" type="date" value={f.expected_date} onChange={(e) => setF({ ...f, expected_date: e.target.value })} /></Field>
      </div>
      <Field label="Notes">
        <textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
      </Field>
    </ResourceModal>
  );
}
