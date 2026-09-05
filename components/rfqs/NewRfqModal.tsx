"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreateRfq, useFulfillMrFromInventory } from "@/hooks/useResource";
import { PackageCheck, CheckCircle2 } from "lucide-react";

interface MaterialRequirement {
  id: string;
  mr_number: string;
  profile: string;
  name: string | null;
  grade: string | null;
  quantity: number;
  length: string | null;
  project_id: string;
  status: string;
}

interface Inv {
  id: string;
  profile: string;
  name: string | null;
  grade: string | null;
  length: string | null;
  quantity: number;
  status: string;
}

interface InvReservation {
  id: string;
  inventory_id: string;
  quantity: number;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
}

// Normalise a match key so minor whitespace/case differences don't cause misses.
function invKey(profile: string, name: string | null, length: string | null) {
  return [profile, name ?? "", length ?? ""].map((s) => s.trim().toLowerCase()).join("|");
}

export interface NewRfqModalProps {
  initialSelectedMrIds?: string[];
  onClose: () => void;
  onSuccess: (rfqId: string) => void;
}

export function NewRfqModal({
  initialSelectedMrIds,
  onClose,
  onSuccess,
}: NewRfqModalProps) {
  const router = useRouter(); void router;
  const createRfq = useCreateRfq();
  const fulfill = useFulfillMrFromInventory();

  // Cross-project by design (§15.4) — every open MR company-wide
  const mrs = useResourceList<MaterialRequirement>("material_requirements", {
    status: "open",
    order_by: "created_at",
    dir: "desc",
    per_page: 200,
  });
  const vendors = useResourceList<Vendor>("vendors", {
    status: "active",
    order_by: "name",
    dir: "asc",
    limit: "200",
  });
  const projects = useResourceList<Project>("projects", { limit: "200" });
  const inventory = useResourceList<Inv>("inventory", { per_page: 200 });
  const invReservations = useResourceList<InvReservation>("inventory_reservations", {
    status: "active",
    per_page: 500,
  });

  const projectLookup = useMemo(
    () => new Map((projects.data ?? []).map((p) => [p.id, p.name])),
    [projects.data],
  );

  // Map: inventory_id → total qty reserved by OTHER open RFQs
  const reservedByInvId = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of invReservations.data ?? []) {
      map.set(r.inventory_id, (map.get(r.inventory_id) ?? 0) + Number(r.quantity));
    }
    return map;
  }, [invReservations.data]);

  // Build a lookup: invKey(profile, name, length) → { available qty, inventoryId }
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

  function stockCoverage(mr: MaterialRequirement): number {
    return inventoryLookup.get(invKey(mr.profile, mr.name, mr.length))?.available ?? 0;
  }

  function netQty(mr: MaterialRequirement): number {
    return Math.max(0, mr.quantity - stockCoverage(mr));
  }

  const [selectedMrs, setSelectedMrs] = useState<Record<string, string>>({});
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [fulfillQueue, setFulfillQueue] = useState<Set<string>>(new Set());

  function toggleFulfillQueue(mr: MaterialRequirement) {
    setFulfillQueue((prev) => {
      const next = new Set(prev);
      if (next.has(mr.id)) next.delete(mr.id);
      else next.add(mr.id);
      return next;
    });
  }

  // Pre-select initial or all open MRs once data is loaded
  useEffect(() => {
    const allMrs = mrs.data ?? [];
    if (allMrs.length > 0 && inventory.data && invReservations.data && Object.keys(selectedMrs).length === 0) {
      const all: Record<string, string> = {};
      const targetMrs = initialSelectedMrIds && initialSelectedMrIds.length > 0
        ? allMrs.filter((m) => initialSelectedMrIds.includes(m.id))
        : allMrs;

      for (const mr of targetMrs) {
        all[mr.id] = String(netQty(mr));
      }
      setSelectedMrs(all);
    }
  }, [mrs.data, inventory.data, invReservations.data, initialSelectedMrIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const [deliveryRequirement, setDeliveryRequirement] = useState("");
  const [notes, setNotes] = useState("");

  function toggleMr(mr: MaterialRequirement) {
    setSelectedMrs((prev) => {
      const next = { ...prev };
      if (mr.id in next) delete next[mr.id];
      else next[mr.id] = String(netQty(mr));
      return next;
    });
    setFulfillQueue((prev) => {
      const next = new Set(prev);
      next.delete(mr.id);
      return next;
    });
  }

  function toggleVendor(id: string) {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
          material_requirement_id,
          quantity: Number(qty),
        })),
        vendor_ids: Array.from(selectedVendors),
      },
      {
        onSuccess: async (res) => {
          const promises = Array.from(fulfillQueue).map((mrId) => {
            const mr = (mrs.data ?? []).find((m) => m.id === mrId);
            if (!mr) return Promise.resolve();
            const inv = inventoryLookup.get(invKey(mr.profile, mr.name, mr.length));
            if (!inv) return Promise.resolve();
            return fulfill.mutateAsync({
              mrId,
              inventoryId: inv.inventoryId,
              quantity: mr.quantity,
              projectId: mr.project_id,
            });
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
      <Field
        label={`Material requirements (${mrCount} for RFQ${fulfillQueueCount > 0 ? ` · ${fulfillQueueCount} fulfill from stock` : ""})`}
        required
      >
        <div className="rounded-lg border" style={{ borderColor: "var(--border)", maxHeight: 320, overflowY: "auto" }}>
          {(mrs.data ?? []).length === 0 && (
            <div className="text-[12px] p-3" style={{ color: "var(--muted)" }}>
              No open material requirements. Raise one on a project first.
            </div>
          )}
          {(mrs.data ?? []).length > 0 && (
            <label
              className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle, rgba(0,0,0,0.03))" }}
            >
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

            const Wrapper = fullyCovered && !isSelected ? "div" : "label";

            return (
              <Wrapper
                key={mr.id}
                className="flex items-start gap-2 px-3 py-2 text-[12px]"
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: isQueued
                    ? "rgba(79,70,229,0.06)"
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

                <div className="flex flex-col items-end gap-1" style={{ flexShrink: 0 }}>
                  {isSelected && (
                    <>
                      <input
                        className="input"
                        type="number"
                        min="0.01"
                        step="0.01"
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

                  {fullyCovered && !isSelected && (
                    <button
                      type="button"
                      className={`btn btn-sm${isQueued ? " btn-primary" : ""}`}
                      style={{ fontSize: 10, height: 24, padding: "0 8px", whiteSpace: "nowrap" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFulfillQueue(mr);
                      }}
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
