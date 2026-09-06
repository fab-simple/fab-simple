"use client";

import { useRef, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import {
  useResourceList, useCreate, useUpdate, useExtractMtrDocument,
} from "@/hooks/useResource";
import { uploadFile, FabAPI } from "@/lib/api";
import { Plus, FileText, Upload, Loader2, Sparkles, ShieldCheck, X } from "lucide-react";

interface Heat {
  id: string; heat_number: string; material_grade: string;
  mill_name: string | null; supplier: string | null;
  mtr_status: string; status: string; receipt_number: string | null; parts_count: number;
}
interface MtrDoc {
  id: string; heat_number_id: string; file_attachment_id: string | null;
  yield_strength: number | null; tensile_strength: number | null;
  chemistry: Record<string, number> | null; mill_name: string | null;
  ocr_status: string; extracted_by: string | null; created_at: string;
}

const MTR_STATUSES = ["pending", "received", "verified"];

export default function HeatNumbersPage() {
  const list = useResourceList<Heat>("heat_numbers", { order_by: "heat_number", dir: "desc" });
  const create = useCreate<Heat>("heat_numbers");
  const [showNew, setShowNew] = useState(false);
  const [mtrTarget, setMtrTarget] = useState<Heat | null>(null);

  const quarantineCount = (list.data ?? []).filter((h) => h.status === "quarantine").length;

  const cols: Column<Heat>[] = [
    { key: "heat", label: "Heat #", mono: true, render: (r) => <strong>{r.heat_number}</strong> },
    { key: "grade", label: "Material Grade", render: (r) => r.material_grade },
    { key: "mill", label: "Mill", render: (r) => r.mill_name ?? "—" },
    { key: "supplier", label: "Supplier", render: (r) => r.supplier ?? "—" },
    { key: "parts", label: "Lots", align: "right", mono: true, render: (r) => r.parts_count },
    { key: "mtr", label: "MTR Status", render: (r) => <StatusPill status={r.mtr_status} /> },
    { key: "avail", label: "Availability", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action", label: "", render: (r) => (
        <button className="btn btn-sm" onClick={() => setMtrTarget(r)}>
          <FileText size={12} /> MTR
        </button>
      ),
    },
  ];

  return (
    <PageWrapper title="Heat Numbers">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Heat Number Traceability</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Mill test reports linked to each material batch
            {quarantineCount > 0 && <span style={{ color: "#DC2626", marginLeft: 8 }}>· {quarantineCount} in quarantine — blocked from fabrication until QC verifies an MTR</span>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New heat</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No heat numbers tracked yet" }} rowKey={(r) => r.id} />

      {showNew && (
        <NewModal onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}

      {mtrTarget && (
        <MtrPanel heat={mtrTarget} onClose={() => setMtrTarget(null)} />
      )}
    </PageWrapper>
  );
}

function NewModal({ onClose, onSubmit, submitting, error }: {
  onClose: () => void; onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({ heat_number: "", material_grade: "A992", mill_name: "", supplier: "", mtr_status: "pending", receipt_number: "" });
  return (
    <ResourceModal title="New heat number" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          heat_number: f.heat_number, material_grade: f.material_grade,
          mill_name: f.mill_name || undefined, supplier: f.supplier || undefined,
          mtr_status: f.mtr_status, receipt_number: f.receipt_number || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Heat #" required><input className="input" required value={f.heat_number} onChange={(e) => setF({ ...f, heat_number: e.target.value })} placeholder="HT-23845" /></Field>
        <Field label="Material grade" required><input className="input" required value={f.material_grade} onChange={(e) => setF({ ...f, material_grade: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Mill"><input className="input" value={f.mill_name} onChange={(e) => setF({ ...f, mill_name: e.target.value })} placeholder="Nucor Steel" /></Field>
        <Field label="Supplier"><input className="input" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} placeholder="Triple S Steel" /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="MTR status">
          <select className="input" value={f.mtr_status} onChange={(e) => setF({ ...f, mtr_status: e.target.value })}>
            {MTR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Receipt #"><input className="input" value={f.receipt_number} onChange={(e) => setF({ ...f, receipt_number: e.target.value })} /></Field>
      </div>
    </ResourceModal>
  );
}

// MTR document panel: create -> attach file -> OCR-assisted extraction ->
// QC verification. Extraction only ever sets ocr_status='extracted'; only
// the explicit "Verify" action (qc/owner) sets 'verified', which is the
// value that lifts heat quarantine (fn_sync_heat_quarantine trigger).
function MtrPanel({ heat, onClose }: { heat: Heat; onClose: () => void }) {
  const docs = useResourceList<MtrDoc>("mtr_documents", { heat_number_id: heat.id, order_by: "created_at", dir: "desc" });
  const createDoc = useCreate<MtrDoc>("mtr_documents");
  const updateDoc = useUpdate<MtrDoc>("mtr_documents");
  const extract = useExtractMtrDocument();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState<{ yield_strength: string; tensile_strength: string; mill_name: string } | null>(null);

  async function startNewDoc() {
    setError(null);
    try {
      const doc = await createDoc.mutateAsync({ heat_number_id: heat.id });
      setActiveDocId(doc.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start MTR document");
    }
  }

  async function handleFile(file: File, docId: string) {
    setUploading(true);
    setError(null);
    try {
      const { attachment_id } = await uploadFile({ file, entity_type: "mtr_documents", entity_id: docId, bucket: "mtrs" });
      await updateDoc.mutateAsync({ id: docId, body: { file_attachment_id: attachment_id } });
      await docs.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function runExtraction(docId: string) {
    setError(null);
    try {
      const result = await extract.mutateAsync(docId);
      setEdited({
        yield_strength: result.extracted.yield_strength != null ? String(result.extracted.yield_strength) : "",
        tensile_strength: result.extracted.tensile_strength != null ? String(result.extracted.tensile_strength) : "",
        mill_name: result.extracted.mill_name ?? "",
      });
      await docs.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    }
  }

  async function verify(docId: string) {
    setError(null);
    try {
      await updateDoc.mutateAsync({
        id: docId,
        body: {
          ocr_status: "verified",
          ...(edited ? {
            yield_strength: edited.yield_strength ? Number(edited.yield_strength) : null,
            tensile_strength: edited.tensile_strength ? Number(edited.tensile_strength) : null,
            mill_name: edited.mill_name || null,
          } : {}),
        },
      });
      await docs.refetch();
      setEdited(null);
      setActiveDocId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed — only QC/Owner can verify an MTR");
    }
  }

  async function openFile(fileId: string) {
    try {
      const { url } = await FabAPI.signRead(fileId);
      window.open(url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot open file");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="card" style={{ width: 560, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header" style={{ position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 5 }}>
          <div>
            <div className="card-title">MTR documents</div>
            <div className="card-sub font-mono">{heat.heat_number} · {heat.material_grade}</div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {heat.status === "quarantine" && (
            <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>
              This heat is in quarantine — fabrication is blocked until at least one MTR here is verified.
            </div>
          )}

          {(docs.data ?? []).map((doc) => (
            <div key={doc.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>{new Date(doc.created_at).toLocaleString()}</span>
                <StatusPill status={doc.ocr_status} size="sm" />
              </div>

              {!doc.file_attachment_id ? (
                <button className="btn btn-sm" disabled={uploading} onClick={() => { setActiveDocId(doc.id); fileRef.current?.click(); }}>
                  {uploading && activeDocId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Attach MTR file
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <button className="text-[12px] text-left" style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    onClick={() => openFile(doc.file_attachment_id!)}>
                    View attached MTR file
                  </button>

                  {doc.ocr_status === "pending" && (
                    <button className="btn btn-sm" disabled={extract.isPending} onClick={() => runExtraction(doc.id)}>
                      {extract.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Extract with AI
                    </button>
                  )}

                  {(doc.ocr_status === "extracted" || doc.ocr_status === "manual_review") && (
                    <div className="grid-2" style={{ gap: 8 }}>
                      <Field label="Yield (ksi)">
                        <input className="input" type="number" step="0.1"
                          value={activeDocId === doc.id && edited ? edited.yield_strength : (doc.yield_strength ?? "")}
                          onChange={(e) => setEdited((prev) => ({ ...(prev ?? { yield_strength: "", tensile_strength: "", mill_name: doc.mill_name ?? "" }), yield_strength: e.target.value }))}
                          onFocus={() => setActiveDocId(doc.id)}
                        />
                      </Field>
                      <Field label="Tensile (ksi)">
                        <input className="input" type="number" step="0.1"
                          value={activeDocId === doc.id && edited ? edited.tensile_strength : (doc.tensile_strength ?? "")}
                          onChange={(e) => setEdited((prev) => ({ ...(prev ?? { yield_strength: doc.yield_strength != null ? String(doc.yield_strength) : "", tensile_strength: "", mill_name: doc.mill_name ?? "" }), tensile_strength: e.target.value }))}
                          onFocus={() => setActiveDocId(doc.id)}
                        />
                      </Field>
                      <div style={{ gridColumn: "span 2" }}>
                        <Field label="Mill">
                          <input className="input"
                            value={activeDocId === doc.id && edited ? edited.mill_name : (doc.mill_name ?? "")}
                            onChange={(e) => setEdited((prev) => ({ ...(prev ?? { yield_strength: doc.yield_strength != null ? String(doc.yield_strength) : "", tensile_strength: doc.tensile_strength != null ? String(doc.tensile_strength) : "", mill_name: "" }), mill_name: e.target.value }))}
                            onFocus={() => setActiveDocId(doc.id)}
                          />
                        </Field>
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <button className="btn btn-sm btn-primary" onClick={() => verify(doc.id)}>
                          <ShieldCheck size={12} /> Verify &amp; release quarantine
                        </button>
                      </div>
                    </div>
                  )}

                  {doc.ocr_status === "verified" && (
                    <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                      Yield {doc.yield_strength ?? "—"} ksi · Tensile {doc.tensile_strength ?? "—"} ksi · {doc.mill_name ?? "mill n/a"}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {(docs.data ?? []).length === 0 && (
            <div className="text-[12px] p-4 rounded text-center" style={{ background: "var(--bg-muted)", color: "var(--muted)" }}>
              No MTR documents yet
            </div>
          )}

          {error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}

          <button className="btn btn-sm" onClick={startNewDoc} disabled={createDoc.isPending}>
            {createDoc.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            New MTR document
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf,image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && activeDocId) handleFile(f, activeDocId);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}
