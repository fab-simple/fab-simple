"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate, useAssignHeatToBundle } from "@/hooks/useResource";
import { Plus, FlameKindling, Loader2, X } from "lucide-react";

interface Bundle {
  id: string; bundle_number: string; receiving_id: string; quantity: number;
  storage_location: string | null; heat_number_id: string | null;
}
interface Receiving {
  id: string; receiving_number: string; po_id: string; qty_received: number;
}
interface PO { id: string; po_number: string; vendor: string; }
interface Heat { id: string; heat_number: string; material_grade: string; status: string; }

export default function BundlesPage() {
  return (
    // useSearchParams requires a Suspense boundary in the App Router.
    <Suspense fallback={null}>
      <BundlesPageInner />
    </Suspense>
  );
}

function BundlesPageInner() {
  const searchParams = useSearchParams();
  const preselectedReceiving = searchParams.get("receiving");

  // Bundles are company-wide — not filtered by the Global Project Context
  // (§16: procurement is decoupled from projects; a project only ever holds
  // a reservation against the material lots that come out of a bundle).
  const list = useResourceList<Bundle>("bundles", { order_by: "created_at", dir: "desc" });
  const receivings = useResourceList<Receiving>("receivings", { order_by: "created_at", dir: "desc", limit: "100" });
  const pos = useResourceList<PO>("purchase_orders", { limit: "200" });
  const create = useCreate<Bundle>("bundles");

  const [showNew, setShowNew] = useState(!!preselectedReceiving);
  const [heatTarget, setHeatTarget] = useState<Bundle | null>(null);

  const receivingLookup = new Map((receivings.data ?? []).map((r) => [r.id, r]));
  const poLookup = new Map((pos.data ?? []).map((p) => [p.id, p]));

  const cols: Column<Bundle>[] = [
    { key: "num", label: "Bundle #", mono: true, render: (r) => <strong>{r.bundle_number}</strong> },
    {
      key: "receiving", label: "Receiving", render: (r) => {
        const rec = receivingLookup.get(r.receiving_id);
        const po = rec ? poLookup.get(rec.po_id) : undefined;
        return (
          <span className="font-mono text-[12px]">
            {rec?.receiving_number ?? r.receiving_id.slice(0, 8)}
            {po && <span style={{ color: "var(--muted)" }}> · {po.po_number}</span>}
          </span>
        );
      },
    },
    { key: "qty", label: "Qty", align: "right", mono: true, render: (r) => r.quantity },
    { key: "loc", label: "Storage location", render: (r) => r.storage_location ?? "—" },
    {
      key: "heat", label: "Heat", render: (r) => (
        r.heat_number_id
          ? <StatusPill status="assigned" label="Heat assigned" />
          : <span className="pill pill-warn" style={{ padding: "2px 8px" }}>No heat</span>
      ),
    },
    {
      key: "action", label: "", render: (r) => (
        r.heat_number_id ? null : (
          <button className="btn btn-sm btn-primary" onClick={() => setHeatTarget(r)}>
            <FlameKindling size={12} /> Assign heat
          </button>
        )
      ),
    },
  ];

  const unassignedCount = (list.data ?? []).filter((b) => !b.heat_number_id).length;

  return (
    <PageWrapper title="Bundles">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Bundles</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {list.data?.length ?? 0} bundles
            {unassignedCount > 0 && <span style={{ color: "#D97706", marginLeft: 8 }}>· {unassignedCount} missing heat assignment</span>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)} disabled={receivings.data?.length === 0}>
          <Plus size={14} /> New bundle
        </button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No bundles yet", subtitle: "Register a bundle against a receiving to start heat/lot traceability." }} rowKey={(r) => r.id} />

      {showNew && (
        <NewBundleModal
          receivings={receivings.data ?? []}
          poLookup={poLookup}
          preselectedReceivingId={preselectedReceiving}
          onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending}
          error={create.error?.message ?? null}
        />
      )}

      {heatTarget && (
        <AssignHeatModal
          bundle={heatTarget}
          onClose={() => setHeatTarget(null)}
        />
      )}
    </PageWrapper>
  );
}

