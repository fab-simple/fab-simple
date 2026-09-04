"use client";

import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate, useImportMaterialRequirements } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import type { ImportMaterialRequirementsRow, ImportMaterialRequirementsResult } from "@/lib/api";
import { Plus, Loader2, X, CheckCircle2, Layers } from "lucide-react";

interface MaterialRequirement {
  id: string; mr_number: string; profile: string; name: string | null; grade: string | null;
  quantity: number; length: string | null; required_date: string | null; status: string;
  notes: string | null;
}

// Shape of a part row as returned by useResourceList("parts")
interface PartRow {
  id: string;
  part_mark: string;
  profile: string;
  name: string | null;
  grade: string | null;
  length: string | null;
  quantity: number;
}

// Material Requirements are a per-(profile, name, grade, length) aggregate.
// Part Mark is preserved in `notes` for traceability. A blank profile or
// non-positive quantity is skipped, surfaced as a skipped-row count in the preview.
interface AggregatedRow extends ImportMaterialRequirementsRow {
  sourceRowCount: number;
}

function aggregateParts(parts: PartRow[]): { aggregated: AggregatedRow[]; skippedCount: number } {
  const groups = new Map<string, AggregatedRow & { marksSet: Set<string> }>();
  let skippedCount = 0;

  for (const part of parts) {
    const profile = part.profile?.trim() ?? "";
    const qty = Number(part.quantity) || 0;
    if (!profile || !(qty > 0)) { skippedCount++; continue; }

    const name = part.name?.trim() || "";
    const grade = part.grade?.trim() || "";
    const length = part.length?.trim() || "";
    const mark = part.part_mark?.trim() || "";

    const key = [profile, name, grade, length].join("\x01");
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += qty;
      existing.sourceRowCount += 1;
      if (mark) existing.marksSet.add(mark);
    } else {
      groups.set(key, {
        profile,
        name: name || undefined,
        grade: grade || undefined,
        length: length || undefined,
        quantity: qty,
        sourceRowCount: 1,
        marksSet: new Set(mark ? [mark] : []),
      });
    }
  }

  const aggregated = Array.from(groups.values())
    .map(({ marksSet, ...rest }) => ({ ...rest, notes: marksSet.size > 0 ? Array.from(marksSet).join(", ") : undefined }))
    .sort((a, b) => a.profile.localeCompare(b.profile) || (a.name ?? "").localeCompare(b.name ?? "") || (a.grade ?? "").localeCompare(b.grade ?? ""));

  return { aggregated, skippedCount };
}

export default function MaterialRequirementsPage() {
  const { selectedProjectId } = useGlobalProject();
  const list = useResourceList<MaterialRequirement>("material_requirements", selectedProjectId
    ? { project_id: selectedProjectId, order_by: "created_at", dir: "desc", per_page: 200 }
    : { order_by: "created_at", dir: "desc", per_page: 200 });
  const create = useCreate<MaterialRequirement>("material_requirements");
  const [showNew, setShowNew] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const cols: Column<MaterialRequirement>[] = [
    { key: "num", label: "MR #", mono: true, render: (r) => <strong>{r.mr_number}</strong> },
    { key: "profile", label: "Profile", mono: true, render: (r) => r.profile },
    { key: "name", label: "Name", render: (r) => r.name ?? "—" },
    { key: "grade", label: "Grade", render: (r) => r.grade ?? "—" },
    { key: "qty", label: "Quantity", align: "right", mono: true, render: (r) => r.quantity },
    { key: "len", label: "Length", align: "right", mono: true, render: (r) => r.length ?? "—" },
    { key: "notes", label: "Notes", render: (r) => r.notes ?? "—" },
    { key: "req", label: "Required by", render: (r) => r.required_date ? new Date(r.required_date).toLocaleDateString() : "—" },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  const openCount = (list.data ?? []).filter((m) => m.status === "open").length;

  return (
    <PageWrapper title="Material Requirements">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Material Requirements</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {list.data?.length ?? 0} requirements · {openCount} open
            {" · raise a need here, then bundle it onto an RFQ to shop it to vendors"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-subtle" onClick={() => setShowGenerate(true)} disabled={!selectedProjectId}>
            <Layers size={14} /> Generate from Parts
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)} disabled={!selectedProjectId}>
            <Plus size={14} /> New requirement
          </button>
        </div>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No material requirements yet", subtitle: "Click \"Generate from Parts\" to auto-create requirements from your imported parts list, or add one manually." }} rowKey={(r) => r.id} />

      {showNew && selectedProjectId && (
        <NewModal projectId={selectedProjectId} onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}

      {showGenerate && selectedProjectId && (
        <GenerateFromPartsModal projectId={selectedProjectId} onClose={() => setShowGenerate(false)} />
      )}
    </PageWrapper>
  );
}

