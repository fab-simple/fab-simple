"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus } from "lucide-react";

interface Ship {
  id: string; ticket_number: string; load_number: string | null;
  truck_number: string | null; carrier: string | null; driver_name: string | null;
  ship_date: string; destination: string | null; total_pieces: number;
  total_weight: number | null; status: string; project_id: string | null;
}
interface Project { id: string; name: string; }

const STATUSES = ["pending", "loaded", "in_transit", "delivered"];

export default function ShippingPage() {
  const list = useResourceList<Ship>("shipping_tickets", { order_by: "ship_date", dir: "desc" });
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<Ship>("shipping_tickets");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<Ship>[] = [
    { key: "tkt", label: "Ticket #", mono: true, render: (r) => <strong>{r.ticket_number}</strong> },
    { key: "load", label: "Load #", mono: true, render: (r) => r.load_number ?? "—" },
    { key: "truck", label: "Truck", mono: true, render: (r) => r.truck_number ?? "—" },
    { key: "carrier", label: "Carrier", render: (r) => r.carrier ?? "—" },
    { key: "ship", label: "Ship date", render: (r) => new Date(r.ship_date).toLocaleDateString() },
    { key: "dest", label: "Destination", render: (r) => r.destination ?? "—" },
    { key: "pcs", label: "Pieces", align: "right", mono: true, render: (r) => r.total_pieces },
    { key: "wt", label: "Weight", align: "right", mono: true, render: (r) => r.total_weight ? `${Number(r.total_weight).toLocaleString()} lb` : "—" },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageWrapper title="Shipping Tickets">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Shipping Tickets</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>BOL-ready load tickets and dispatch summaries</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New ticket</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No shipping tickets yet" }} rowKey={(r) => r.id} />

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
    project_id: "", load_number: "", truck_number: "", carrier: "", driver_name: "",
    ship_date: new Date().toISOString().slice(0, 10), destination: "",
    total_pieces: "0", total_weight: "", status: "pending",
  });
  return (
    <ResourceModal title="New shipping ticket" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: f.project_id || undefined,
          load_number: f.load_number || undefined,
          truck_number: f.truck_number || undefined,
          carrier: f.carrier || undefined,
          driver_name: f.driver_name || undefined,
          ship_date: f.ship_date, destination: f.destination || undefined,
          total_pieces: Number(f.total_pieces),
          total_weight: f.total_weight ? Number(f.total_weight) : undefined,
          status: f.status, parts: [],
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
        <Field label="Load #"><input className="input" value={f.load_number} onChange={(e) => setF({ ...f, load_number: e.target.value })} /></Field>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Truck #"><input className="input" value={f.truck_number} onChange={(e) => setF({ ...f, truck_number: e.target.value })} /></Field>
        <Field label="Carrier"><input className="input" value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} /></Field>
        <Field label="Driver"><input className="input" value={f.driver_name} onChange={(e) => setF({ ...f, driver_name: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Ship date" required><input className="input" type="date" required value={f.ship_date} onChange={(e) => setF({ ...f, ship_date: e.target.value })} /></Field>
        <Field label="Destination"><input className="input" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} placeholder="Dallas TX jobsite" /></Field>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Pieces"><input className="input" type="number" min="0" value={f.total_pieces} onChange={(e) => setF({ ...f, total_pieces: e.target.value })} /></Field>
        <Field label="Weight (lb)"><input className="input" type="number" step="0.01" value={f.total_weight} onChange={(e) => setF({ ...f, total_weight: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
    </ResourceModal>
  );
}
