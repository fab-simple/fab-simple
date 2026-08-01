"use client";

import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate, useImportMaterialRequirements } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import type { ImportMaterialRequirementsRow, ImportMaterialRequirementsResult } from "@/lib/api";
import {
  ACCEPT_EXT, ACCEPT_MIME, isExcelFile, parseSheetFile, autoDetectMapping, type MappableField,
} from "@/lib/sheet-import";
import { Plus, Upload, FileText, Loader2, X, CheckCircle2 } from "lucide-react";

interface MaterialRequirement {
  id: string; mr_number: string; profile: string; name: string | null; grade: string | null;
  quantity: number; length: string | null; required_date: string | null; status: string;
  notes: string | null;
}

// Material Requirements are a per-(profile, name, grade, length) aggregate,
// not a per-piece record — so unlike the Tekla/SDS2 parts importer,
// KISS/EJE-style sheet uploads here fold matching rows together (see
// aggregateRows below) rather than inserting one row per line.
//
// "Profile Size" and "Profile Name" both commonly appear in these sheets:
// the former is the actual section (maps to `profile`), the latter is a
// primary classification label like "COLUMN" or "CRANE_BEAM" (maps to its
// own `name` field — it matters as much as profile/grade for identifying
// what's being requested, so it's required, not folded into notes). Part
// Mark, by contrast, is a piece-level identifier with no purchasing-level
// meaning on an aggregate requirement — it's preserved in `notes` (the list
// of marks that rolled into each group) purely for traceability.
const MR_FIELDS: MappableField[] = [
  { key: "profile", label: "Profile / Section", required: true,
    aliases: ["profilesize", "profile size", "profile_size", "profile", "section", "shape", "size", "sectionsize", "section_size"] },
  { key: "name", label: "Name / Description", required: true,
    aliases: ["profilename", "profile name", "profile_name", "name", "description", "desc", "membertype", "member type", "type"] },
  { key: "grade", label: "Grade / Material",
    aliases: ["grade", "material", "material grade", "material_grade", "spec", "matl"] },
  { key: "quantity", label: "Quantity", required: true,
    aliases: ["qty", "quantity", "count", "pcs", "pieces", "no_of_pieces", "no of pieces"] },
  { key: "length", label: "Length",
    aliases: ["cutlength", "cut length", "cut_length", "length", "len", "length_mm", "length_in", "length_ft"] },
  { key: "notes", label: "Notes (e.g. Part Mark, kept for traceability)",
    aliases: ["mark", "part mark", "part_mark", "partmark", "piecemark", "piece mark", "part id", "partid", "member_mark", "member mark"] },
];

interface AggregatedRow extends ImportMaterialRequirementsRow {
  sourceRowCount: number;
}

