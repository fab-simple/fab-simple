"use client";

import { useState, useMemo } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate, useReserveLot, useReleaseLotReservation, useIssueMaterial } from "@/hooks/useResource";
import type { LotReservation } from "@/lib/api";
import { Plus, AlertTriangle, CheckCircle2, Loader2, X, Zap } from "lucide-react";

interface Inv {
  id: string; profile: string; name: string | null; grade: string | null;
  length: string | null; quantity: number;
  location: string | null; reorder_point: number; max_stock: number | null;
  unit_cost: number | null; status: string;
}
interface Lot {
  id: string; lot_number: string; profile: string; grade: string; quantity: number;
  original_quantity: number; length: number | null; location: string | null;
  status: string; heat_number_id: string;
}
interface Heat { id: string; heat_number: string; status: string; }
interface Project { id: string; name: string; }

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
    { key: "name", label: "Name", render: (r) => r.name ?? "—" },
    { key: "grade", label: "Grade", render: (r) => r.grade ?? "—" },
    { key: "length", label: "Length", render: (r) => r.length ?? "—" },
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
  const [f, setF] = useState({ profile: "", name: "", grade: "A992", length: "", quantity: "0", reorder_point: "0", max_stock: "", unit_cost: "", location: "" });
  return (
    <ResourceModal title="New inventory SKU" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          profile: f.profile, name: f.name || undefined,
          grade: f.grade || undefined, length: f.length || undefined,
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
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="W-BEAM" /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Grade"><input className="input" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} /></Field>
        <Field label="Length"><input className="input" value={f.length} onChange={(e) => setF({ ...f, length: e.target.value })} placeholder="26'-9 9/16&quot;" /></Field>
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

// Traceable Lots — Material + Grade + Heat + Lot. Company-wide (§16): a lot
// is never owned by a project. A project only ever holds a partial,
// releasable reservation against one — see lot_reservations. This lets the
// same physical inventory be drawn against by whichever project needs it,
// instead of getting locked to whoever happened to be active when it was
// received.
function TraceableLotsTab() {
  const list = useResourceList<Lot>("material_lots", { order_by: "created_at", dir: "desc", limit: "200" });
  const heats = useResourceList<Heat>("heat_numbers", { limit: "500" });
  const reservations = useResourceList<LotReservation>("lot_reservations", { status: "active", limit: "200" });
  const projects = useResourceList<Project>("projects", { limit: "200", order_by: "name", dir: "asc" });
  const release = useReleaseLotReservation();
  const [reserveTarget, setReserveTarget] = useState<Lot | null>(null);
  const [issueTarget, setIssueTarget] = useState<Lot | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const heatLookup = new Map((heats.data ?? []).map((h) => [h.id, h]));
  const projectLookup = new Map((projects.data ?? []).map((p) => [p.id, p]));
  const reservationsByLot = new Map<string, LotReservation[]>();
  for (const res of reservations.data ?? []) {
    const arr = reservationsByLot.get(res.material_lot_id) ?? [];
    arr.push(res);
    reservationsByLot.set(res.material_lot_id, arr);
  }

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
    { key: "qty", label: "Physical qty", align: "right", mono: true, render: (r) => `${r.quantity} / ${r.original_quantity}` },
    {
      key: "allocation", label: "Reservations", render: (r) => {
        const active = reservationsByLot.get(r.id) ?? [];
        const reservedQty = active.reduce((s, res) => s + Number(res.quantity), 0);
        const availableQty = Number(r.quantity) - reservedQty;
        return (
          <div style={{ minWidth: 170 }}>
            <div className="text-[11px] font-mono" style={{ color: availableQty > 0 ? "var(--text)" : "var(--muted)" }}>
              {availableQty} available
            </div>
            {active.length > 0 && (
              <div className="flex flex-wrap gap-1" style={{ marginTop: 4 }}>
                {active.map((res) => (
                  <span key={res.id} className="pill" style={{ padding: "1px 4px 1px 8px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {projectLookup.get(res.project_id)?.name ?? "Unknown project"}: {res.quantity}
                    <button
                      className="btn-icon"
                      disabled={release.isPending && releasingId === res.id}
                      title="Release back to available"
                      onClick={() => { setReleasingId(res.id); release.mutate(res.id, { onSettled: () => setReleasingId(null) }); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 0, display: "flex" }}
                    >
                      {release.isPending && releasingId === res.id ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    { key: "len", label: "Length", align: "right", mono: true, render: (r) => r.length ?? "—" },
    { key: "loc", label: "Location", render: (r) => r.location ?? "—" },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action", label: "", render: (r) => {
        const heat = heatLookup.get(r.heat_number_id);
        const quarantined = heat?.status === "quarantine";
        const active = reservationsByLot.get(r.id) ?? [];
        const availableQty = Number(r.quantity) - active.reduce((s, res) => s + Number(res.quantity), 0);
        if (r.status !== "available" || Number(r.quantity) <= 0) return null;
        return (
          <div className="flex items-center gap-1">
            <button
              className="btn btn-sm btn-primary"
              disabled={quarantined}
              title={quarantined ? "Blocked — heat is quarantined pending MTR verification" : "Issue (hard-lock) material to a part"}
              onClick={() => setIssueTarget(r)}
            >
              <Zap size={11} /> Issue
            </button>
            {availableQty > 0 && (
              <button
                className="btn btn-sm"
                disabled={quarantined}
                title={quarantined ? "Blocked — heat is quarantined pending MTR verification" : "Reserve for a project"}
                onClick={() => setReserveTarget(r)}
              >
                Reserve
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const totalActiveReservations = (reservations.data ?? []).length;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          {list.data?.length ?? 0} lots, company-wide · {totalActiveReservations} active reservation{totalActiveReservations === 1 ? "" : "s"}
          {" · created by assigning a heat to a bundle (Bundles page), not manually"}
        </div>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No traceable lots yet", subtitle: "Register a bundle and assign it a heat number to create one." }} rowKey={(r) => r.id} />

      {reserveTarget && (() => {
        const active = reservationsByLot.get(reserveTarget.id) ?? [];
        const availableQty = Number(reserveTarget.quantity) - active.reduce((s, res) => s + Number(res.quantity), 0);
        return (
          <ReserveModal lot={reserveTarget} available={availableQty} onClose={() => setReserveTarget(null)} />
        );
      })()}

      {issueTarget && (
        <IssueModal lot={issueTarget} onClose={() => setIssueTarget(null)} />
      )}
    </>
  );
}

function ReserveModal({ lot, available, onClose }: { lot: Lot; available: number; onClose: () => void }) {
  const projects = useResourceList<Project>("projects", { limit: "200", order_by: "name", dir: "asc" });
  const reserve = useReserveLot();
  const [f, setF] = useState({ project_id: "", quantity: String(available), notes: "" });

  const qtyNum = Number(f.quantity);
  const invalid = !f.project_id || !Number.isFinite(qtyNum) || qtyNum <= 0 || qtyNum > available;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="card" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div>
            <div className="card-title">Reserve material</div>
            <div className="card-sub font-mono">{lot.lot_number} · {available} available</div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>
        <form
          className="card-body"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            reserve.mutate(
              { lotId: lot.id, body: { project_id: f.project_id, quantity: qtyNum, notes: f.notes || undefined } },
              { onSuccess: onClose },
            );
          }}
        >
          <Field label="Project" required>
            <select className="input" required value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
              <option value="">—</option>
              {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label={`Quantity (max ${available})`} required>
            <input
              className="input" type="number" min="0.001" max={available} step="0.001" required
              value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Optional" />
          </Field>

          {reserve.error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{reserve.error.message}</div>}

          <div className="flex justify-end gap-2 mt-1">
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" disabled={invalid || reserve.isPending} className="btn btn-primary">
              {reserve.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              {reserve.isPending ? "Reserving…" : "Reserve"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PartOption {
  id: string;
  part_mark: string;
  name: string | null;
  profile: string;
  grade: string | null;
  weight: number | null;
  quantity: number;
  status: string;
  material_lot_id: string | null;
}

function IssueModal({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const projects = useResourceList<Project>("projects", { limit: "200", order_by: "name", dir: "asc" });
  const issue = useIssueMaterial();
  const [projectId, setProjectId] = useState("");
  const [partId, setPartId] = useState("");
  const [quantity, setQuantity] = useState(String(lot.quantity));
  const [notes, setNotes] = useState("");

  const parts = useResourceList<PartOption>(
    "parts",
    projectId ? { project_id: projectId, limit: "200" } : undefined,
    { enabled: !!projectId }
  );

  // Eligible parts: not yet issued to a lot (material_lot_id is null)
  const eligibleParts = useMemo(() => {
    return (parts.data ?? []).filter((p) => !p.material_lot_id);
  }, [parts.data]);

  const selectedPart = eligibleParts.find((p) => p.id === partId);

  const qtyNum = Number(quantity);
  const invalid = !projectId || !partId || !Number.isFinite(qtyNum) || qtyNum <= 0 || qtyNum > Number(lot.quantity);

  const handlePartSelect = (id: string) => {
    setPartId(id);
    const p = eligibleParts.find((item) => item.id === id);
    if (p) {
      const suggested = p.weight ? Math.min(Number(p.weight), Number(lot.quantity)) : Math.min(Number(p.quantity) || 1, Number(lot.quantity));
      setQuantity(String(suggested));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="card" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div>
            <div className="card-title">Issue material to part</div>
            <div className="card-sub font-mono">{lot.lot_number} ({lot.profile} {lot.grade}) · {lot.quantity} remaining</div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>
        <form
          className="card-body"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            issue.mutate(
              { partId, body: { lot_id: lot.id, quantity: qtyNum, notes: notes || undefined } },
              { onSuccess: onClose }
            );
          }}
        >
          <Field label="Project" required>
            <select
              className="input"
              required
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPartId("");
              }}
            >
              <option value="">— select project —</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          {projectId && (
            <Field label="Part mark" required>
              {parts.isLoading ? (
                <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
                  <Loader2 size={12} className="animate-spin" /> Loading parts…
                </div>
              ) : eligibleParts.length === 0 ? (
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                  No unissued parts found for this project.
                </div>
              ) : (
                <select
                  className="input"
                  required
                  value={partId}
                  onChange={(e) => handlePartSelect(e.target.value)}
                >
                  <option value="">— select part —</option>
                  {eligibleParts.map((p) => {
                    const match = p.profile === lot.profile;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.part_mark} {p.name ? `(${p.name})` : ""} — {p.profile} {p.grade || ""} {match ? "✓ profile match" : ""}
                      </option>
                    );
                  })}
                </select>
              )}
            </Field>
          )}

          {selectedPart && selectedPart.profile !== lot.profile && (
            <div className="pill pill-warning text-[11px]" style={{ padding: "6px 10px" }}>
              Note: Part profile ({selectedPart.profile}) differs from lot profile ({lot.profile}).
            </div>
          )}

          <Field label={`Quantity to consume (max ${lot.quantity})`} required>
            <input
              className="input"
              type="number"
              min="0.001"
              max={lot.quantity}
              step="0.001"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>

          <Field label="Notes">
            <input
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — e.g. cut to size for main beam"
            />
          </Field>

          {issue.error && (
            <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>
              {issue.error.message}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-1">
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" disabled={invalid || issue.isPending} className="btn btn-primary">
              {issue.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {issue.isPending ? "Issuing…" : "Issue to part"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