function NewBundleModal({
  receivings, poLookup, preselectedReceivingId, onClose, onSubmit, submitting, error,
}: {
  receivings: Receiving[]; poLookup: Map<string, PO>; preselectedReceivingId: string | null;
  onClose: () => void; onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({
    receiving_id: preselectedReceivingId ?? receivings[0]?.id ?? "",
    quantity: "1", storage_location: "",
  });
  return (
    <ResourceModal title="Register bundle" onClose={onClose} submitting={submitting} error={error}
      submitDisabled={!f.receiving_id}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          receiving_id: f.receiving_id,
          quantity: Number(f.quantity),
          storage_location: f.storage_location || undefined,
        });
      }}
    >
      <Field label="Receiving" required>
        <select className="input" required value={f.receiving_id} onChange={(e) => setF({ ...f, receiving_id: e.target.value })}>
          <option value="">—</option>
          {receivings.map((r) => (
            <option key={r.id} value={r.id}>
              {r.receiving_number} · {poLookup.get(r.po_id)?.po_number ?? r.po_id.slice(0, 8)} · {r.qty_received} pcs
            </option>
          ))}
        </select>
      </Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Quantity in this bundle" required>
          <input className="input" type="number" min={1} step="1" required value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
        </Field>
        <Field label="Storage location">
          <input className="input" value={f.storage_location} onChange={(e) => setF({ ...f, storage_location: e.target.value })} placeholder="Bay 3, Rack B" />
        </Field>
      </div>
    </ResourceModal>
  );
}

function AssignHeatModal({ bundle, onClose }: {
  bundle: Bundle; onClose: () => void;
}) {
  const heats = useResourceList<Heat>("heat_numbers", { order_by: "heat_number", dir: "desc", limit: "200" });
  const createHeat = useCreate<Heat>("heat_numbers");
  const assignHeat = useAssignHeatToBundle();

  const [f, setF] = useState({ heat_number: "", profile: "", grade: "", length: "", location: bundle.storage_location ?? "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingHeats = heats.data;
  const matchedHeat = useMemo(
    () => (existingHeats ?? []).find((h) => h.heat_number.trim().toLowerCase() === f.heat_number.trim().toLowerCase()),
    [existingHeats, f.heat_number],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.heat_number.trim() || !f.profile.trim() || !f.grade.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      let heatNumberId = matchedHeat?.id;
      if (!heatNumberId) {
        const created = await createHeat.mutateAsync({
          heat_number: f.heat_number.trim(),
          material_grade: f.grade.trim(),
        });
        heatNumberId = created.id;
      }

      await assignHeat.mutateAsync({
        bundleId: bundle.id,
        body: {
          heat_number_id: heatNumberId,
          profile: f.profile.trim(),
          grade: f.grade.trim(),
          length: f.length ? Number(f.length) : undefined,
          location: f.location || undefined,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign heat");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }}>
      <div className="card" style={{ width: 460 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Assign heat</div>
            <div className="card-sub font-mono">{bundle.bundle_number}</div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>
        <form className="card-body" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Heat number" required hint={matchedHeat ? `Matches existing heat (${matchedHeat.status})` : "New heat number — will be created"}>
            <input
              className="input" required list="heat-suggestions" value={f.heat_number}
              onChange={(e) => setF({ ...f, heat_number: e.target.value })}
              placeholder="HT-23845"
            />
            <datalist id="heat-suggestions">
              {(existingHeats ?? []).map((h) => <option key={h.id} value={h.heat_number} />)}
            </datalist>
          </Field>
          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Profile" required><input className="input" required value={f.profile} onChange={(e) => setF({ ...f, profile: e.target.value })} placeholder="W14x82" /></Field>
            <Field label="Grade" required><input className="input" required value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} placeholder="A992" /></Field>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Length (ft)"><input className="input" type="number" step="0.01" value={f.length} onChange={(e) => setF({ ...f, length: e.target.value })} /></Field>
            <Field label="Lot location"><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
          </div>

          {error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}

          <div className="flex justify-end gap-2 mt-1">
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <FlameKindling size={14} />}
              {submitting ? "Assigning…" : "Assign heat & create lot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