function NewModal({ projectId, onClose, onSubmit, submitting, error }: {
  projectId: string; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({
    profile: "", name: "", grade: "", quantity: "1", length: "", weight: "", required_date: "", notes: "",
  });
  return (
    <ResourceModal title="New material requirement" onClose={onClose} submitting={submitting} error={error}
      submitDisabled={!f.profile.trim() || !f.name.trim()}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: projectId,
          profile: f.profile.trim(),
          name: f.name.trim(),
          grade: f.grade || undefined,
          quantity: Number(f.quantity),
          length: f.length.trim() || undefined,
          weight: f.weight ? Number(f.weight) : undefined,
          required_date: f.required_date || undefined,
          notes: f.notes || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Profile" required><input className="input" required value={f.profile} onChange={(e) => setF({ ...f, profile: e.target.value })} placeholder="W14x82" /></Field>
        <Field label="Name / Description" required><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="COLUMN" /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Grade"><input className="input" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} placeholder="A992" /></Field>
        <Field label="Quantity" required><input className="input" type="number" min="0.01" step="0.01" required value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Length"><input className="input" value={f.length} onChange={(e) => setF({ ...f, length: e.target.value })} placeholder={'26\'-9 9/16"'} /></Field>
        <Field label="Weight (lb)"><input className="input" type="number" step="0.01" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></Field>
      </div>
      <Field label="Required by"><input className="input" type="date" value={f.required_date} onChange={(e) => setF({ ...f, required_date: e.target.value })} /></Field>
      <Field label="Notes"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} /></Field>
    </ResourceModal>
  );
}

// ===========================================================================
// Generate Material Requirements from already-imported parts data.
// Reads parts for the selected project from the DB, aggregates them by
// (profile, name, grade, length) — identical logic to the old sheet upload
// but without any file or column-mapping step since parts are already typed.
// ===========================================================================

function GenerateFromPartsModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const importMr = useImportMaterialRequirements();
  const [result, setResult] = useState<ImportMaterialRequirementsResult | null>(null);

  // Fetch all parts for this project (up to 2000 — covers any realistic job).
  const partsQuery = useResourceList<PartRow>("parts", {
    project_id: projectId,
    order_by: "part_mark",
    dir: "asc",
    per_page: 2000,
  });

  const parts = partsQuery.data ?? [];

  const { aggregated, skippedCount } = useMemo(
    () => aggregateParts(parts),
    [parts],
  );

  const canImport = aggregated.length > 0 && !partsQuery.isLoading;

  function handleImport() {
    if (!canImport) return;
    const rows: ImportMaterialRequirementsRow[] = aggregated.map((row) => ({
      profile: row.profile,
      name: row.name,
      grade: row.grade,
      quantity: row.quantity,
      length: row.length,
      notes: row.notes,
    }));
    importMr.mutate({ project_id: projectId, rows }, { onSuccess: (res) => setResult(res) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="card" style={{ width: 760, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg-card)" }}>
          <div>
            <div className="card-title">Generate Material Requirements from Parts</div>
            <div className="card-sub">
              Parts already imported for this project are grouped by profile + name + grade + length — no re-upload needed
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm" style={{ padding: 6, height: 28, width: 28, justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {result ? (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg border"
                style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.3)" }}>
                <CheckCircle2 size={16} style={{ color: "var(--green)" }} />
                <span className="text-[13px]" style={{ color: "var(--text)" }}>
                  Imported <strong>{result.summary.inserted}</strong> material requirement{result.summary.inserted === 1 ? "" : "s"}
                  {result.summary.errors > 0 && <span style={{ color: "#DC2626" }}> · {result.summary.errors} failed</span>}
                </span>
              </div>
              {result.errors.length > 0 && (
                <details open>
                  <summary className="text-[13px] font-semibold cursor-pointer" style={{ color: "#DC2626" }}>
                    Errors ({result.errors.length})
                  </summary>
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex gap-2 py-1" style={{ borderBottom: "1px solid var(--bg-muted)" }}>
                        <span style={{ width: 50 }}>row {e.row}</span>
                        <span>{e.reason}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <div className="flex justify-end gap-2">
                <button className="btn btn-primary" onClick={onClose}>Done</button>
              </div>
            </>
          ) : partsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[13px]" style={{ color: "var(--muted)" }}>
              <Loader2 size={16} className="animate-spin" /> Loading parts…
            </div>
          ) : partsQuery.error ? (
            <div className="text-[13px] py-4" style={{ color: "#DC2626" }}>
              Failed to load parts: {partsQuery.error.message}
            </div>
          ) : parts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Layers size={32} style={{ color: "var(--muted)" }} />
              <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>No parts imported yet</div>
              <div className="text-[12px]" style={{ color: "var(--muted)", maxWidth: 360 }}>
                Import a Tekla / SDS2 sheet on the <strong>Import Tekla Model</strong> page first —
                material requirements will be generated automatically from those parts.
              </div>
            </div>
          ) : (
            <>
              {/* Source info banner */}
              <div className="flex items-center gap-2 p-3 rounded-lg border text-[12px]"
                style={{ background: "rgba(79,70,229,0.05)", borderColor: "rgba(79,70,229,0.2)", color: "var(--muted)" }}>
                <Layers size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                <span>
                  Using <strong style={{ color: "var(--text)" }}>{parts.length} part{parts.length === 1 ? "" : "s"}</strong> already
                  imported for this project — grouped into{" "}
                  <strong style={{ color: "var(--text)" }}>{aggregated.length} requirement{aggregated.length === 1 ? "" : "s"}</strong>
                  {skippedCount > 0 && (
                    <span style={{ color: "#D97706" }}> · {skippedCount} skipped (missing profile or quantity)</span>
                  )}
                </span>
              </div>

              {/* Preview table */}
              <div>
                <div className="text-[11px] uppercase font-semibold tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>
                  Preview — {aggregated.length} requirement{aggregated.length === 1 ? "" : "s"} after grouping
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, maxHeight: 320, overflowY: "auto" }}>
                  <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-card)" }}>
                        <th className="text-left p-2">Profile</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Grade</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-left p-2">Length</th>
                        <th className="text-left p-2">Part Marks (Notes)</th>
                        <th className="text-right p-2">Source parts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregated.map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="p-2 font-mono">{row.profile}</td>
                          <td className="p-2">{row.name ?? "—"}</td>
                          <td className="p-2">{row.grade ?? "—"}</td>
                          <td className="p-2 text-right font-mono">{row.quantity}</td>
                          <td className="p-2">{row.length ?? "—"}</td>
                          <td className="p-2" style={{ color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.notes ?? "—"}</td>
                          <td className="p-2 text-right font-mono" style={{ color: "var(--muted)" }}>{row.sourceRowCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {importMr.error && (
                <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{importMr.error.message}</div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="btn">Cancel</button>
                <button type="button" className="btn btn-primary" disabled={!canImport || importMr.isPending} onClick={handleImport}>
                  {importMr.isPending ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
                  {importMr.isPending ? "Importing…" : `Import ${aggregated.length || ""} requirement${aggregated.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
