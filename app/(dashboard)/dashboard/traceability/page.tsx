"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { useResourceList, usePartTraceability } from "@/hooks/useResource";
import type { TraceabilityChainRow } from "@/lib/api";
import {
  GitBranch, PackageCheck, Thermometer, FileText, ShoppingCart,
  ChevronRight, ShieldCheck, ShieldAlert, Search, X,
  Loader2, Link2,
} from "lucide-react";

interface Part {
  id: string;
  mark: string | null;
  name: string | null;
  profile: string | null;
  status: string;
  project_id: string | null;
  material_lot_id: string | null;
}

export default function TraceabilityPage() {
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [partSearch, setPartSearch] = useState("");

  const parts = useResourceList<Part>("parts", {
    order_by: "mark",
    dir: "asc",
    limit: "200",
  });

  // Filter parts that have a material_lot_id (issued material)
  const issuedParts = (parts.data ?? []).filter(
    (p) =>
      p.material_lot_id &&
      (!partSearch || (p.mark ?? "").toLowerCase().includes(partSearch.toLowerCase()) ||
        (p.name ?? "").toLowerCase().includes(partSearch.toLowerCase()) ||
        (p.profile ?? "").toLowerCase().includes(partSearch.toLowerCase())),
  );

  const selectedPart = issuedParts.find((p) => p.id === selectedPartId) ??
    (parts.data ?? []).find((p) => p.id === selectedPartId);

  const { data: trace, isLoading: traceLoading } = usePartTraceability(selectedPartId);

  return (
    <PageWrapper title="Material Traceability">
      <div className="mb-6">
        <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Material Traceability</div>
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          Full reverse chain: Part → Heat Number → Lot → Receiving → PO → Vendor → Mill Certificate
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
        {/* ── Part Selector ─────────────────────────────────────────────── */}
        <div className="card" style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
          <div className="card-header" style={{ paddingBottom: 8 }}>
            <div className="card-title" style={{ fontSize: 13 }}>Select part</div>
          </div>
          <div style={{ padding: "0 12px 8px" }}>
            <div className="relative">
              <Search size={12} className="absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                className="input"
                style={{ paddingLeft: 28, fontSize: 12 }}
                placeholder="Search mark / name / profile…"
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
              />
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {parts.isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
              </div>
            ) : issuedParts.length === 0 ? (
              <div className="p-4 text-center text-[12px]" style={{ color: "var(--muted)" }}>
                {partSearch ? "No parts match your search" : "No parts with issued material yet"}
              </div>
            ) : (
              issuedParts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                  style={{
                    background: selectedPartId === p.id ? "rgba(var(--primary-rgb),0.1)" : "transparent",
                    borderLeft: selectedPartId === p.id ? "3px solid var(--primary)" : "3px solid transparent",
                    transition: "all 0.1s",
                  }}
                  onClick={() => setSelectedPartId(p.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-mono text-[12px] font-semibold truncate" style={{ color: "var(--text)" }}>
                      {p.mark ?? p.id.slice(0, 8)}
                    </div>
                    {p.name && (
                      <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{p.name}</div>
                    )}
                    <div className="text-[10px]" style={{ color: "var(--muted)" }}>{p.profile}</div>
                  </div>
                  <ChevronRight size={11} style={{ color: "var(--muted)", flexShrink: 0 }} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Traceability Chain ────────────────────────────────────────── */}
        <div>
          {!selectedPartId ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <GitBranch size={32} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
              <div className="text-[14px] font-medium" style={{ color: "var(--text)" }}>Select a part</div>
              <div className="text-[12px]" style={{ color: "var(--muted)", marginTop: 4 }}>
                Choose a part on the left to view its complete material traceability chain.
              </div>
            </div>
          ) : traceLoading ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--primary)", margin: "0 auto 12px" }} />
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>Loading traceability chain…</div>
            </div>
          ) : !trace || trace.chain.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <Link2 size={28} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
              <div className="text-[14px] font-medium" style={{ color: "var(--text)" }}>No traceability chain yet</div>
              <div className="text-[12px]" style={{ color: "var(--muted)", marginTop: 4 }}>
                Material has not been issued to this part. Issue material from the Inventory → Traceable Lots tab.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Part header */}
              <div className="card card-body" style={{ padding: "14px 16px" }}>
                <div className="flex items-center gap-3">
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "rgba(var(--primary-rgb),0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span className="font-bold text-[12px]" style={{ color: "var(--primary)" }}>P</span>
                  </div>
                  <div>
                    <div className="font-mono font-bold" style={{ color: "var(--text)" }}>
                      {selectedPart?.mark ?? selectedPartId?.slice(0, 8)}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                      {selectedPart?.name} {selectedPart?.profile && `· ${selectedPart.profile}`}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <StatusPill status={selectedPart?.status ?? "unknown"} />
                  </div>
                </div>
              </div>

              {trace.chain.map((row, i) => (
                <ChainSection key={row.issue_id} row={row} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

function ChainSection({ row, index }: { row: TraceabilityChainRow; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const isVoided = row.voided;

  return (
    <div className="card" style={{
      opacity: isVoided ? 0.6 : 1,
      border: isVoided ? "1px dashed var(--border)" : "1px solid var(--border)",
    }}>
      <div
        className="card-header cursor-pointer"
        onClick={() => setOpen(!open)}
        style={{ padding: "12px 16px" }}
      >
        <div className="flex items-center gap-3">
          {isVoided ? (
            <ShieldAlert size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
          ) : (
            <ShieldCheck size={16} style={{ color: "var(--green)", flexShrink: 0 }} />
          )}
          <div>
            <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
              {isVoided ? "⚠ Voided Issue — " : ""}Heat {row.heat_number}
            </div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              {Number(row.qty_consumed).toLocaleString()} lbs consumed · {new Date(row.issued_at).toLocaleDateString()}
            </div>
          </div>
          <ChevronRight size={13} style={{
            marginLeft: "auto", color: "var(--muted)",
            transform: open ? "rotate(90deg)" : undefined, transition: "transform 0.15s",
          }} />
        </div>
      </div>

      {open && (
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Heat + Lot */}
          <Section icon={<Thermometer size={13} />} label="Heat Number & Lot">
            <Grid>
              <Cell label="Heat Number" value={row.heat_number} mono />
              <Cell label="Lot Number" value={row.lot_number} mono />
              <Cell label="Profile" value={row.lot_profile} />
              <Cell label="Grade" value={row.lot_grade} />
              <Cell label="Bin Location" value={row.bin_location} />
              <Cell label="Heat Status" value={
                <StatusPill status={row.heat_availability_status} />
              } />
              <Cell label="MTR Status" value={<StatusPill status={row.mtr_status} />} />
              <Cell label="Qty Consumed" value={`${Number(row.qty_consumed).toLocaleString()} lbs`} mono />
            </Grid>
          </Section>

          {/* Receiving & Bundle */}
          {row.receiving_number && (
            <Section icon={<PackageCheck size={13} />} label="Receiving & Bundle">
              <Grid>
                <Cell label="Receiving #" value={row.receiving_number} mono />
                <Cell label="Bundle #" value={row.bundle_number} mono />
                <Cell label="Received Date" value={row.received_date ? new Date(row.received_date).toLocaleDateString() : null} />
              </Grid>
            </Section>
          )}

          {/* PO & Vendor */}
          {row.po_number && (
            <Section icon={<ShoppingCart size={13} />} label="Purchase Order & Vendor">
              <Grid>
                <Cell label="PO Number" value={row.po_number} mono />
                <Cell label="Vendor" value={row.vendor_name} />
              </Grid>
            </Section>
          )}

          {/* Mill Cert */}
          <Section icon={<FileText size={13} />} label="Mill Certificate">
            {row.mtr_doc_id ? (
              <Grid>
                <Cell label="Mill Name" value={row.mill_name} />
                <Cell label="OCR Status" value={<StatusPill status={row.mtr_ocr_status ?? "none"} />} />
                {row.mill_cert_url && (
                  <Cell label="Download" value={
                    <a href={row.mill_cert_url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-sm btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }}>
                      <FileText size={11} /> View MTR
                    </a>
                  } />
                )}
              </Grid>
            ) : (
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>No MTR document attached to this heat number.</div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: "var(--muted)" }}>{icon}</span>
        <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
      {children}
    </div>
  );
}

function Cell({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</div>
      <div className={`text-[12px] mt-0.5 ${mono ? "font-mono" : ""}`} style={{ color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
