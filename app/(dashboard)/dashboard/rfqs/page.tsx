"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreateRfq, useFulfillMrFromInventory } from "@/hooks/useResource";
import { Plus, PackageCheck, CheckCircle2 } from "lucide-react";

interface Rfq {
  id: string; rfq_number: string; status: string; delivery_requirement: string | null; created_at: string;
}
interface MaterialRequirement {
  id: string; mr_number: string; profile: string; name: string | null; grade: string | null;
  quantity: number; length: string | null; project_id: string; status: string;
}
interface Inv {
  id: string; profile: string; name: string | null; grade: string | null;
  length: string | null; quantity: number; status: string;
}
interface InvReservation {
  id: string; inventory_id: string; quantity: number; status: string;
}
interface Vendor { id: string; name: string; status: string; }
interface Project { id: string; name: string; }
interface RfqVendorRow { id: string; rfq_id: string; vendor_id: string; }

// Normalise a match key so minor whitespace/case differences don't cause misses.
function invKey(profile: string, name: string | null, length: string | null) {
  return [profile, name ?? "", length ?? ""].map((s) => s.trim().toLowerCase()).join("|");
}

// RFQ is the one page in Procurement that's deliberately NOT gated by the
// Global Project Context (spec §15.1 D14) — its entire purpose is letting a
// PM shop requirements from several projects to the same vendor in one ask.
export default function RfqsPage() {
  const router = useRouter();
  const list = useResourceList<Rfq>("rfqs", { order_by: "created_at", dir: "desc" });
  const rfqVendors = useResourceList<RfqVendorRow>("rfq_vendors", { limit: "500" });
  const [showNew, setShowNew] = useState(false);

  const vendorCountByRfq = new Map<string, number>();
  for (const rv of rfqVendors.data ?? []) {
    vendorCountByRfq.set(rv.rfq_id, (vendorCountByRfq.get(rv.rfq_id) ?? 0) + 1);
  }

  const cols: Column<Rfq>[] = [
    { key: "num", label: "RFQ #", mono: true, render: (r) => <strong>{r.rfq_number}</strong> },
    { key: "delivery", label: "Delivery requirement", render: (r) => r.delivery_requirement ?? "—" },
    { key: "vendors", label: "Vendors invited", align: "right", mono: true, render: (r) => vendorCountByRfq.get(r.id) ?? 0 },
    { key: "created", label: "Created", render: (r) => new Date(r.created_at).toLocaleDateString() },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageWrapper title="RFQs">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>RFQs</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {list.data?.length ?? 0} RFQs, company-wide · shop Material Requirements from any project to one or more vendors
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New RFQ</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No RFQs yet", subtitle: "Raise Material Requirements on a project, then bundle them here to shop to vendors." }}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/dashboard/rfqs/${r.id}`)}
      />

      {showNew && (
        <NewRfqModal
          onClose={() => setShowNew(false)}
          onSuccess={(rfqId) => { setShowNew(false); router.push(`/dashboard/rfqs/${rfqId}`); }}
        />
      )}
    </PageWrapper>
  );
}

