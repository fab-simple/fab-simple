"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreateRfq } from "@/hooks/useResource";
import { Plus } from "lucide-react";

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
  const create = useCreateRfq();
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
        <NewRfqModal onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, {
            onSuccess: (res) => { setShowNew(false); router.push(`/dashboard/rfqs/${res.rfq.id}`); },
          })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function NewRfqModal({ onClose, onSubmit, submitting, error }: {
  onClose: () => void;
  onSubmit: (p: { delivery_requirement?: string; notes?: string; lines: { material_requirement_id: string; quantity: number }[]; vendor_ids: string[] }) => void;
  submitting: boolean; error: string | null;
}) {
  // Cross-project by design (§15.4) — every open MR company-wide, not just
  // the one from the currently-selected project in the sidebar.
  const mrs = useResourceList<MaterialRequirement>("material_requirements", { status: "open", order_by: "created_at", dir: "desc", per_page: 200 });
  const vendors = useResourceList<Vendor>("vendors", { status: "active", order_by: "name", dir: "asc", limit: "200" });
  const projects = useResourceList<Project>("projects", { limit: "200" });
  // Bulk inventory — used to net available stock against each MR quantity
  const inventory = useResourceList<Inv>("inventory", { per_page: 200 });

  const projectLookup = new Map((projects.data ?? []).map((p) => [p.id, p.name]));

  // Build a lookup: invKey(profile, name, length) → qty available in stock.
  // Only count stock that has qty > 0 (status ok or low).
  const inventoryLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of inventory.data ?? []) {
      if (Number(inv.quantity) <= 0) continue;
      const k = invKey(inv.profile, inv.name, inv.length);
      map.set(k, (map.get(k) ?? 0) + Number(inv.quantity));
    }
    return map;
  }, [inventory.data]);

  // How much of an MR is covered by current bulk stock?
  function stockCoverage(mr: MaterialRequirement): number {
    return inventoryLookup.get(invKey(mr.profile, mr.name, mr.length)) ?? 0;
  }

  // Net quantity to order = max(0, mr.quantity - stock on hand)
  function netQty(mr: MaterialRequirement): number {
    return Math.max(0, mr.quantity - stockCoverage(mr));
  }

  const [selectedMrs, setSelectedMrs] = useState<Record<string, string>>({}); // mr_id -> quantity string
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());

  // Pre-select all open MRs with net quantities once both MRs and inventory are loaded.
  // We wait for inventory so quantities are already netted on first render.
  useEffect(() => {
    const allMrs = mrs.data ?? [];
    if (allMrs.length > 0 && inventory.data && Object.keys(selectedMrs).length === 0) {
      const all: Record<string, string> = {};
      for (const mr of allMrs) all[mr.id] = String(netQty(mr));
      setSelectedMrs(all);
    }
  }, [mrs.data, inventory.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const [deliveryRequirement, setDeliveryRequirement] = useState("");
  const [notes, setNotes] = useState("");

  function toggleMr(mr: MaterialRequirement) {
    setSelectedMrs((prev) => {
      const next = { ...prev };
      if (mr.id in next) delete next[mr.id];
      else next[mr.id] = String(netQty(mr));
      return next;
    });
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
  const invalid = mrCount === 0 || selectedVendors.size === 0;

  return (
    <ResourceModal title="New RFQ" onClose={onClose} submitting={submitting} error={error}
      submitDisabled={invalid} width={600}
      onSubmit={(e) => {
        e.preventDefault();
        if (invalid) return;
        onSubmit({
          delivery_requirement: deliveryRequirement || undefined,
          notes: notes || undefined,
          lines: Object.entries(selectedMrs).map(([material_requirement_id, qty]) => ({
            material_requirement_id, quantity: Number(qty),
          })),
          vendor_ids: Array.from(selectedVendors),
        });
      }}
    >
      <Field label={`Material requirements (${mrCount} selected)`} required>
        <div className="rounded-lg border" style={{ borderColor: "var(--border)", maxHeight: 300, overflowY: "auto" }}>
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

            return (
              <label
                key={mr.id}
                className="flex items-start gap-2 px-3 py-2 text-[12px]"
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: fullyCovered ? "rgba(16,185,129,0.05)" : undefined,
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={isSelected} onChange={() => toggleMr(mr)} style={{ marginTop: 3, flexShrink: 0 }} />

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

                  {/* Stock coverage indicators */}
                  {fullyCovered && (
                    <div className="text-[11px] mt-1" style={{ color: "#10B981" }}>
                      ✓ Fully covered by stock ({covered} in inventory) — uncheck to skip
                    </div>
                  )}
                  {partiallyCovered && (
                    <div className="text-[11px] mt-1" style={{ color: "#F59E0B" }}>
                      ⚡ {covered} in stock · ordering {net} of {mr.quantity} required
                    </div>
                  )}
                </div>

                {/* Net quantity input — editable, pre-set to net-to-order */}
                {isSelected && (
                  <div className="flex flex-col items-end gap-1" style={{ flexShrink: 0 }}>
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
                  </div>
                )}
              </label>
            );
          })}
        </div>
        {inventory.isLoading && (
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>⏳ Loading inventory for stock netting…</div>
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