// Folds piece-level sheet rows sharing the same (profile, name, grade,
// length) into one aggregated requirement, summing quantity and collecting
// the distinct Part Marks that rolled into it into `notes`. A blank profile
// or non-positive quantity drops the row (surfaced as a skipped-row count
// in the preview) rather than producing an invalid material_requirements row.
function aggregateRows(rows: Record<string, string>[], mapping: Record<string, string>): { aggregated: AggregatedRow[]; skippedCount: number } {
  const groups = new Map<string, AggregatedRow & { marksSet: Set<string> }>();
  let skippedCount = 0;

  for (const row of rows) {
    const profile = (mapping.profile ? row[mapping.profile] : "")?.trim() ?? "";
    const qty = Number((mapping.quantity ? row[mapping.quantity] : "")?.trim() || "0");
    if (!profile || !(qty > 0)) { skippedCount++; continue; }

    const name = (mapping.name ? row[mapping.name] : "")?.trim() || "";
    const grade = (mapping.grade ? row[mapping.grade] : "")?.trim() || "";
    const length = (mapping.length ? row[mapping.length] : "")?.trim() || "";
    const mark = (mapping.notes ? row[mapping.notes] : "")?.trim() || "";

    const key = [profile, name, grade, length].join("");
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += qty;
      existing.sourceRowCount += 1;
      if (mark) existing.marksSet.add(mark);
    } else {
      groups.set(key, {
        profile, name: name || undefined, grade: grade || undefined, length: length || undefined,
        quantity: qty, sourceRowCount: 1, marksSet: new Set(mark ? [mark] : []),
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
    ? { project_id: selectedProjectId, order_by: "created_at", dir: "desc" }
    : { order_by: "created_at", dir: "desc" });
  const create = useCreate<MaterialRequirement>("material_requirements");
  const [showNew, setShowNew] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

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
          <button className="btn btn-subtle" onClick={() => setShowUpload(true)} disabled={!selectedProjectId}>
            <Upload size={14} /> Upload sheet
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)} disabled={!selectedProjectId}>
            <Plus size={14} /> New requirement
          </button>
        </div>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No material requirements yet", subtitle: "Raise a requirement to start sourcing material for this project." }} rowKey={(r) => r.id} />

      {showNew && selectedProjectId && (
        <NewModal projectId={selectedProjectId} onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}

      {showUpload && selectedProjectId && (
        <UploadSheetModal projectId={selectedProjectId} onClose={() => setShowUpload(false)} />
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
// KISS/EJE/Tekla/SDS2-style material list upload — parse -> map columns ->
// aggregate by (profile, name, grade, length) -> preview -> import.
// ===========================================================================

function UploadSheetModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const importMr = useImportMaterialRequirements();

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportMaterialRequirementsResult | null>(null);

  async function handleFileChange(f: File | null) {
    setFile(f);
    setResult(null);
    setParseError(null);
    setHeaders([]);
    setParsedRows([]);
    setMapping({});
    if (!f) return;

    setParsing(true);
    try {
      const rows = await parseSheetFile(f);
      if (rows.length === 0) {
        throw new Error("No rows found in file. Check that the first row contains column headers.");
      }
      const hdrs = Object.keys(rows[0]);
      setParsedRows(rows);
      setHeaders(hdrs);
      setMapping(autoDetectMapping(hdrs, MR_FIELDS));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to read file");
    } finally {
      setParsing(false);
    }
  }

  const { aggregated, skippedCount } = useMemo(
    () => aggregateRows(parsedRows, mapping),
    [parsedRows, mapping],
  );

  // Sheet columns that don't map to any MR field. With Profile Size ->
  // profile, Profile Name -> name, Cut Length -> length, Grade -> grade, and
  // Part Mark -> notes, a typical KISS/EJE sheet maps every column; this is
  // just a safety net for anything genuinely unaccounted for.
  const unmappedHeaders = headers.filter((h) => !Object.values(mapping).includes(h));

  const canImport = !!mapping.profile && !!mapping.name && !!mapping.quantity && aggregated.length > 0;

  function handleImport() {
    if (!canImport) return;
    const rows: ImportMaterialRequirementsRow[] = aggregated.map((row) => ({
      profile: row.profile, name: row.name, grade: row.grade, quantity: row.quantity, length: row.length, notes: row.notes,
    }));
    importMr.mutate({ project_id: projectId, rows }, { onSuccess: (res) => setResult(res) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="card" style={{ width: 760, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg-card)" }}>
          <div>
            <div className="card-title">Upload material list</div>
            <div className="card-sub">KISS, EJE, Tekla/SDS2, or any CSV/XLSX material list — rows are grouped by profile + name + grade + length before import</div>
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
          ) : (
            <>
              <div style={{
                border: "2px dashed var(--border)", borderRadius: 8, padding: 24,
                textAlign: "center", background: "var(--bg-muted)",
              }}>
                <FileText size={24} style={{ margin: "0 auto", color: "var(--muted)", marginBottom: 8 }} />
                <input
                  id="mr-sheet-input" type="file" accept={`${ACCEPT_EXT},${ACCEPT_MIME}`}
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  style={{ display: "none" }}
                />
                <label htmlFor="mr-sheet-input" className="btn btn-primary" style={{ cursor: "pointer" }}>
                  <Upload size={14} /> Choose file
                </label>
                <div className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                  Accepts <code>.csv</code>, <code>.tsv</code>, <code>.xlsx</code>, <code>.xls</code>
                </div>
                {file && (
                  <div className="text-[12px] mt-2" style={{ color: "var(--text)" }}>
                    Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                    <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>{isExcelFile(file) ? "XLSX" : "CSV"}</span>
                  </div>
                )}
                {parsing && (
                  <div className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                    <Loader2 size={11} className="animate-spin inline" /> Reading columns…
                  </div>
                )}
                {parseError && <div className="text-[11px] mt-2" style={{ color: "#DC2626" }}>{parseError}</div>}
              </div>

              {headers.length > 0 && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
                        Column mapping — {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"} detected
                      </label>
                      <button type="button" className="btn btn-sm" onClick={() => setMapping(autoDetectMapping(headers, MR_FIELDS))}>
                        Reset to auto-detected
                      </button>
                    </div>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                      {MR_FIELDS.map((field, idx) => {
                        const chosen = mapping[field.key] ?? "";
                        const sample = chosen ? parsedRows[0]?.[chosen] : "";
                        return (
                          <div key={field.key} className="flex items-center gap-3 px-3 py-2 text-[12px]"
                            style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined }}>
                            <span style={{ width: 220 }}>
                              {field.label}{field.required && <span style={{ color: "#DC2626" }}> *</span>}
                            </span>
                            <select
                              className="input" style={{ height: 30, fontSize: 12, flex: 1 }}
                              value={chosen}
                              onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                            >
                              <option value="">— not mapped —</option>
                              {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span className="font-mono text-[11px]" style={{ width: 140, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {sample || "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {unmappedHeaders.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                          Ignored columns — no Material Requirement field for these, so they&apos;re not imported:
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {unmappedHeaders.map((h) => (
                            <span key={h} className="pill" style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E" }}>{h}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[11px] uppercase font-semibold tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>
                      Preview — {aggregated.length} requirement{aggregated.length === 1 ? "" : "s"} after grouping
                      {skippedCount > 0 && <span style={{ color: "#D97706" }}> · {skippedCount} row{skippedCount === 1 ? "" : "s"} skipped (missing profile or quantity)</span>}
                    </div>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, maxHeight: 220, overflowY: "auto" }}>
                      <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-card)" }}>
                            <th className="text-left p-2">Profile</th>
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Grade</th>
                            <th className="text-right p-2">Qty</th>
                            <th className="text-left p-2">Length</th>
                            <th className="text-left p-2">Notes</th>
                            <th className="text-right p-2">Source rows</th>
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
                              <td className="p-2" style={{ color: "var(--muted)" }}>{row.notes ?? "—"}</td>
                              <td className="p-2 text-right font-mono" style={{ color: "var(--muted)" }}>{row.sourceRowCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {importMr.error && (
                <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{importMr.error.message}</div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="btn">Cancel</button>
                <button type="button" className="btn btn-primary" disabled={!canImport || importMr.isPending} onClick={handleImport}>
                  {importMr.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
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
