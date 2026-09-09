"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useResourceList } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { FabAPI, uploadFile } from "@/lib/api";
import Link from "next/link";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle, Info,
  FileSpreadsheet, Files, X, Sparkles, Database, Link2, ChevronRight,
  PackageCheck, Download, Layers, Clock,
} from "lucide-react";
import type { PartLite, PdfMatchResult } from "@/lib/pdf-parse";
import {
  ACCEPT_EXT, ACCEPT_MIME, parseSheetFile, getFileFormatBadge,
  autoDetectMapping as autoDetectMappingGeneric, type MappableField,
} from "@/lib/sheet-import";
import { useToast } from "@/components/ui/Toast";

interface Project { id: string; name: string; number: string; }

// ===========================================================================
// Column mapping — mirrors the backend's COL_ALIASES priority list
// (supabase/functions/api/controllers/import.ts) so the auto-detected default
// shown here matches what the server would have picked on its own. The user
// can then override any field before the rows are ever sent for import.
// ===========================================================================

type PartField = MappableField;

const PART_FIELDS: PartField[] = [
  {
    key: "part_mark", label: "Part Mark", required: true,
    aliases: ["mark", "part mark", "part_mark", "partmark", "piecemark", "piece mark", "part id", "partid", "part_pos", "member_mark", "member mark"]
  },
  {
    key: "quantity", label: "Quantity",
    aliases: ["qty", "quantity", "count", "pcs", "pieces", "no_of_pieces", "no of pieces"]
  },
  {
    key: "profile", label: "Profile Size",
    // Tekla exports: "Profile", "Profile size", "Section size", "Size"
    aliases: ["profile", "section", "shape", "size", "profile size", "profile_size", "profilesize", "section_size", "sectionsize"]
  },
  {
    key: "name", label: "Profile Name",
    // Tekla exports: "Name", "Profile Name", "Profile name", "Member Name"
    aliases: ["profile name", "profile_name", "profilename", "name", "member_name", "member name", "member type", "membertype", "description", "desc", "type"]
  },
  {
    key: "length", label: "Length",
    aliases: ["length", "len", "length_mm", "length_in", "length_ft", "cut_length", "cut length"]
  },
  {
    key: "grade", label: "Grade",
    aliases: ["grade", "material", "material grade", "material_grade", "spec", "matl"]
  },
  {
    key: "weight", label: "Part Weight",
    // Tekla exports: "Part weight", "Weight", "Unit weight"
    aliases: ["part weight", "part_weight", "partweight", "weight", "wt", "weight_lbs", "weight_lb", "weight_kg", "weight_ea", "weight_net", "weight net", "weight_gross", "weight gross", "unit_weight", "unit weight", "unitweight", "ext_weight", "ext weight", "extended_weight", "extended weight", "total_weight"]
  },
  {
    key: "heat_number", label: "Heat Number",
    aliases: ["heat number", "heat_number", "heat no", "heat_no", "heat", "heatno", "heat#"]
  },
  {
    key: "assembly_mark", label: "Assembly Mark",
    aliases: ["assembly_mark", "assemblymark", "assembly mark", "assembly", "asm", "assembly_pos", "main_part", "main part"]
  },
  {
    key: "phase", label: "Phase / Lot",
    aliases: ["phase", "lot", "sequence", "seq", "lot_number", "lotnumber"]
  },
];

// Default mapping — first header (in sheet order) whose normalised name
// matches a field's alias list wins, same priority order the server uses.
function autoDetectMapping(headers: string[]): Record<string, string> {
  return autoDetectMappingGeneric(headers, PART_FIELDS);
}

// ===========================================================================
// Page shell + tab switcher
// ===========================================================================

type TabId = "bom" | "pdf";

export default function ImportPage() {
  const [tab, setTab] = useState<TabId>("bom");
  const projects = useResourceList<Project>("projects", { per_page: 100 });
  const { selectedProjectId } = useGlobalProject();

  return (
    <PageWrapper title="Import">
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>
            Detailing &amp; Package Upload Portal
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)", maxWidth: 600 }}>
            Sync raw Tekla model metadata and upload PDF drawing sets directly to the shop floor database.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill" style={{ fontSize: 10, background: "#DCFCE7", color: "#166534" }}>
            <Sparkles size={11} style={{ marginRight: 3 }} /> AI part-mark routing
          </span>
        </div>
      </div>

      <TabSwitcher value={tab} onChange={setTab} />

      {tab === "bom"
        ? <BomTab projects={projects.data ?? []} defaultProjectId={selectedProjectId ?? ""} />
        : <PdfPackageTab projects={projects.data ?? []} defaultProjectId={selectedProjectId ?? ""} />
      }
    </PageWrapper>
  );
}