// ---------------------------------------------------------------------------
// NewRfqModal — owns its own mutations so it controls the full submit sequence:
//   1. Create the RFQ (lines + vendors)
//   2. Only on success → fire fulfill-from-stock for any queued MRs
//
// "Fulfill from Stock" is LOCAL STATE ONLY until the RFQ is saved.
// Closing the modal without saving discards the queue with zero side-effects.
// ---------------------------------------------------------------------------
function NewRfqModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (rfqId: string) => void;
}) {
  const router = useRouter(); void router; // consumed by parent; kept for future use
  const createRfq = useCreateRfq();
  const fulfill = useFulfillMrFromInventory();

  // Cross-project by design (§15.4) — every open MR company-wide, not just
  // the one from the currently-selected project in the sidebar.
  const mrs = useResourceList<MaterialRequirement>("material_requirements", { status: "open", order_by: "created_at", dir: "desc", per_page: 200 });
  const vendors = useResourceList<Vendor>("vendors", { status: "active", order_by: "name", dir: "asc", limit: "200" });
  const projects = useResourceList<Project>("projects", { limit: "200" });
  // Bulk inventory — used to net available stock against each MR quantity
  const inventory = useResourceList<Inv>("inventory", { per_page: 200 });
  // Active inventory reservations — subtract from raw stock to get truly available
  const invReservations = useResourceList<InvReservation>("inventory_reservations", { status: "active", per_page: 500 });

  const projectLookup = new Map((projects.data ?? []).map((p) => [p.id, p.name]));

  // Map: inventory_id → total qty reserved by OTHER open RFQs
  const reservedByInvId = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of invReservations.data ?? []) {
      map.set(r.inventory_id, (map.get(r.inventory_id) ?? 0) + Number(r.quantity));
    }
    return map;
  }, [invReservations.data]);

  // Build a lookup: invKey(profile, name, length) → { available qty, inventoryId }.
  // truly_available = raw quantity − active reservations from other RFQs.
  // When multiple SKU rows share the same key, pick the one with the most available.
  const inventoryLookup = useMemo(() => {
    const map = new Map<string, { available: number; inventoryId: string }>();
    for (const inv of inventory.data ?? []) {
      const reserved = reservedByInvId.get(inv.id) ?? 0;
      const available = Math.max(0, Number(inv.quantity) - reserved);
      if (available <= 0) continue;
      const k = invKey(inv.profile, inv.name, inv.length);
      const existing = map.get(k);
      if (!existing || available > existing.available) {
        map.set(k, { available, inventoryId: inv.id });
      }
    }
    return map;
  }, [inventory.data, reservedByInvId]);

  // How much of an MR is covered by current bulk stock?
  function stockCoverage(mr: MaterialRequirement): number {
    return inventoryLookup.get(invKey(mr.profile, mr.name, mr.length))?.available ?? 0;
  }

  // Net quantity to order = max(0, mr.quantity - stock on hand)
  function netQty(mr: MaterialRequirement): number {
    return Math.max(0, mr.quantity - stockCoverage(mr));
  }

  const [selectedMrs, setSelectedMrs] = useState<Record<string, string>>({}); // mr_id → quantity string
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());

  // ── Fulfill-from-stock queue ──────────────────────────────────────────────
  // Pure local state — no API calls until the RFQ is saved.
  // Contains IDs of fully-stocked MRs the user has opted to fulfill from
  // inventory instead of including in this RFQ. Discarded on modal close.
  const [fulfillQueue, setFulfillQueue] = useState<Set<string>>(new Set());

  function toggleFulfillQueue(mr: MaterialRequirement) {
    setFulfillQueue((prev) => {
      const next = new Set(prev);
      if (next.has(mr.id)) next.delete(mr.id); else next.add(mr.id);
      return next;
    });
  }

  // Pre-select all open MRs with net quantities once both MRs and inventory are loaded.
  // We wait for inventory + reservations so quantities are already netted on first render.
  useEffect(() => {
    const allMrs = mrs.data ?? [];
    if (allMrs.length > 0 && inventory.data && invReservations.data && Object.keys(selectedMrs).length === 0) {
      const all: Record<string, string> = {};
      for (const mr of allMrs) all[mr.id] = String(netQty(mr));
      setSelectedMrs(all);
    }
  }, [mrs.data, inventory.data, invReservations.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const [deliveryRequirement, setDeliveryRequirement] = useState("");
  const [notes, setNotes] = useState("");

  function toggleMr(mr: MaterialRequirement) {
    setSelectedMrs((prev) => {
      const next = { ...prev };
      if (mr.id in next) delete next[mr.id];
      else next[mr.id] = String(netQty(mr));
      return next;
    });
    // Un-queueing from fulfill if re-checking for RFQ
    setFulfillQueue((prev) => { const next = new Set(prev); next.delete(mr.id); return next; });
  }
  function toggleVendor(id: string) {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAllMrs() {
    const allMrs = mrs.data ?? [];
    setSelectedMrs((prev) => {
      if (allMrs.length > 0 && allMrs.every((mr) => mr.id in prev)) return {};
      const next: Record<string, string> = { ...prev };
      for (const mr of allMrs) next[mr.id] = mr.id in prev ? prev[mr.id] : String(netQty(mr));
      return next;
    });
  }

  const mrCount = Object.keys(selectedMrs).length;
  const allMrsSelected = (mrs.data ?? []).length > 0 && (mrs.data ?? []).every((mr) => mr.id in selectedMrs);
  // RFQ itself is invalid if no lines or no vendors; fulfill queue doesn't block submit.
  const rfqInvalid = mrCount === 0 || selectedVendors.size === 0;
  const submitting = createRfq.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rfqInvalid) return;

    createRfq.mutate(
      {
        delivery_requirement: deliveryRequirement || undefined,
        notes: notes || undefined,
        lines: Object.entries(selectedMrs).map(([material_requirement_id, qty]) => ({
          material_requirement_id, quantity: Number(qty),
        })),
        vendor_ids: Array.from(selectedVendors),
      },
      {
        onSuccess: async (res) => {
          // ── Fire fulfill-from-stock for all queued MRs ──────────────────
          // Runs AFTER the RFQ is successfully created so there are no orphans.
          // We MUST await these before calling onSuccess (which navigates away),
          // otherwise the browser/React Query will cancel the requests when the
          // modal unmounts.
          const promises = Array.from(fulfillQueue).map((mrId) => {
            const mr = (mrs.data ?? []).find((m) => m.id === mrId);
            if (!mr) return Promise.resolve();
            const inv = inventoryLookup.get(invKey(mr.profile, mr.name, mr.length));
            if (!inv) return Promise.resolve();
            return fulfill.mutateAsync({ mrId, inventoryId: inv.inventoryId, quantity: mr.quantity, projectId: mr.project_id });
          });

          if (promises.length > 0) {
            await Promise.allSettled(promises);
          }

          onSuccess(res.rfq.id);
        },
      },
    );
  }

  const fulfillQueueCount = fulfillQueue.size;

  return (
    <ResourceModal
      title="New RFQ"
      onClose={onClose}
      submitting={submitting}
      error={createRfq.error?.message ?? null}
      submitDisabled={rfqInvalid}
      submitLabel={fulfillQueueCount > 0 ? `Save RFQ + Fulfill ${fulfillQueueCount} from Stock` : "Save RFQ"}
      width={600}
      onSubmit={handleSubmit}
    >
      <Field label={`Material requirements (${mrCount} for RFQ${fulfillQueueCount > 0 ? ` · ${fulfillQueueCount} fulfill from stock` : ""})`} required>
        <div className="rounded-lg border" style={{ borderColor: "var(--border)", maxHeight: 320, overflowY: "auto" }}>
          {(mrs.data ?? []).length === 0 && (
            <div className="text-[12px] p-3" style={{ color: "var(--muted)" }}>No open material requirements. Raise one on a project first.</div>
          )}
          {(mrs.data ?? []).length > 0 && (
            <label className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle, rgba(0,0,0,0.03))" }}>
              <input type="checkbox" checked={allMrsSelected} onChange={toggleAllMrs} />
              Select all
            </label>
          )}
          {(mrs.data ?? []).map((mr) => {
            const covered = stockCoverage(mr);
            const net = netQty(mr);
            const fullyCovered = covered > 0 && net === 0;
            const partiallyCovered = covered > 0 && net > 0;
            const isSelected = mr.id in selectedMrs;
            const isQueued = fulfillQueue.has(mr.id);

            // Wrapper: use <div> when the row has the "Fulfill from Stock" toggle on the
            // right-hand side to prevent button clicks from propagating to the checkbox.
            const Wrapper = fullyCovered && !isSelected ? "div" : "label";

            return (
              <Wrapper
                key={mr.id}
                className="flex items-start gap-2 px-3 py-2 text-[12px]"
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: isQueued
                    ? "rgba(79,70,229,0.06)"    // indigo tint — queued for fulfillment
                    : fullyCovered ? "rgba(16,185,129,0.05)" : undefined,
                  cursor: fullyCovered && !isSelected ? "default" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleMr(mr)}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />

                {/* MR identity — profile, name, grade, length, project */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold">{mr.mr_number}</span>
                    <span className="font-medium">{mr.profile}</span>
                    {mr.name && <span style={{ color: "var(--text)" }}>{mr.name}</span>}
                    {mr.grade && (
                      <span className="pill" style={{ padding: "0 5px", fontSize: 10 }}>{mr.grade}</span>
                    )}
                    {mr.length && (
                      <span style={{ color: "var(--muted)" }}>· {mr.length}</span>
                    )}
                    <span style={{ color: "var(--muted)" }}>
                      · {projectLookup.get(mr.project_id) ?? mr.project_id.slice(0, 8)}
                    </span>
                  </div>

                  {/* Stock coverage / queue indicators */}
                  {isQueued && (
                    <div className="flex items-center gap-1 text-[11px] mt-1" style={{ color: "var(--primary)" }}>
                      <PackageCheck size={11} />
                      Will be fulfilled from inventory when RFQ is saved
                    </div>
                  )}
                  {!isQueued && fullyCovered && (
                    <div className="text-[11px] mt-1" style={{ color: "#10B981" }}>
                      ✓ Fully covered by stock ({covered} in inventory)
                      {isSelected ? " — uncheck to skip" : ""}
                    </div>
                  )}
                  {partiallyCovered && !isQueued && (
                    <div className="text-[11px] mt-1" style={{ color: "#F59E0B" }}>
                      ⚡ {covered} in stock · ordering {net} of {mr.quantity} required
                    </div>
                  )}
                </div>

                {/* Right-side controls */}
                <div className="flex flex-col items-end gap-1" style={{ flexShrink: 0 }}>
                  {/* Qty input — shown when MR is included in the RFQ */}
                  {isSelected && (
                    <>
                      <input
                        className="input" type="number" min="0.01" step="0.01"
                        style={{ width: 80, height: 26, fontSize: 11, textAlign: "right" }}
                        value={selectedMrs[mr.id]}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setSelectedMrs((prev) => ({ ...prev, [mr.id]: e.target.value }))}
                      />
                      {covered > 0 && (
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>of {mr.quantity} req.</span>
                      )}
                    </>
                  )}

                  {/* Fulfill from Stock toggle — only for fully-stocked MRs that are NOT in the RFQ.
                      This is LOCAL STATE ONLY. No API call happens until the RFQ is saved. */}
                  {fullyCovered && !isSelected && (
                    <button
                      type="button"
                      className={`btn btn-sm${isQueued ? " btn-primary" : ""}`}
                      style={{ fontSize: 10, height: 24, padding: "0 8px", whiteSpace: "nowrap" }}
                      onClick={(e) => { e.stopPropagation(); toggleFulfillQueue(mr); }}
                      title={isQueued
                        ? "Click to remove from fulfillment queue"
                        : "Mark to fulfill from existing inventory stock when RFQ is saved"}
                    >
                      {isQueued
                        ? <><CheckCircle2 size={10} /> Queued</>
                        : <><PackageCheck size={10} /> Fulfill from Stock</>}
                    </button>
                  )}
                </div>
              </Wrapper>
            );
          })}
        </div>
        {(inventory.isLoading || invReservations.isLoading) && (
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>⏳ Loading inventory for stock netting…</div>
        )}
        {fulfillQueueCount > 0 && (
          <div className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: "var(--primary)" }}>
            <PackageCheck size={11} />
            {fulfillQueueCount} MR{fulfillQueueCount > 1 ? "s" : ""} will be marked <strong>fulfilled</strong> and inventory reserved when you save
          </div>
        )}
      </Field>

      <Field label={`Vendors to invite (${selectedVendors.size} selected)`} required>
        <div className="rounded-lg border" style={{ borderColor: "var(--border)", maxHeight: 150, overflowY: "auto" }}>
          {(vendors.data ?? []).map((v) => (
            <label key={v.id} className="flex items-center gap-2 px-3 py-2 text-[12px]" style={{ borderBottom: "1px solid var(--border)" }}>
              <input type="checkbox" checked={selectedVendors.has(v.id)} onChange={() => toggleVendor(v.id)} />
              {v.name}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Delivery requirement">
        <input className="input" value={deliveryRequirement} onChange={(e) => setDeliveryRequirement(e.target.value)} placeholder="FOB shop, 4 weeks ARO" />
      </Field>
      <Field label="Notes">
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
      </Field>
    </ResourceModal>
  );
}
