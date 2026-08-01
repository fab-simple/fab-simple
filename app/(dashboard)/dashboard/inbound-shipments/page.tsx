"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { AttachmentsDrawer } from "@/components/ui/AttachmentsDrawer";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus, Paperclip } from "lucide-react";

interface InboundShipment {
  id: string; shipment_number: string; po_id: string; truck_number: string | null;
  carrier: string | null; bill_of_lading: string | null; status: string;
  scheduled_date: string | null; shipped_date: string | null; arrived_date: string | null;
}
interface PO { id: string; po_number: string; vendor: string; status: string; }

const STATUSES = ["scheduled", "shipped", "in_transit", "arrived", "received"];

export default function InboundShipmentsPage() {
  const list = useResourceList<InboundShipment>("inbound_shipments", { order_by: "created_at", dir: "desc" });
  // Company-wide — not filtered by the Global Project Context (§16). A
  // shipment always belongs to one PO, but that PO's project (if any) is
  // purely informational and never restricts which POs show up here.
  const openPos = useResourceList<PO>("purchase_orders", { status__in: "issued,partial", limit: "100" });
  const create = useCreate<InboundShipment>("inbound_shipments");
  const [showNew, setShowNew] = useState(false);
  const [attachTarget, setAttachTarget] = useState<InboundShipment | null>(null);

  const poLookup = new Map((openPos.data ?? []).map((p) => [p.id, p]));

  const cols: Column<InboundShipment>[] = [
    { key: "num", label: "Shipment #", mono: true, render: (r) => <strong>{r.shipment_number}</strong> },
    { key: "po", label: "PO", mono: true, render: (r) => poLookup.get(r.po_id)?.po_number ?? r.po_id.slice(0, 8) },
    { key: "truck", label: "Truck / Carrier", render: (r) => [r.truck_number, r.carrier].filter(Boolean).join(" · ") || "—" },
    { key: "bol", label: "BOL #", mono: true, render: (r) => r.bill_of_lading ?? "—" },
    { key: "scheduled", label: "Scheduled", render: (r) => r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : "—" },
    { key: "arrived", label: "Arrived", render: (r) => r.arrived_date ? new Date(r.arrived_date).toLocaleDateString() : "—" },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action", label: "", render: (r) => (
        <button className="btn btn-sm" title="Attach BOL / packing list" onClick={() => setAttachTarget(r)}>
          <Paperclip size={12} />
        </button>
      ),
    },
  ];

  return (
    <PageWrapper title="Inbound Shipments">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Inbound Shipments</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>Vendor → shop shipment tracking, separate from outbound Shipping Tickets</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)} disabled={openPos.data?.length === 0}>
          <Plus size={14} /> New shipment
        </button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No inbound shipments yet" }} rowKey={(r) => r.id} />

      {showNew && (
        <NewModal pos={openPos.data ?? []} onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}

      <AttachmentsDrawer
        open={!!attachTarget}
        onClose={() => setAttachTarget(null)}
        entityType="inbound_shipments"
        entityId={attachTarget?.id ?? ""}
        bucket="mtrs"
        title={`BOL / Packing list — ${attachTarget?.shipment_number ?? ""}`}
        accept=".pdf,application/pdf,image/*"
      />
    </PageWrapper>
  );
}

function NewModal({ pos, onClose, onSubmit, submitting, error }: {
  pos: PO[]; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({
    po_id: pos[0]?.id ?? "", truck_number: "", carrier: "", bill_of_lading: "",
    status: "scheduled", scheduled_date: "",
  });
  return (
    <ResourceModal title="New inbound shipment" onClose={onClose} submitting={submitting} error={error}
      submitDisabled={!f.po_id}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          po_id: f.po_id, truck_number: f.truck_number || undefined,
          carrier: f.carrier || undefined, bill_of_lading: f.bill_of_lading || undefined,
          status: f.status, scheduled_date: f.scheduled_date || undefined,
        });
      }}
    >
      <Field label="Purchase order" required>
        <select className="input" required value={f.po_id} onChange={(e) => setF({ ...f, po_id: e.target.value })}>
          <option value="">—</option>
          {pos.map((p) => <option key={p.id} value={p.id}>{p.po_number} · {p.vendor}</option>)}
        </select>
      </Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Truck #"><input className="input" value={f.truck_number} onChange={(e) => setF({ ...f, truck_number: e.target.value })} /></Field>
        <Field label="Carrier"><input className="input" value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Bill of lading #"><input className="input" value={f.bill_of_lading} onChange={(e) => setF({ ...f, bill_of_lading: e.target.value })} /></Field>
        <Field label="Scheduled date"><input className="input" type="date" value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></Field>
      </div>
      <Field label="Status">
        <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
    </ResourceModal>
  );
}