function TabSwitcher({ value, onChange }: { value: TabId; onChange: (v: TabId) => void }) {
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "bom", label: "Import Tekla / SDS2 BOM", icon: <FileSpreadsheet size={14} /> },
    { id: "pdf", label: "Detailing PDF Package (Upload)", icon: <Files size={14} /> },
  ];
  return (
    <div
      className="card"
      style={{
        display: "flex",
        padding: 4,
        gap: 4,
        marginBottom: 20,
        background: "var(--bg-muted)",
        border: "1px solid var(--border)",
      }}
    >
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              background: active ? "var(--bg-card)" : "transparent",
              color: active ? "var(--text)" : "var(--muted)",
              fontWeight: active ? 600 : 500,
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: active ? "var(--shadow-sm)" : "none",
              transition: "background 120ms",
            }}
          >
            {t.icon} {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ===========================================================================
// Tab 1 — Tekla / SDS2 BOM importer (CSV / XLSX)
// ===========================================================================

interface ImportResult {
  summary: {
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
    units: string;
    mr_created?: number;
    mr_updated?: number;
    assemblies_created?: number;
    assemblies_updated?: number;
    drawings_created?: number;
  };
  skipped: Array<{ row: number; part_mark?: string; reason: string }>;
  errors: Array<{ row: number; reason: string }>;
  mapping?: { matched_fields: string[]; unmapped_headers: string[] };
}

function downloadIssuesCsv(
  result: ImportResult,
  parsedRows: Record<string, string>[],
  headers: string[],
  mapping: Record<string, string>
) {
  type IssueItem = {
    sheetRow: number;
    type: "ERROR" | "SKIPPED";
    mark: string;
    reason: string;
    orig: Record<string, string>;
  };

  const items: IssueItem[] = [];

  for (const err of result.errors) {
    const orig = parsedRows[err.row] || {};
    const mark = orig[mapping.part_mark] || "";
    items.push({
      sheetRow: err.row + 2, // Row 1 is header in CSV/XLSX
      type: "ERROR",
      mark,
      reason: err.reason,
      orig,
    });
  }

  for (const skip of result.skipped) {
    const orig = parsedRows[skip.row] || {};
    const mark = skip.part_mark || orig[mapping.part_mark] || "";
    items.push({
      sheetRow: skip.row + 2,
      type: "SKIPPED",
      mark,
      reason: skip.reason,
      orig,
    });
  }

  items.sort((a, b) => a.sheetRow - b.sheetRow);

  const escapeCsv = (val: unknown) => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const outHeaders = ["Sheet Row", "Status", "Issue Reason", "Part Mark", ...headers];
  const csvRows = [outHeaders.map(escapeCsv).join(",")];

  for (const item of items) {
    const row = [
      item.sheetRow,
      item.type,
      item.reason,
      item.mark,
      ...headers.map((h) => item.orig[h] ?? ""),
    ];
    csvRows.push(row.map(escapeCsv).join(","));
  }

  const blob = new Blob([csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bom_import_issues_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type PipelineStage = "preparing" | "batching_parts" | "aggregating_assemblies" | "syncing_mr" | "complete" | "error";

interface ImportProgressModalProps {
  isOpen: boolean;
  stage: PipelineStage;
  progressPercent: number;
  elapsedSeconds: number;
  totalRows: number;
  fileName: string;
  result: ImportResult | null;
  errorMessage: string | null;
  onClose: () => void;
  onGoToParts: () => void;
  onDownloadIssues: () => void;
}

function ImportProgressModal({
  isOpen,
  stage,
  progressPercent,
  elapsedSeconds,
  totalRows,
  fileName,
  result,
  errorMessage,
  onClose,
  onGoToParts,
  onDownloadIssues,
}: ImportProgressModalProps) {
  if (!isOpen) return null;

  const isComplete = stage === "complete";
  const isError = stage === "error";

  const stagesList: { id: PipelineStage; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: "preparing",
      label: "Schema & Field Mapping",
      desc: `${totalRows.toLocaleString()} rows verified against project requirements`,
      icon: <FileSpreadsheet size={15} />,
    },
    {
      id: "batching_parts",
      label: "Parts Batch Pipeline",
      desc: "Bulk insert (500/chunk) + parallel updates with production locks",
      icon: <Layers size={15} />,
    },
    {
      id: "aggregating_assemblies",
      label: "Assembly & Drawing Hierarchy",
      desc: "Computing marks, total assembly weights & drawing series links",
      icon: <Files size={15} />,
    },
    {
      id: "syncing_mr",
      label: "Material Requirements Auto-Sync",
      desc: "Evaluating incremental demand & concurrent MR sequence creation",
      icon: <PackageCheck size={15} />,
    },
  ];

  const getStageStatus = (stageId: PipelineStage) => {
    if (isError) {
      if (stage === stageId) return "error";
      const order: PipelineStage[] = ["preparing", "batching_parts", "aggregating_assemblies", "syncing_mr"];
      const currentIndex = order.indexOf(stage);
      const stageIndex = order.indexOf(stageId);
      if (stageIndex < currentIndex) return "complete";
      return "pending";
    }

    if (isComplete) return "complete";

    const order: PipelineStage[] = ["preparing", "batching_parts", "aggregating_assemblies", "syncing_mr"];
    const currentIndex = order.indexOf(stage);
    const stageIndex = order.indexOf(stageId);

    if (stageIndex < currentIndex) return "complete";
    if (stageIndex === currentIndex) return "active";
    return "pending";
  };

  const getStageDescription = () => {
    switch (stage) {
      case "preparing":
        return "Validating sheet format and mapping canonical fields…";
      case "batching_parts":
        return `Batching parts into database (${totalRows.toLocaleString()} rows)…`;
      case "aggregating_assemblies":
        return "Aggregating assembly marks & drawing revisions…";
      case "syncing_mr":
        return "Calculating unmet steel demand & issuing material requirements…";
      case "complete":
        return "Import & synchronization complete!";
      case "error":
        return "Import encountered an error";
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m > 0 ? `${m}m ` : ""}${s}s`;
  };

  const hasIssues = (result?.summary.skipped ?? 0) > 0 || (result?.summary.errors ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        style={{
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div
          className="p-5 text-white"
          style={{
            background: "linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)",
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                <Database size={18} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold tracking-tight text-white m-0">
                  Tekla BOM Import Pipeline
                </h3>
                <p className="text-[12px] text-slate-300 m-0 truncate max-w-[280px]">
                  {fileName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="pill font-mono"
                style={{
                  fontSize: 10.5,
                  background: totalRows >= 1000 ? "rgba(99, 102, 241, 0.25)" : "rgba(255,255,255,0.12)",
                  color: totalRows >= 1000 ? "#A5B4FC" : "#E2E8F0",
                  borderColor: "rgba(255,255,255,0.15)",
                }}
              >
                {totalRows >= 1000 ? `⚡ High Volume (${totalRows.toLocaleString()})` : `${totalRows.toLocaleString()} rows`}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono bg-white/5 px-2 py-1 rounded">
                <Clock size={11} /> {formatTime(elapsedSeconds)}
              </div>
            </div>
          </div>

          {/* Progress Bar & Status Line */}
          <div className="mt-4 pt-2 border-t border-slate-700/60">
            <div className="flex items-center justify-between text-[11.5px] mb-1.5 font-medium">
              <span className="text-slate-200 flex items-center gap-1.5">
                {!isComplete && !isError && <Loader2 size={12} className="animate-spin text-cyan-400" />}
                {getStageDescription()}
              </span>
              <span className="font-mono text-cyan-300 font-semibold">{progressPercent}%</span>
            </div>

            <div
              className="w-full rounded-full overflow-hidden p-0.5"
              style={{ background: "rgba(255,255,255,0.12)", height: 10 }}
            >
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: isError
                    ? "#DC2626"
                    : isComplete && !hasIssues
                      ? "#16A34A"
                      : "linear-gradient(90deg, #4F46E5 0%, #06B6D4 100%)",
                  boxShadow: isError
                    ? "0 0 10px rgba(220, 38, 38, 0.5)"
                    : "0 0 10px rgba(6, 182, 212, 0.5)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Modal Body: Pipeline Stages */}
        <div className="p-5 space-y-3 bg-slate-50/50">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Execution Stages
          </div>

          <div className="space-y-2">
            {stagesList.map((s, idx) => {
              const status = getStageStatus(s.id);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-xl border transition-all duration-200"
                  style={{
                    background:
                      status === "active"
                        ? "white"
                        : status === "complete"
                          ? "rgba(240, 253, 244, 0.7)"
                          : status === "error"
                            ? "rgba(254, 242, 242, 0.8)"
                            : "rgba(255, 255, 255, 0.4)",
                    borderColor:
                      status === "active"
                        ? "#6366F1"
                        : status === "complete"
                          ? "#BBF7D0"
                          : status === "error"
                            ? "#FECACA"
                            : "#E2E8F0",
                    boxShadow: status === "active" ? "0 4px 12px rgba(99, 102, 241, 0.08)" : "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{
                        background:
                          status === "active"
                            ? "#EEF2FF"
                            : status === "complete"
                              ? "#DCFCE7"
                              : status === "error"
                                ? "#FEE2E2"
                                : "#F1F5F9",
                        color:
                          status === "active"
                            ? "#4F46E5"
                            : status === "complete"
                              ? "#16A34A"
                              : status === "error"
                                ? "#DC2626"
                                : "#94A3B8",
                      }}
                    >
                      {status === "complete" ? (
                        <CheckCircle2 size={16} />
                      ) : status === "active" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : status === "error" ? (
                        <AlertCircle size={16} />
                      ) : (
                        s.icon
                      )}
                    </div>

                    <div>
                      <div
                        className="text-[13px] font-semibold leading-tight"
                        style={{
                          color:
                            status === "active"
                              ? "#1E1B4B"
                              : status === "complete"
                                ? "#14532D"
                                : status === "error"
                                  ? "#991B1B"
                                  : "#64748B",
                        }}
                      >
                        {idx + 1}. {s.label}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                        {s.desc}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 ml-2">
                    {status === "complete" && (
                      <span className="pill" style={{ fontSize: 9.5, background: "#DCFCE7", color: "#166534" }}>
                        Done
                      </span>
                    )}
                    {status === "active" && (
                      <span className="pill" style={{ fontSize: 9.5, background: "#EEF2FF", color: "#4338CA" }}>
                        Processing
                      </span>
                    )}
                    {status === "pending" && (
                      <span className="pill" style={{ fontSize: 9.5, background: "#F1F5F9", color: "#94A3B8" }}>
                        Queued
                      </span>
                    )}
                    {status === "error" && (
                      <span className="pill pill-red" style={{ fontSize: 9.5 }}>
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Results Summary Box when Complete */}
          {isComplete && result && (
            <div
              className="p-3.5 rounded-xl border mt-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
              style={{
                background: hasIssues ? "rgba(254, 243, 199, 0.4)" : "rgba(240, 253, 244, 0.7)",
                borderColor: hasIssues ? "rgba(245, 158, 11, 0.3)" : "rgba(34, 197, 94, 0.3)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold text-slate-800 flex items-center gap-1.5">
                  {hasIssues ? (
                    <AlertCircle size={14} className="text-amber-600" />
                  ) : (
                    <CheckCircle2 size={14} className="text-emerald-600" />
                  )}
                  {hasIssues ? "Import Finished with Notices" : "Import Succeeded Cleanly"}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {(result.summary.inserted ?? 0) + (result.summary.updated ?? 0)} total parts
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-slate-400 uppercase text-[9px] font-semibold">Inserted</div>
                  <div className="text-emerald-600 font-bold text-sm">{result.summary.inserted}</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-slate-400 uppercase text-[9px] font-semibold">Updated</div>
                  <div className="text-blue-600 font-bold text-sm">{result.summary.updated}</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-slate-400 uppercase text-[9px] font-semibold">Skipped</div>
                  <div className={`font-bold text-sm ${result.summary.skipped > 0 ? "text-amber-600" : "text-slate-600"}`}>
                    {result.summary.skipped}
                  </div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-slate-400 uppercase text-[9px] font-semibold">Errors</div>
                  <div className={`font-bold text-sm ${result.summary.errors > 0 ? "text-red-600" : "text-slate-600"}`}>
                    {result.summary.errors}
                  </div>
                </div>
              </div>

              {((result.summary.mr_created ?? 0) > 0 || (result.summary.mr_updated ?? 0) > 0) && (
                <div className="text-[11px] text-indigo-700 mt-2 flex items-center gap-1">
                  <PackageCheck size={13} />
                  <span>
                    Material Requirements: {result.summary.mr_created ?? 0} created
                    {(result.summary.mr_updated ?? 0) > 0 && `, ${result.summary.mr_updated} updated`}.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error Message if Failed */}
          {isError && errorMessage && (
            <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[12px] flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            {!isComplete && !isError ? (
              <span>Do not close window during high-volume batch sync</span>
            ) : isComplete && !hasIssues ? (
              <span className="text-emerald-600 font-medium">Redirecting to Parts List…</span>
            ) : (
              <span>Review notices or export report</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isError && (
              <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
                Close
              </button>
            )}

            {isComplete && hasIssues && (
              <>
                <button
                  type="button"
                  onClick={onDownloadIssues}
                  className="btn btn-sm btn-secondary flex items-center gap-1 text-[11px]"
                >
                  <Download size={12} /> Issues CSV
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-sm btn-secondary text-[11px]"
                >
                  View Details
                </button>
                <button
                  type="button"
                  onClick={onGoToParts}
                  className="btn btn-sm btn-primary flex items-center gap-1 text-[11px]"
                >
                  Parts List <ChevronRight size={12} />
                </button>
              </>
            )}

            {isComplete && !hasIssues && (
              <button
                type="button"
                onClick={onGoToParts}
                className="btn btn-sm btn-primary flex items-center gap-1 text-[11px]"
              >
                Go to Parts Now <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BomTab({ projects, defaultProjectId }: { projects: Project[]; defaultProjectId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [projectId, setProjectId] = useState<string>(defaultProjectId);
  const [file, setFile] = useState<File | null>(null);
  const [units, setUnits] = useState<"auto" | "imperial" | "metric">("auto");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Multi-stage visual progress states for high-volume BOM imports
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("preparing");
  const [progressPercent, setProgressPercent] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [modalResult, setModalResult] = useState<ImportResult | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Parsed sheet + column mapping — populated as soon as a file is chosen so
  // the user can review/override the system-detected mapping before any
  // import happens.
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  async function handleFileChange(f: File | null) {
    setFile(f);
    setResult(null);
    setError(null);
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
      const hdrs = Object.keys(rows[0]);
      setParsedRows(rows);
      setHeaders(hdrs);
      setMapping(autoDetectMapping(hdrs));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!file || !projectId || parsedRows.length === 0 || !mapping.part_mark) return;
    setImporting(true);
    setError(null);
    setResult(null);
    setPipelineError(null);
    setModalResult(null);
    setPipelineStage("preparing");
    setProgressPercent(10);
    setElapsedSeconds(0);
    setShowProgressModal(true);

    const startTime = Date.now();

    // Timer interval to smoothly advance visual stages while HTTP batch request executes
    const interval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      setElapsedSeconds(Math.floor(elapsedMs / 1000));

      // Dynamic time estimate: large BOMs (>1000 rows) take ~3-4s; smaller ones take ~1.5-2s
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
      // Re-key every row from raw sheet headers to canonical field names
      // using the (possibly user-edited) mapping, so the backend receives
      // exactly the columns the user chose — nothing more, nothing less.
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
      setResult(r);

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
        // Show the 100% completed stage screen briefly before redirecting
        setTimeout(() => {
          setShowProgressModal(false);
          router.push("/dashboard/parts");
        }, 1800);
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
      setError(msg);
    } finally {
      setImporting(false);
    }
  }

  const unmappedHeaders = headers.filter((h) => !Object.values(mapping).includes(h));

  // Duplicate Part Mark detection — mirrors the backend's dedup key
  // (project_id, part_mark): rows sharing the same trimmed Mark value
  // collapse into a single part record (2nd+ occurrence updates the 1st
  // instead of inserting), so the sheet's row count and the resulting part
  // count in the system can differ. Surface that gap before import runs.
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

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Tekla / SDS2 BOM Import</div>
            <div className="card-sub">KISS (.kss), CSV, or Excel (.xlsx) export — maps QTY, Mark, Profile, Name, Length, Grade, Part Weight, Heat Number</div>
          </div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid-2" style={{ gap: 12 }}>
            <div>
              <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Project</label>
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ marginTop: 4 }}>
                <option value="">— select project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.number ? `${p.number} — ${p.name}` : p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Units</label>
              <select className="input" value={units} onChange={(e) => setUnits(e.target.value as "auto" | "imperial" | "metric")} style={{ marginTop: 4 }}>
                <option value="auto">Auto-detect</option>
                <option value="imperial">Imperial (in / lb)</option>
                <option value="metric">Metric (mm / kg)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>BOM file</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFileChange(f);
              }}
              style={{
                marginTop: 4,
                border: dragOver ? "2px dashed var(--primary)" : "2px dashed var(--border)",
                borderRadius: 8,
                padding: 24,
                textAlign: "center",
                background: dragOver ? "rgba(79, 70, 229, 0.04)" : "var(--bg-muted)",
                transition: "border-color 150ms, background 150ms",
              }}
            >
              <FileText size={24} style={{ margin: "0 auto", color: "var(--muted)", marginBottom: 8 }} />
              <input
                id="bom-input"
                type="file"
                accept={`${ACCEPT_EXT},${ACCEPT_MIME}`}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
              <label htmlFor="bom-input" className="btn btn-primary" style={{ cursor: "pointer" }}>
                <Upload size={14} /> Choose file
              </label>
              <div className="text-[11px] mt-2 flex items-center justify-center gap-1.5 flex-wrap" style={{ color: "var(--muted)" }}>
                <span>Accepts:</span>
                <span className="font-semibold" style={{ color: "#2563EB" }}>KISS (.kss)</span> ·
                <span className="font-semibold" style={{ color: "#D97706" }}>CSV / TSV</span> ·
                <span className="font-semibold" style={{ color: "#059669" }}>Excel (.xlsx, .xls)</span> ·
                <span className="font-semibold" style={{ color: "#7C3AED" }}>EJE (.eje)</span>
              </div>
              {file && (
                <div className="text-[12px] mt-2 flex items-center justify-center gap-2 flex-wrap" style={{ color: "var(--text)" }}>
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
                  <Loader2 size={11} className="animate-spin inline" /> Reading columns…
                </div>
              )}
              {parseError && (
                <div className="text-[11px] mt-2" style={{ color: "#DC2626" }}>{parseError}</div>
              )}
            </div>
          </div>

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
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {PART_FIELDS.map((field, idx) => {
                  const chosen = mapping[field.key] ?? "";
                  const sample = chosen ? parsedRows[0]?.[chosen] : "";
                  return (
                    <div
                      key={field.key}
                      className="flex items-center gap-3"
                      style={{
                        padding: "8px 12px",
                        borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                        background: idx % 2 ? "var(--bg-muted)" : "transparent",
                      }}
                    >
                      <div style={{ width: 160, flexShrink: 0, fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                        {field.label}
                        {field.required && <span style={{ color: "#DC2626" }}> *</span>}
                      </div>
                      <select
                        className="input"
                        style={{ flex: 1 }}
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
                          style={{ width: 140, flexShrink: 0, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={sample}
                        >
                          e.g. &quot;{sample}&quot;
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
              {unmappedHeaders.length > 0 && (
                <div className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
                  Not mapped (ignored on import): {unmappedHeaders.join(", ")}
                </div>
              )}
              {partMarkStats && partMarkStats.duplicates.length > 0 && (
                <div style={{
                  marginTop: 8, background: "#FEF3C7", border: "1px solid #FDE68A",
                  borderRadius: 6, padding: "8px 10px",
                }}>
                  <div className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: "#92400E" }}>
                    <AlertCircle size={12} />
                    {partMarkStats.duplicates.length} duplicate Part Mark{partMarkStats.duplicates.length === 1 ? "" : "s"} found in the sheet
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: "#92400E" }}>
                    {partMarkStats.duplicates.slice(0, 10).map(([mark, n]) => `${mark} (×${n})`).join(", ")}
                    {partMarkStats.duplicates.length > 10 ? `, +${partMarkStats.duplicates.length - 10} more` : ""}
                    {" "}— rows sharing the same Part Mark are not imported as separate parts; each later duplicate updates the same record instead of creating a new one.
                  </div>
                </div>
              )}
              {partMarkStats && (
                <div className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
                  {partMarkStats.totalRows} row{partMarkStats.totalRows === 1 ? "" : "s"} in sheet → this import will result in{" "}
                  <strong>{partMarkStats.uniqueCount}</strong> part{partMarkStats.uniqueCount === 1 ? "" : "s"} in the system.
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {error && <span className="pill pill-red" style={{ padding: "6px 10px", fontSize: 12 }}>{error}</span>}
            <button
              className="btn btn-primary"
              disabled={!file || !projectId || importing || parsing || headers.length === 0 || !mapping.part_mark}
              onClick={handleImport}
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? "Importing & syncing…" : "Import parts"}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="card mt-section">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="card-title">Import results</div>
              <span className="pill" style={{ fontSize: 10 }}>Units: {result.summary.units}</span>
            </div>
            <div className="flex items-center gap-2">
              {(result.skipped.length > 0 || result.errors.length > 0) && (
                <button
                  type="button"
                  onClick={() => downloadIssuesCsv(result, parsedRows, headers, mapping)}
                  className="btn btn-sm btn-secondary flex items-center gap-1.5 text-[11px]"
                  title="Download CSV of skipped and error rows"
                >
                  <Download size={13} /> Export Issues ({result.skipped.length + result.errors.length})
                </button>
              )}
              <Link
                href="/dashboard/parts"
                className="btn btn-sm btn-primary flex items-center gap-1 text-[11px]"
              >
                Go to Parts List <ChevronRight size={13} />
              </Link>
            </div>
          </div>
          <div className="card-body">
            {(result.errors.length > 0 || result.skipped.length > 0) && (
              <div
                className="flex items-center justify-between gap-3 p-3 rounded-lg border mb-4 text-[12.5px]"
                style={{
                  background: "rgba(217, 119, 6, 0.08)",
                  borderColor: "rgba(217, 119, 6, 0.25)",
                }}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} style={{ color: "#D97706", flexShrink: 0 }} />
                  <span>
                    Some rows could not be imported cleanly:{" "}
                    {result.errors.length > 0 && (
                      <strong style={{ color: "#DC2626" }}>{result.errors.length} error{result.errors.length === 1 ? "" : "s"}</strong>
                    )}
                    {result.errors.length > 0 && result.skipped.length > 0 && " and "}
                    {result.skipped.length > 0 && (
                      <strong style={{ color: "#D97706" }}>{result.skipped.length} skipped row{result.skipped.length === 1 ? "" : "s"}</strong>
                    )}
                    . Automatic redirect was paused so you can inspect issues or download the report.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => downloadIssuesCsv(result, parsedRows, headers, mapping)}
                  className="btn btn-sm flex items-center gap-1 text-[11px] whitespace-nowrap"
                  style={{ background: "white", borderColor: "rgba(217,119,6,0.4)" }}
                >
                  <Download size={13} /> Download Issues CSV
                </button>
              </div>
            )}

            <div className="grid-4" style={{ gap: 12, marginBottom: 16 }}>
              <Tally label="Inserted" value={result.summary.inserted} icon={<CheckCircle2 size={14} style={{ color: "#16A34A" }} />} />
              <Tally label="Updated" value={result.summary.updated} icon={<Info size={14} style={{ color: "#2563EB" }} />} />
              <Tally label="Skipped" value={result.summary.skipped} icon={<AlertCircle size={14} style={{ color: "#D97706" }} />} />
              <Tally label="Errors" value={result.summary.errors} icon={<AlertCircle size={14} style={{ color: "#DC2626" }} />} />
            </div>
            {(result.summary.assemblies_created || result.summary.drawings_created) ? (
              <div className="grid-3" style={{ gap: 12, marginBottom: 16 }}>
                <Tally label="Assemblies Created" value={result.summary.assemblies_created ?? 0} icon={<Database size={14} style={{ color: "#7C3AED" }} />} />
                <Tally label="Assemblies Updated" value={result.summary.assemblies_updated ?? 0} icon={<Link2 size={14} style={{ color: "#0D9488" }} />} />
                <Tally label="Drawings Created" value={result.summary.drawings_created ?? 0} icon={<FileText size={14} style={{ color: "#2563EB" }} />} />
              </div>
            ) : null}

            {((result.summary.mr_created ?? 0) > 0 || (result.summary.mr_updated ?? 0) > 0) && (
              <div
                className="flex items-center justify-between gap-3 p-3 rounded-lg border mb-4 text-[12.5px]"
                style={{
                  background: "rgba(79,70,229,0.06)",
                  borderColor: "rgba(79,70,229,0.25)",
                }}
              >
                <div className="flex items-center gap-2">
                  <PackageCheck size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                  <span>
                    Material Requirements automatically synced:{" "}
                    <strong>{result.summary.mr_created ?? 0} created</strong>
                    {(result.summary.mr_updated ?? 0) > 0 && (
                      <span>, <strong>{result.summary.mr_updated} updated</strong></span>
                    )}
                    .
                  </span>
                </div>
                <Link
                  href="/dashboard/material-requirements"
                  className="btn btn-sm btn-primary flex items-center gap-1 text-[11px]"
                >
                  View Requirements
                </Link>
              </div>
            )}
            {result.mapping && (result.mapping.matched_fields.length > 0 || result.mapping.unmapped_headers.length > 0) && (
              <div style={{
                background: "var(--bg-muted)", borderRadius: 6, padding: "10px 12px",
                marginBottom: 16, display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12,
              }}>
                {result.mapping.matched_fields.length > 0 && (
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)", marginBottom: 4 }}>
                      Mapped columns ({result.mapping.matched_fields.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {result.mapping.matched_fields.map((f) => (
                        <span key={f} className="pill" style={{ fontSize: 10, background: "#DCFCE7", color: "#166534" }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {result.mapping.unmapped_headers.length > 0 && (
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)", marginBottom: 4 }}>
                      Ignored columns ({result.mapping.unmapped_headers.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {result.mapping.unmapped_headers.map((h) => (
                        <span key={h} className="pill" style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E" }}>{h}</span>
                      ))}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--muted)", marginTop: 4 }}>
                      We don&apos;t have a destination field for these yet — they were preserved in the BOM file but skipped on import.
                    </div>
                  </div>
                )}
              </div>
            )}
            {result.skipped.length > 0 && (
              <details className="mt-3" open={result.skipped.length <= 10}>
                <summary className="text-[13px] font-semibold cursor-pointer flex items-center gap-2" style={{ color: "var(--text)" }}>
                  <span>Skipped rows ({result.skipped.length})</span>
                  <span className="text-[11px] font-normal" style={{ color: "var(--muted)" }}>
                    — parts in production with geometry changes blocked
                  </span>
                </summary>
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)", maxHeight: 260, overflowY: "auto" }}>
                  {result.skipped.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded" style={{ borderBottom: "1px solid var(--bg-muted)" }}>
                      <span className="pill" style={{ fontSize: 10, width: 90, textAlign: "center" }}>
                        Sheet Row {s.row + 2}
                      </span>
                      <span className="font-mono font-medium text-[11.5px]" style={{ minWidth: 100, color: "var(--text)" }}>
                        {s.part_mark || "—"}
                      </span>
                      <span style={{ flex: 1, color: "#92400E" }}>{s.reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {result.errors.length > 0 && (
              <details className="mt-3" open={result.errors.length <= 10}>
                <summary className="text-[13px] font-semibold cursor-pointer flex items-center gap-2" style={{ color: "#DC2626" }}>
                  <span>Errors ({result.errors.length})</span>
                  <span className="text-[11px] font-normal" style={{ color: "var(--muted)" }}>
                    — missing required fields or database rejection
                  </span>
                </summary>
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)", maxHeight: 260, overflowY: "auto" }}>
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded" style={{ borderBottom: "1px solid var(--bg-muted)" }}>
                      <span className="pill pill-red" style={{ fontSize: 10, width: 90, textAlign: "center" }}>
                        Sheet Row {e.row + 2}
                      </span>
                      <span style={{ flex: 1, color: "#DC2626" }}>{e.reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      <ImportProgressModal
        isOpen={showProgressModal}
        stage={pipelineStage}
        progressPercent={progressPercent}
        elapsedSeconds={elapsedSeconds}
        totalRows={parsedRows.length}
        fileName={file?.name ?? "BOM File"}
        result={modalResult}
        errorMessage={pipelineError}
        onClose={() => setShowProgressModal(false)}
        onGoToParts={() => {
          setShowProgressModal(false);
          router.push("/dashboard/parts");
        }}
        onDownloadIssues={() => {
          if (result) downloadIssuesCsv(result, parsedRows, headers, mapping);
        }}
      />
    </>
  );
}

function Tally({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="stat-card">
      <div className="stat-label flex items-center gap-1.5">{icon} {label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

// ===========================================================================
// Tab 2 — Detailing PDF Package uploader
// ===========================================================================

type Classification = "shop" | "ga" | "part_sheets";
const CLASSIFICATIONS: { id: Classification; label: string; hint: string }[] = [
  { id: "ga", label: "E-Plans (GA)", hint: "Erection plans / general arrangement layouts" },
  { id: "shop", label: "Shop Drawings", hint: "Per-assembly fabrication drawings" },
  { id: "part_sheets", label: "Part Sheets", hint: "Single-part cut sheets / CNC programs" },
];

interface PdfRow extends PdfMatchResult {
  // Stable per-row id. We can't key on file.name + file.size because the
  // same drawing dropped twice (or two files that happen to share a name +
  // byte count) would collide and trip React's duplicate-key warning.
  uid: string;
  // Local UI state on top of PdfMatchResult — which matches the user has
  // unchecked, plus upload progress/results.
  excluded: Set<string>;
  status: "ready" | "analysing" | "uploading" | "done" | "error";
  uploadedTo?: number;
  errorMessage?: string;
}

function PdfPackageTab({ projects, defaultProjectId }: { projects: Project[]; defaultProjectId: string }) {
  const [projectId, setProjectId] = useState<string>(defaultProjectId);
  const [classification, setClassification] = useState<Classification>("shop");
  const [rows, setRows] = useState<PdfRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [parts, setParts] = useState<PartLite[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);

  // Pull EVERY part for the selected project up-front so the matcher can see
  // all of them. The server caps each page at 200 rows, so we page through
  // until has_more is false — a 400-part project (real customer size) would
  // otherwise silently lose any mark beyond the first 200 in part_mark order
  // (e.g. "2009C1" sits past row 200 alphabetically and never matched).
  useEffect(() => {
    if (!projectId) { setParts([]); return; }
    let cancelled = false;
    setPartsLoading(true); setPartsError(null);

    (async () => {
      const all: PartLite[] = [];
      let page = 1;
      const PER_PAGE = 200;
      // Page through every part in the project — no cap. Terminates when the
      // server reports no more rows (has_more:false) or hands back an empty
      // page, so the loop is still bounded by the actual row count.
      for (; ;) {
        const res = await FabAPI.listPaged<PartLite>("parts", {
          project_id: projectId,
          per_page: PER_PAGE,
          page,
          order_by: "part_mark",
          dir: "asc",
        });
        all.push(...res.rows);
        if (!res.has_more || res.rows.length === 0) break;
        page++;
      }
      return all;
    })().then((all) => {
      if (cancelled) return;
      setParts(all);
    }).catch((e) => {
      if (cancelled) return;
      setPartsError(e instanceof Error ? e.message : "Failed to load parts");
      setParts([]);
    }).finally(() => { if (!cancelled) setPartsLoading(false); });

    return () => { cancelled = true; };
  }, [projectId]);

  async function ingestFiles(files: File[]) {
    if (!projectId) return;
    if (files.length === 0) return;
    const pdfFiles = files.filter((f) => /\.pdf$/i.test(f.name));
    if (pdfFiles.length === 0) return;

    // Lazy-load the heavy pdf.js worker only on first use so the BOM tab
    // never has to wait on it.
    const { analysePdf } = await import("@/lib/pdf-parse");

    setAnalysing(true);
    const pending: PdfRow[] = pdfFiles.map((f) => ({
      uid: crypto.randomUUID(),
      file: f, text: "", matched: [], reasons: new Map(),
      filenamePrefix: null, excluded: new Set(),
      status: "analysing",
    }));
    setRows((prev) => [...prev, ...pending]);

    for (const row of pending) {
      try {
        const result = await analysePdf(row.file, parts);
        setRows((prev) => prev.map((r) => {
          if (r.uid !== row.uid) return r;
          return {
            ...r,
            ...result,
            excluded: new Set(),
            status: result.error ? "error" : "ready",
            errorMessage: result.error,
          };
        }));
      } catch (e) {
        setRows((prev) => prev.map((r) => (r.uid === row.uid ? {
          ...r, status: "error", errorMessage: e instanceof Error ? e.message : "Parse failed",
        } : r)));
      }
    }
    setAnalysing(false);
  }

  function removeRow(uid: string) {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
  }

  function toggleExclude(uid: string, partId: string) {
    setRows((prev) => prev.map((r) => {
      if (r.uid !== uid) return r;
      const next = new Set(r.excluded);
      if (next.has(partId)) {
        next.delete(partId);
      } else {
        next.add(partId);
      }
      return { ...r, excluded: next };
    }));
  }

  async function processAll() {
    if (!projectId) return;
    setProcessing(true);
    try {
      for (const row of rows) {
        if (row.status !== "ready") continue;

        // Special case: Erection Plans (GA) upload directly to Drawing Log (drawings table)
        if (classification === "ga") {
          setRows((prev) => prev.map((r) => (r.uid === row.uid ? { ...r, status: "uploading" } : r)));
          try {
            const prefix = row.filenamePrefix || row.file.name.replace(/\.[^/.]+$/, "").split("_")[0] || "E-PLAN";
            // 1. Create drawing record in Drawing Log
            const dwg = await FabAPI.create<{ id: string }>("drawings", {
              drawing_number: prefix,
              revision: "R0",
              title: `${prefix} General Arrangement Erection Plan`,
              type: "erection_plan",
              status: "released",
              current_revision: true,
              project_id: projectId,
            });
            // 2. Upload file attached directly to drawing record (entity_type: "drawings")
            await uploadFile({
              file: row.file,
              entity_type: "drawings",
              entity_id: dwg.id,
              bucket: "drawings",
            });
            setRows((prev) => prev.map((r) => (r.uid === row.uid ? {
              ...r, status: "done", uploadedTo: 1,
            } : r)));
          } catch (e) {
            setRows((prev) => prev.map((r) => (r.uid === row.uid ? {
              ...r, status: "error", errorMessage: e instanceof Error ? e.message : "E-Plan upload failed",
            } : r)));
          }
          continue;
        }

        let targets = row.matched.filter((p) => !row.excluded.has(p.id));
        if (targets.length === 0) {
          setRows((prev) => prev.map((r) => (r.uid === row.uid ? {
            ...r, status: "error", errorMessage: "No part marks selected — pick at least one before uploading.",
          } : r)));
          continue;
        }

        // When uploading Part Sheets, attach PDF to all matched shop drawing piece marks (e.g. 2043B1, 2044B1, 2206B2)
        if (classification === "part_sheets") {
          const assemblyTargetsMap = new Map<string, PartLite>();
          for (const target of targets) {
            assemblyTargetsMap.set(target.id, target);
            // Also link any sibling parts sharing the same assembly_mark
            if (target.assembly_mark) {
              const siblings = parts.filter((p) => p.assembly_mark === target.assembly_mark || p.part_mark === target.assembly_mark);
              for (const sib of siblings) {
                assemblyTargetsMap.set(sib.id, sib);
              }
            }
          }
          if (assemblyTargetsMap.size > 0) {
            targets = Array.from(assemblyTargetsMap.values());
          }
        }

        setRows((prev) => prev.map((r) => (r.uid === row.uid ? { ...r, status: "uploading" } : r)));
        try {
          // 1) Upload PDF once, attached to the first matched part.
          const first = targets[0];
          const { attachment_id } = await uploadFile({
            file: row.file,
            entity_type: "parts",
            entity_id: first.id,
            bucket: "drawings",
          });
          // 2) Share that attachment to the remaining matches in a single
          //    server-side call so we don't N+1 the file_attachments table.
          let extraCount = 0;
          if (targets.length > 1) {
            const res = await FabAPI.shareFile({
              source_attachment_id: attachment_id,
              target_entity_type: "parts",
              target_entity_ids: targets.slice(1).map((p) => p.id),
            });
            extraCount = res.created;
          }

          const total = 1 + extraCount;
          setRows((prev) => prev.map((r) => (r.uid === row.uid ? {
            ...r, status: "done", uploadedTo: total,
          } : r)));
        } catch (e) {
          setRows((prev) => prev.map((r) => (r.uid === row.uid ? {
            ...r, status: "error", errorMessage: e instanceof Error ? e.message : "Upload failed",
          } : r)));
        }
      }
    } finally {
      setProcessing(false);
    }
  }

  const totalReady = rows.filter((r) => r.status === "ready").length;
  const totalDone = rows.filter((r) => r.status === "done").length;
  const totalLinks = rows.reduce((n, r) => n + (r.uploadedTo ?? 0), 0);

  return (
    <>
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="card-title">Detailing Drawings Package Uploader</div>
            <div className="card-sub">Eliminate paper blueprints by linking PDFs directly to QR travelers.</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20 }}>
            {/* LEFT: project + classification + ai stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
                  Select Project Contract
                </label>
                <select
                  className="input"
                  value={projectId}
                  onChange={(e) => { setProjectId(e.target.value); setRows([]); }}
                  style={{ marginTop: 4 }}
                >
                  <option value="">— select a project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.number ? `${p.number} — ${p.name}` : p.name}</option>
                  ))}
                </select>
                {partsLoading && (
                  <div className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                    <Loader2 size={11} className="animate-spin inline" /> Loading parts catalogue…
                  </div>
                )}
                {partsError && (
                  <div className="text-[11px] mt-2" style={{ color: "#DC2626" }}>{partsError}</div>
                )}
                {projectId && !partsLoading && !partsError && (
                  <div className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                    {parts.length} part{parts.length === 1 ? "" : "s"} indexed for matching.
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11px] uppercase font-semibold tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>
                  Drawing Package Classification
                </div>
                <div className="flex gap-2 flex-wrap">
                  {CLASSIFICATIONS.map((c) => {
                    const active = classification === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setClassification(c.id)}
                        title={c.hint}
                        style={{
                          padding: "8px 14px",
                          border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                          background: active ? "var(--primary)" : "var(--bg-card)",
                          color: active ? "#fff" : "var(--text)",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Files size={13} /> {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-[13px] flex items-center gap-1.5" style={{ color: "var(--text)" }}>
                    <Database size={14} /> Auto-routing &amp; storage
                  </div>
                  <span className="pill" style={{ fontSize: 10, background: "#DCFCE7", color: "#166534" }}>
                    <Sparkles size={10} style={{ marginRight: 3 }} /> AI Routing Active
                  </span>
                </div>
                <div className="text-[12px]" style={{ color: "var(--muted)", lineHeight: 1.5 }}>
                  FabSimple parses every filename prefix (e.g. <code>1001</code>) and every part-mark
                  found inside the PDF text layer, then automatically links the drawing to every
                  matching part. One PDF is stored once and shared across all linked QR travelers.
                </div>
              </div>
            </div>

            {/* RIGHT: drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const files = Array.from(e.dataTransfer.files);
                ingestFiles(files);
              }}
              style={{
                border: `2px dashed ${dragOver ? "var(--primary)" : "var(--border)"}`,
                borderRadius: 10,
                padding: 28,
                textAlign: "center",
                background: dragOver ? "rgba(79,70,229,0.05)" : "var(--bg-muted)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 220,
              }}
            >
              <Files size={36} style={{ color: "var(--muted)", marginBottom: 10 }} />
              <div className="font-semibold text-[14px]" style={{ color: "var(--text)" }}>
                Drag &amp; Drop drawings PDF here
              </div>
              <div className="text-[12px]" style={{ color: "var(--muted)", marginTop: 4 }}>
                or click to browse local detailing folders
              </div>
              <input
                id="pdf-package-input"
                type="file"
                accept=".pdf,application/pdf"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  ingestFiles(files);
                  e.target.value = "";
                }}
                disabled={!projectId || partsLoading}
              />
              <label
                htmlFor="pdf-package-input"
                className="pill"
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  cursor: projectId && !partsLoading ? "pointer" : "not-allowed",
                  opacity: projectId && !partsLoading ? 1 : 0.5,
                  background: "rgba(79,70,229,0.10)",
                  color: "var(--primary)",
                  padding: "5px 10px",
                }}
              >
                Supports multi-page drawing sets
              </label>
              {!projectId && (
                <div className="text-[11px] mt-3" style={{ color: "#DC2626" }}>
                  Select a project first.
                </div>
              )}
            </div>
          </div>

          {rows.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <PdfRowList
                rows={rows}
                onRemove={removeRow}
                onToggleExclude={toggleExclude}
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-section">
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              {analysing
                ? <><Loader2 size={12} className="animate-spin inline" /> Scanning PDFs for part marks…</>
                : rows.length > 0
                  ? <>{totalReady} ready · {totalDone} uploaded · <strong>{totalLinks}</strong> part link{totalLinks === 1 ? "" : "s"} created.</>
                  : <>Drop PDFs above to begin. Each drawing is linked to every part mark it references.</>
              }
            </div>
            <button
              className="btn btn-primary"
              disabled={!projectId || processing || totalReady === 0}
              onClick={processAll}
              style={{ minWidth: 220, justifyContent: "center" }}
            >
              {processing ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              {processing ? "Syncing PDFs…" : "Process & Sync Detailing PDF"}
            </button>
          </div>
        </div>
      </div>

      <div className="card mt-section">
        <div className="card-header"><div className="card-title">Detailer Package Upload Instructions</div></div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
          <div>
            Upload general arrangement or erection layout grids. These plans map the erection sequence
            numbers and site anchors so that field supervisors can coordinate shipping manifests.
          </div>
          <div>
            Ensure PDFs are scaled to standard dimensions. The parser reads the page text layer and
            auto-aligns them with the assembly traveler list imported from your Tekla CSV model.
          </div>
        </div>
      </div>
    </>
  );
  // (intentionally unused — kept here so the lint-import doesn't get culled)
  void Link2;
}

function PdfRowList({
  rows, onRemove, onToggleExclude,
}: {
  rows: PdfRow[];
  onRemove: (uid: string) => void;
  onToggleExclude: (uid: string, partId: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => {
        const remaining = r.matched.filter((p) => !r.excluded.has(p.id)).length;
        const isError = r.status === "error";
        return (
          <div
            key={r.uid}
            className="card"
            style={{
              padding: 12,
              border: isError ? "1px solid #DC2626" : "1px solid var(--border)",
              background: r.status === "done" ? "rgba(22,163,74,0.04)" : "var(--bg-card)",
            }}
          >
            <div className="flex items-start gap-3">
              <FileText size={20} style={{ color: r.status === "done" ? "#16A34A" : "var(--muted)", flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-[13px] font-mono" style={{ color: "var(--text)" }}>{r.file.name}</strong>
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                    {(r.file.size / 1024).toFixed(1)} KB
                  </span>
                  <PdfStatusPill row={r} />
                  {r.filenamePrefix && (
                    <span className="pill" style={{ fontSize: 10, background: "var(--bg-muted)", color: "var(--muted)" }}>
                      filename → <strong>{r.filenamePrefix}</strong>
                    </span>
                  )}
                </div>

                {r.errorMessage && (
                  <div className="text-[12px] mt-1.5" style={{ color: "#DC2626" }}>{r.errorMessage}</div>
                )}

                {r.status !== "error" && r.matched.length === 0 && r.status !== "analysing" && (
                  <div className="text-[12px] mt-1.5" style={{ color: "#D97706" }}>
                    No part marks found in the PDF text or filename. Check that the BOM was imported first.
                  </div>
                )}

                {r.matched.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)", marginBottom: 4 }}>
                      Linking to {remaining} of {r.matched.length} parts
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.matched.map((p) => {
                        const excluded = r.excluded.has(p.id);
                        const reasons = r.reasons.get(p.id) ?? [];
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={r.status === "uploading" || r.status === "done"}
                            onClick={() => onToggleExclude(r.uid, p.id)}
                            title={`Matched by: ${reasons.join(" + ") || "?"} — click to toggle`}
                            className="pill font-mono"
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              background: excluded ? "var(--bg-muted)" : "rgba(79,70,229,0.10)",
                              color: excluded ? "var(--muted)" : "var(--primary)",
                              textDecoration: excluded ? "line-through" : "none",
                              border: `1px solid ${excluded ? "var(--border)" : "var(--primary)"}`,
                              cursor: r.status === "uploading" || r.status === "done" ? "default" : "pointer",
                            }}
                          >
                            {p.part_mark}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {r.status === "done" && r.uploadedTo != null && (
                  <div className="text-[12px] mt-2" style={{ color: "#166534" }}>
                    <Link2 size={11} style={{ display: "inline", marginRight: 4 }} />
                    Linked to {r.uploadedTo} part{r.uploadedTo === 1 ? "" : "s"}. Workers scanning any of these QR
                    codes will now load this PDF.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(r.uid)}
                disabled={r.status === "uploading"}
                title="Remove from queue"
                className="btn btn-sm"
                style={{ flexShrink: 0 }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PdfStatusPill({ row }: { row: PdfRow }) {
  const map = {
    ready: { bg: "rgba(79,70,229,0.10)", color: "var(--primary)", label: "Ready" },
    analysing: { bg: "var(--bg-muted)", color: "var(--muted)", label: "Scanning…" },
    uploading: { bg: "rgba(79,70,229,0.10)", color: "var(--primary)", label: "Uploading…" },
    done: { bg: "#DCFCE7", color: "#166534", label: "Synced" },
    error: { bg: "#FEE2E2", color: "#991B1B", label: "Error" },
  } as const;
  const s = map[row.status];
  return (
    <span className="pill" style={{ fontSize: 10, background: s.bg, color: s.color }}>
      {(row.status === "analysing" || row.status === "uploading") && (
        <Loader2 size={10} className="animate-spin" style={{ marginRight: 4 }} />
      )}
      {s.label}
    </span>
  );
}