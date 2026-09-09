"use client";

// =============================================================================
// Import Tekla / SDS2 BOM Modal
//
// Modal for importing BOM exports from Tekla Structures, SDS2, and structural
// CAD software into the FabSimple Parts database.
// Supports: KISS (.kss), EJE (.eje), CSV/TSV, and Excel (.xlsx, .xls).
//
// Matches the multi-format experience provided by BomEstimateImport in the
// Estimation module while plugging into the high-performance batch import pipeline.
// =============================================================================

import { useState, useRef, useCallback, useMemo } from "react";
import {
  Upload, FileSpreadsheet, FileText, Loader2, CheckCircle2,
  AlertCircle, X,
} from "lucide-react";
import {
  ACCEPT_EXT, ACCEPT_MIME, parseSheetFile,
  getFileFormatBadge, autoDetectMapping as autoDetectMappingGeneric,
  type MappableField,
} from "@/lib/sheet-import";
import { FabAPI } from "@/lib/api";
import { useResourceList } from "@/hooks/useResource";
import { useToast } from "@/components/ui/Toast";

interface Project {
  id: string;
  name: string;
  number: string;
}

interface ImportResult {
  summary: {
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
    units: string;
    mr_created?: number;
    mr_updated?: number;
  };
  skipped: Array<{ row: number; part_mark?: string; reason: string }>;
  errors: Array<{ row: number; reason: string }>;
  mapping?: { matched_fields: string[]; unmapped_headers: string[] };
}

type PipelineStage =
  | "preparing"
  | "batching_parts"
  | "aggregating_assemblies"
  | "syncing_mr"
  | "complete"
  | "error";

const PART_FIELDS: MappableField[] = [
  {
    key: "part_mark", label: "Part Mark", required: true,
    aliases: ["mark", "part mark", "part_mark", "partmark", "piecemark", "piece mark", "part id", "partid", "part_pos", "member_mark", "member mark"],
  },
  {
    key: "quantity", label: "Quantity",
    aliases: ["qty", "quantity", "count", "pcs", "pieces", "no_of_pieces", "no of pieces"],
  },
  {
    key: "profile", label: "Profile Size",
    aliases: ["profile", "section", "shape", "size", "profile size", "profile_size", "profilesize", "section_size", "sectionsize"],
  },
  {
    key: "name", label: "Profile Name",
    aliases: ["profile name", "profile_name", "profilename", "name", "member_name", "member name", "member type", "membertype", "description", "desc", "type"],
  },
  {
    key: "length", label: "Length",
    aliases: ["length", "len", "length_mm", "length_in", "length_ft", "cut_length", "cut length"],
  },
  {
    key: "grade", label: "Grade",
    aliases: ["grade", "material", "material grade", "material_grade", "spec", "matl"],
  },
  {
    key: "weight", label: "Part Weight",
    aliases: ["part weight", "part_weight", "partweight", "weight", "wt", "weight_lbs", "weight_lb", "weight_kg", "weight_ea", "weight_net", "weight net", "weight_gross", "weight gross", "unit_weight", "unit weight", "unitweight", "ext_weight", "ext weight", "extended_weight", "extended weight", "total_weight"],
  },
  {
    key: "heat_number", label: "Heat Number",
    aliases: ["heat number", "heat_number", "heat no", "heat_no", "heat", "heatno", "heat#"],
  },
  {
    key: "assembly_mark", label: "Assembly Mark",
    aliases: ["assembly_mark", "assemblymark", "assembly mark", "assembly", "asm", "assembly_pos", "main_part", "main part"],
  },
  {
    key: "phase", label: "Phase / Lot",
    aliases: ["phase", "lot", "sequence", "seq", "lot_number", "lotnumber"],
  },
];

function autoDetectMapping(headers: string[]): Record<string, string> {
  return autoDetectMappingGeneric(headers, PART_FIELDS);
}

export interface ImportTeklaModalProps {
  open: boolean;
  onClose: () => void;
  initialProjectId?: string | null;
  onSuccess?: () => void;
}

