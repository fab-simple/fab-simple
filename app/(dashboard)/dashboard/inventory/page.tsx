"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate, useUpdate } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { Plus, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface Inv {
  id: string; profile: string; grade: string | null; quantity: number;
  location: string | null; reorder_point: number; max_stock: number | null;
  unit_cost: number | null; status: string;
}
interface Lot {
  id: string; lot_number: string; profile: string; grade: string; quantity: number;
  original_quantity: number; length: number | null; location: string | null;
  status: string; heat_number_id: string;
}
interface Heat { id: string; heat_number: string; status: string; }

type Tab = "bulk" | "lots";

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("bulk");

  return (
    <PageWrapper title="Inventory">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Inventory</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Bulk Stock is shared, non-traceable material. Traceable Lots carry Material + Grade + Heat + Lot
            provenance for structural steel — see the Procurement &amp; Material Traceability spec.
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b" style={{ borderColor: "var(--border)" }}>
        <TabButton active={tab === "bulk"} onClick={() => setTab("bulk")}>Bulk Stock</TabButton>
        <TabButton active={tab === "lots"} onClick={() => setTab("lots")}>Traceable Lots</TabButton>
      </div>

      {tab === "bulk" ? <BulkStockTab /> : <TraceableLotsTab />}
    </PageWrapper>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-[13px] font-medium"
      style={{
        color: active ? "var(--primary)" : "var(--muted)",
        borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
        background: "transparent",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function BulkStockTab() {
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
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          {list.data?.length ?? 0} SKUs · {lowCount} low · {outCount} out · ${totalValue.toLocaleString()} on hand
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New SKU</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No inventory items yet" }} rowKey={(r) => r.id} />

      {showNew && (
        <NewSkuModal onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}
    </>
  );
}

function NewSkuModal({ onClose, onSubmit, submitting, error }: {
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

// Traceable Lots — Material + Grade + Heat + Lot. Filters by the Global
// Project Context (unlike Bulk Stock, which is company-wide) since a lot's
// project comes from the PO/receiving it was cut from. See spec §5/§13 D2.
function TraceableLotsTab() {
  const { selectedProjectId, selectedProjectName } = useGlobalProject();
  const list = useResourceList<Lot>("material_lots", selectedProjectId
    ? { project_id: selectedProjectId, order_by: "created_at", dir: "desc", limit: "200" }
    : { order_by: "created_at", dir: "desc", limit: "200" });
  const heats = useResourceList<Heat>("heat_numbers", { limit: "500" });
  const update = useUpdate<Lot>("material_lots");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const heatLookup = new Map((heats.data ?? []).map((h) => [h.id, h]));

  const cols: Column<Lot>[] = [
    { key: "lot", label: "Lot #", mono: true, render: (r) => <strong>{r.lot_number}</strong> },
    { key: "profile", label: "Profile", mono: true, render: (r) => r.profile },
    { key: "grade", label: "Grade", render: (r) => r.grade },
    {
      key: "heat", label: "Heat", mono: true, render: (r) => {
        const h = heatLookup.get(r.heat_number_id);
        if (!h) return r.heat_number_id.slice(0, 8);
        return <span>{h.heat_number} {h.status === "quarantine" && <span className="pill pill-danger" style={{ padding: "1px 6px", marginLeft: 4, fontSize: 10 }}>Quarantine</span>}</span>;
      },
    },
    { key: "qty", label: "Remaining", align: "right", mono: true, render: (r) => `${r.quantity} / ${r.original_quantity}` },
    { key: "len", label: "Length", align: "right", mono: true, render: (r) => r.length ?? "—" },
    { key: "loc", label: "Location", render: (r) => r.location ?? "—" },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action", label: "", render: (r) => {
        const heat = heatLookup.get(r.heat_number_id);
        const quarantined = heat?.status === "quarantine";
        if (r.status === "available") {
          return (
            <button
              className="btn btn-sm"
              disabled={quarantined || (update.isPending && pendingId === r.id)}
              title={quarantined ? "Blocked — heat is quarantined pending MTR verification" : "Reserve for production"}
              onClick={() => { setPendingId(r.id); update.mutate({ id: r.id, body: { status: "reserved" } }, { onSettled: () => setPendingId(null) }); }}
            >
              {update.isPending && pendingId === r.id ? <Loader2 size={12} className="animate-spin" /> : null}
              Reserve
            </button>
          );
        }
        if (r.status === "reserved") {
          return (
            <button
              className="btn btn-sm"
              disabled={update.isPending && pendingId === r.id}
              onClick={() => { setPendingId(r.id); update.mutate({ id: r.id, body: { status: "available" } }, { onSettled: () => setPendingId(null) }); }}
            >
              {update.isPending && pendingId === r.id ? <Loader2 size={12} className="animate-spin" /> : null}
              Release
            </button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          {selectedProjectId
            ? `${list.data?.length ?? 0} lots for ${selectedProjectName ?? "this project"}`
            : `${list.data?.length ?? 0} lots across all projects`}
          {" · created by assigning a heat to a bundle (Bundles page), not manually"}
        </div>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No traceable lots yet", subtitle: "Register a bundle and assign it a heat number to create one." }} rowKey={(r) => r.id} />
    </>
  );
}