export function ImportTeklaModal({
  open,
  onClose,
  initialProjectId,
  onSuccess,
}: ImportTeklaModalProps) {
  const { toast } = useToast();
  const projects = useResourceList<Project>("projects", { per_page: 100 });

  const [projectId, setProjectId] = useState<string>(initialProjectId ?? "");
  const [units, setUnits] = useState<"auto" | "imperial" | "metric">("auto");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Pipeline progress state
  const [importing, setImporting] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("preparing");
  const [progressPercent, setProgressPercent] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [modalResult, setModalResult] = useState<ImportResult | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Sync initialProjectId if it arrives or changes
  useMemo(() => {
    if (initialProjectId && !projectId) {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId, projectId]);

  const handleFileChange = useCallback(async (f: File | null) => {
    setFile(f);
    setParseError(null);
    setHeaders([]);
    setParsedRows([]);
    setMapping({});
    if (!f) return;

    setParsing(true);
    try {
      const rows = await parseSheetFile(f);
      if (rows.length === 0) {
        throw new Error("No rows found in file. Check that the file contains data rows or valid KISS detail lines.");
      }
      const hdrs = Object.keys(rows[0]!);
      setParsedRows(rows);
      setHeaders(hdrs);
      setMapping(autoDetectMapping(hdrs));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFileChange(f);
    },
    [handleFileChange],
  );

  const handleImport = async () => {
    if (!file || !projectId || parsedRows.length === 0 || !mapping.part_mark) return;
    setImporting(true);
    setPipelineError(null);
    setModalResult(null);
    setPipelineStage("preparing");
    setProgressPercent(10);
    setElapsedSeconds(0);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      setElapsedSeconds(Math.floor(elapsedMs / 1000));

      const estimatedTotalMs = Math.max(2200, Math.min(6500, parsedRows.length * 2.5));

      if (elapsedMs < 300) {
        setPipelineStage("preparing");
        setProgressPercent(Math.min(20, Math.round((elapsedMs / 300) * 20)));
      } else if (elapsedMs < estimatedTotalMs * 0.45) {
        setPipelineStage("batching_parts");
        const stageRatio = (elapsedMs - 300) / (estimatedTotalMs * 0.45 - 300);
        setProgressPercent(Math.min(55, Math.round(20 + stageRatio * 35)));
      } else if (elapsedMs < estimatedTotalMs * 0.75) {
        setPipelineStage("aggregating_assemblies");
        const stageRatio = (elapsedMs - estimatedTotalMs * 0.45) / (estimatedTotalMs * 0.3);
        setProgressPercent(Math.min(80, Math.round(55 + stageRatio * 25)));
      } else {
        setPipelineStage("syncing_mr");
        const creep = Math.min(14, Math.round(((elapsedMs - estimatedTotalMs * 0.75) / 2000) * 14));
        setProgressPercent(Math.min(94, 80 + creep));
      }
    }, 100);

    try {
      const mappedRows = parsedRows.map((row) => {
        const out: Record<string, string> = {};
        for (const field of PART_FIELDS) {
          const header = mapping[field.key];
          if (header && row[header] !== undefined) out[field.key] = row[header];
        }
        return out;
      });

      const res = await FabAPI.importCsv({ project_id: projectId, rows: mappedRows, units });
      const r = res as ImportResult;

      clearInterval(interval);
      setProgressPercent(100);
      setPipelineStage("complete");
      setModalResult(r);

      const inserted = r.summary.inserted ?? 0;
      const updated = r.summary.updated ?? 0;
      const skippedCount = r.summary.skipped ?? 0;
      const errorCount = r.summary.errors ?? 0;
      const parts = inserted + updated;

      if (errorCount === 0 && skippedCount === 0) {
        toast(
          parts > 0
            ? `Import complete — ${inserted} part${inserted === 1 ? "" : "s"} added${updated > 0 ? `, ${updated} updated` : ""}`
            : "Import complete — no new parts were added",
          parts > 0 ? "success" : "warning",
        );
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1600);
      } else {
        toast(
          `Import finished with notices: ${parts} parts processed (${skippedCount} skipped, ${errorCount} errors)`,
          "warning",
        );
      }
    } catch (e) {
      clearInterval(interval);
      setPipelineStage("error");
      const msg = e instanceof Error ? e.message : "Import failed";
      setPipelineError(msg);
    } finally {
      setImporting(false);
    }
  };

  const partMarkStats = useMemo(() => {
    const header = mapping.part_mark;
    if (!header) return null;
    const counts = new Map<string, number>();
    for (const row of parsedRows) {
      const v = (row[header] ?? "").trim();
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const duplicates = Array.from(counts.entries()).filter(([, n]) => n > 1);
    return { duplicates, uniqueCount: counts.size, totalRows: parsedRows.length };
  }, [parsedRows, mapping.part_mark]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          width: 780,
          maxWidth: "94vw",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            background: "var(--bg-card)",
            zIndex: 10,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileSpreadsheet size={18} color="white" />
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: "var(--text)" }}>
                Import Tekla / SDS2 BOM
              </div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                KISS (.kss) · CSV/TSV · Excel (.xlsx) · EJE (.eje)
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm"
            style={{ border: "none", padding: 6, height: 28, width: 28, justifyContent: "center" }}
            title="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Project & Units row */}
          <div className="grid-2" style={{ gap: 12 }}>
            <div>
              <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
                Project <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select
                className="input"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={{ marginTop: 4 }}
                disabled={importing}
              >
                <option value="">— select project —</option>
                {(projects.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number ? `${p.number} — ${p.name}` : p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
                Units
              </label>
              <select
                className="input"
                value={units}
                onChange={(e) => setUnits(e.target.value as "auto" | "imperial" | "metric")}
                style={{ marginTop: 4 }}
                disabled={importing}
              >
                <option value="auto">Auto-detect</option>
                <option value="imperial">Imperial (in / lb)</option>
                <option value="metric">Metric (mm / kg)</option>
              </select>
            </div>
          </div>

          {/* Upload Drop Zone */}
          <div>
            <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
              BOM File <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                marginTop: 4,
                border: dragOver ? "2px dashed var(--primary)" : "2px dashed var(--border)",
                borderRadius: 8,
                padding: 24,
                textAlign: "center",
                background: dragOver ? "rgba(79, 70, 229, 0.04)" : "var(--bg-muted)",
                cursor: "pointer",
                transition: "border-color 150ms, background 150ms",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={`${ACCEPT_EXT},${ACCEPT_MIME}`}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
              <Upload size={28} style={{ margin: "0 auto", color: "var(--muted)", marginBottom: 8 }} />
              <div className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
                Drop your BOM file here or click to browse
              </div>

              {/* Supported Format Pills */}
              <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                {[
                  { label: "KISS (.kss)", color: "#2563EB" },
                  { label: "CSV / TSV", color: "#D97706" },
                  { label: "Excel (.xlsx)", color: "#059669" },
                  { label: "EJE (.eje)", color: "#7C3AED" },
                ].map((f) => (
                  <span
                    key={f.label}
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{
                      background: `${f.color}15`,
                      color: f.color,
                      border: `1px solid ${f.color}30`,
                    }}
                  >
                    {f.label}
                  </span>
                ))}
              </div>

              {file && (
                <div className="text-[12px] mt-3 flex items-center justify-center gap-2 flex-wrap" style={{ color: "var(--text)" }}>
                  <span>Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</span>
                  {(() => {
                    const badge = getFileFormatBadge(file);
                    return (
                      <span
                        className="pill font-bold uppercase tracking-wider"
                        style={{
                          fontSize: 10,
                          color: badge.color,
                          background: badge.bg,
                          borderColor: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
              )}

              {parsing && (
                <div className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                  <Loader2 size={11} className="animate-spin inline mr-1" /> Reading columns & members…
                </div>
              )}

              {parseError && (
                <div className="text-[11px] mt-2 font-medium" style={{ color: "#DC2626" }}>
                  {parseError}
                </div>
              )}
            </div>
          </div>

          {/* Supported Format Description Cards */}
          <div className="p-3 rounded-lg" style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
            <div className="text-[10px] font-bold tracking-wider mb-2" style={{ color: "var(--muted)" }}>
              SUPPORTED STEEL CAD EXPORTS
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]" style={{ color: "var(--text)" }}>
              <div className="flex items-start gap-2">
                <FileText size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#2563EB" }} />
                <div><strong>KISS (.kss)</strong> — SDS2 / Tekla KISS export with members, plates, marks</div>
              </div>
              <div className="flex items-start gap-2">
                <FileSpreadsheet size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#D97706" }} />
                <div><strong>CSV / TSV</strong> — Tekla BOM report, any shop steel spreadsheet</div>
              </div>
              <div className="flex items-start gap-2">
                <FileSpreadsheet size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#059669" }} />
                <div><strong>Excel (.xlsx)</strong> — SDS2 / Tekla material list export</div>
              </div>
              <div className="flex items-start gap-2">
                <FileText size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#7C3AED" }} />
                <div><strong>EJE (.eje)</strong> — Structural Material Manager export</div>
              </div>
            </div>
          </div>

          {/* Column Mapping Section */}
          {headers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
                  Column Mapping — {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"} detected
                </label>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setMapping(autoDetectMapping(headers))}
                >
                  Reset to auto-detected
                </button>
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
                {PART_FIELDS.map((field, idx) => {
                  const chosen = mapping[field.key] ?? "";
                  const sample = chosen ? parsedRows[0]?.[chosen] : "";
                  return (
                    <div
                      key={field.key}
                      className="flex items-center gap-3"
                      style={{
                        padding: "6px 12px",
                        borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                        background: idx % 2 ? "var(--bg-muted)" : "transparent",
                      }}
                    >
                      <div style={{ width: 140, flexShrink: 0, fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                        {field.label}
                        {field.required && <span style={{ color: "#DC2626" }}> *</span>}
                      </div>
                      <select
                        className="input"
                        style={{ flex: 1, height: 30, fontSize: 12 }}
                        value={chosen}
                        onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                      >
                        <option value="">— not mapped —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      {sample && (
                        <div
                          className="text-[11px]"
                          style={{ color: "var(--muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={sample}
                        >
                          e.g. {sample}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!mapping.part_mark && (
                <div className="text-[11px] mt-1.5" style={{ color: "#DC2626" }}>
                  Map a column to Part Mark before importing.
                </div>
              )}

              {partMarkStats && partMarkStats.duplicates.length > 0 && (
                <div style={{
                  marginTop: 8, background: "#FEF3C7", border: "1px solid #FDE68A",
                  borderRadius: 6, padding: "8px 10px",
                }}>
                  <div className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: "#92400E" }}>
                    <AlertCircle size={12} />
                    {partMarkStats.duplicates.length} duplicate Part Mark{partMarkStats.duplicates.length === 1 ? "" : "s"} found in sheet
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "#92400E" }}>
                    {partMarkStats.totalRows} rows in sheet → collapses into <strong>{partMarkStats.uniqueCount}</strong> unique part records.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Progress & Feedback */}
          {importing && (
            <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin text-indigo-600" />
                  Processing Pipeline — {pipelineStage.replace(/_/g, " ")}
                </span>
                <span className="text-xs font-mono font-bold text-indigo-600">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {pipelineError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {pipelineError}
            </div>
          )}

          {modalResult && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Successfully imported {modalResult.summary.inserted} parts
                {modalResult.summary.updated > 0 ? `, ${modalResult.summary.updated} updated` : ""}.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-muted)",
            position: "sticky",
            bottom: 0,
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={importing}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={!file || !projectId || importing || parsing || headers.length === 0 || !mapping.part_mark}
            onClick={handleImport}
          >
            {importing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Importing…
              </>
            ) : (
              <>
                <Upload size={14} /> Import {parsedRows.length > 0 ? `${parsedRows.length} Parts` : "Parts"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
